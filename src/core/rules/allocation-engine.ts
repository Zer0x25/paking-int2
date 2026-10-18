import type {
  Facility,
  BusinessUnit,
  EventBooking,
  ParkingSession,
  ParkingArea,
  ParkingAreaMetrics,
  SpaceCategory,
} from "../types/schema";
import {
  calculateFacilityBuffer,
  calculateFacilityTypeBuffer,
  calculateAreaAvailability,
  canAdmitVehicleToArea,
} from "./areaAllocationRules";

export interface AllocationContext {
  facility: Facility;
  businessUnits: BusinessUnit[];
  events: EventBooking[];
  activeSessions: ParkingSession[];
  areas?: ParkingArea[];
  spaceCategories?: SpaceCategory[];
  currentTime?: string;
}

export interface AvailabilityResult {
  facilityId: string;
  totalCapacity: number;
  totalOccupied: number;
  totalAvailable: number;
  dynamicPoolRemaining: number;
  occupancyPercentage: number;
  floatingBuffer: number;
  areas: ParkingAreaMetrics[];
  standardCapacity: number;
  standardOccupied: number;
  standardAvailable: number;
  accessibleCapacity: number;
  accessibleOccupied: number;
  accessibleAvailable: number;
  standardFloatingBuffer: number;
  accessibleFloatingBuffer: number;
  unitAvailability: Record<
    string,
    {
      occupied: number;
      effectiveQuota: number;
      isGuaranteed: boolean;
      canAdmit: boolean;
    }
  >;
}

export function isEventActive(event: EventBooking, currentTime: Date): boolean {
  if (event.status === "cancelled" || event.status === "completed") return false;
  const start = new Date(event.startTime);
  const end = new Date(event.endTime);
  return currentTime >= start && currentTime <= end;
}

export function calculateAvailability(ctx: AllocationContext): AvailabilityResult {
  const now = ctx.currentTime ? new Date(ctx.currentTime) : new Date();
  const totalCapacity = ctx.facility.totalCapacity;
  const activeSessions = ctx.activeSessions.filter((s) => s.status === "active");
  const totalOccupied = activeSessions.length;

  // Active events in the current time window
  const currentEvents = ctx.events.filter((e) => isEventActive(e, now));

  // Compute active occupancy per business unit
  const occupancyByUnit: Record<string, number> = {};
  for (const bu of ctx.businessUnits) {
    occupancyByUnit[bu.id] = activeSessions.filter((s) => s.businessUnitId === bu.id).length;
  }

  // Calculate protected quotas (guaranteed + contractual)
  let totalProtectedUnoccupied = 0;
  const unitAvailability: AvailabilityResult["unitAvailability"] = {};

  for (const bu of ctx.businessUnits) {
    const occupied = occupancyByUnit[bu.id] || 0;
    let effectiveQuota = 0;
    let isGuaranteed = false;

    if (bu.quotaType === "guaranteed") {
      effectiveQuota = bu.defaultQuota;
      isGuaranteed = true;
    } else if (bu.quotaType === "contractual") {
      const buEvents = currentEvents.filter((e) => e.businessUnitId === bu.id);
      effectiveQuota = buEvents.reduce((acc, ev) => acc + ev.reservedSlots, 0);
      isGuaranteed = true;
    }

    if (isGuaranteed) {
      const unoccupiedProtected = Math.max(0, effectiveQuota - occupied);
      totalProtectedUnoccupied += unoccupiedProtected;
    }

    unitAvailability[bu.id] = {
      occupied,
      effectiveQuota,
      isGuaranteed,
      canAdmit: false, // Calculated after dynamic pool
    };
  }

  // Dynamic pool remaining for non-guaranteed or overflow vehicles
  const dynamicPoolRemaining = Math.max(
    0,
    totalCapacity - totalOccupied - totalProtectedUnoccupied
  );

  // Update canAdmit per unit
  for (const bu of ctx.businessUnits) {
    const info = unitAvailability[bu.id];
    if (info.isGuaranteed) {
      // Guaranteed unit can admit if below quota OR if dynamic pool has room
      info.canAdmit = info.occupied < info.effectiveQuota || dynamicPoolRemaining > 0;
    } else {
      // Dynamic unit can only admit if dynamic pool has room
      info.canAdmit = dynamicPoolRemaining > 0;
    }
  }

  const totalAvailable = Math.max(0, totalCapacity - totalOccupied);
  const categories = ctx.spaceCategories ?? [];
  const accessibleCategoryIds = new Set(categories.filter((category) => category.code === "ACC").map((category) => category.id));
  const accessibleCapacity = categories.find((category) => category.code === "ACC")?.allocatedSlots ?? 0;
  const standardCapacity = categories.find((category) => category.code === "STD")?.allocatedSlots ?? (totalCapacity - accessibleCapacity);
  const accessibleOccupied = activeSessions.filter((session) => accessibleCategoryIds.has(session.spaceCategoryId)).length;
  const standardOccupied = totalOccupied - accessibleOccupied;
  const standardAvailable = Math.max(0, standardCapacity - standardOccupied);
  const accessibleAvailable = Math.max(0, accessibleCapacity - accessibleOccupied);
  const occupancyPercentage =
    totalCapacity > 0 ? Math.min(100, Math.round((totalOccupied / totalCapacity) * 100)) : 0;

  const areasList = ctx.areas || [];
  const floatingBuffer = calculateFacilityBuffer(totalCapacity, areasList);
  const areaMetrics = areasList.map((area) => calculateAreaAvailability(area, activeSessions, categories));
  const typeBuffer = calculateFacilityTypeBuffer({ standardCapacity, accessibleCapacity }, areasList);

  return {
    facilityId: ctx.facility.id,
    totalCapacity,
    totalOccupied,
    totalAvailable,
    standardCapacity,
    standardOccupied,
    standardAvailable,
    accessibleCapacity,
    accessibleOccupied,
    accessibleAvailable,
    standardFloatingBuffer: typeBuffer.standardCapacity,
    accessibleFloatingBuffer: typeBuffer.accessibleCapacity,
    dynamicPoolRemaining,
    occupancyPercentage,
    floatingBuffer,
    areas: areaMetrics,
    unitAvailability,
  };
}

export function canAdmitVehicle(
  ctx: AllocationContext & { businessUnit: BusinessUnit; parkingAreaId?: string; spaceCategoryCode?: "STD" | "ACC" }
): { allowed: boolean; reason?: string; suggestedParkingAreaId?: string; allowStandardFallback?: boolean } {
  // If a parking area is specified, validate area rules first
  if (ctx.parkingAreaId && ctx.areas) {
    const area = ctx.areas.find((a) => a.id === ctx.parkingAreaId);
    if (area) {
      const areaCheck = canAdmitVehicleToArea(area, ctx.activeSessions, ctx.businessUnit.id, ctx.spaceCategoryCode, ctx.spaceCategories);
      if (!areaCheck.allowed) {
        const isAccessibleAreaCapacity = ctx.spaceCategoryCode === "ACC"
          && (areaCheck.reason?.includes("No hay plazas Accesibles") || areaCheck.reason?.includes("Capacidad máxima alcanzada"));
        if (isAccessibleAreaCapacity) {
          const accessibleCapacity = (ctx.spaceCategories ?? []).find((category) => category.code === "ACC")?.allocatedSlots ?? 0;
          const accessibleIds = new Set((ctx.spaceCategories ?? []).filter((category) => category.code === "ACC").map((category) => category.id));
          const accessibleOccupied = ctx.activeSessions.filter((session) => session.status === "active" && accessibleIds.has(session.spaceCategoryId)).length;
          if (accessibleOccupied < accessibleCapacity) {
            const alternative = ctx.areas.find((candidate) => candidate.id !== area.id
              && canAdmitVehicleToArea(candidate, ctx.activeSessions, ctx.businessUnit.id, "ACC", ctx.spaceCategories).allowed);
            if (alternative) {
              return {
                allowed: false,
                reason: `El área "${area.name}" no tiene plazas Accesibles disponibles. Puede usar "${alternative.name}".`,
                suggestedParkingAreaId: alternative.id,
              };
            }
            return areaCheck;
          }
          // Let the facility-wide check below decide whether an explicit Standard fallback is safe.
        } else {
          return areaCheck;
        }
      }
    }
  }

  if (ctx.spaceCategoryCode) {
    const categories = ctx.spaceCategories ?? [];
    const accessibleCategoryIds = new Set(categories.filter((category) => category.code === "ACC").map((category) => category.id));
    const accessibleCapacity = categories.find((category) => category.code === "ACC")?.allocatedSlots ?? 0;
    const standardCapacity = categories.find((category) => category.code === "STD")?.allocatedSlots ?? (ctx.facility.totalCapacity - accessibleCapacity);
    const isAccessible = ctx.spaceCategoryCode === "ACC";
    const capacity = isAccessible ? accessibleCapacity : standardCapacity;
    const occupied = ctx.activeSessions.filter((session) => session.status === "active"
      && (accessibleCategoryIds.has(session.spaceCategoryId) === isAccessible)).length;
    if (occupied >= capacity) {
      const reason = isAccessible
        ? "La capacidad Accesible está agotada en el recinto; puede elegir una plaza Estándar disponible."
        : "La capacidad Estándar está agotada en el recinto.";
      if (isAccessible) {
        const standardFallback = canAdmitVehicle({ ...ctx, spaceCategoryCode: "STD" });
        return {
          allowed: false,
          reason,
          ...(standardFallback.allowed ? { allowStandardFallback: true } : {}),
        };
      }
      return {
        allowed: false,
        reason,
      };
    }
    if (!ctx.parkingAreaId) {
      const buffer = calculateFacilityTypeBuffer({ standardCapacity, accessibleCapacity }, ctx.areas ?? []);
      const floatingAvailable = isAccessible ? buffer.accessibleCapacity : buffer.standardCapacity;
      if (floatingAvailable <= 0) {
        if (isAccessible) {
          const alternative = (ctx.areas ?? []).find((area) => canAdmitVehicleToArea(area, ctx.activeSessions, ctx.businessUnit.id, "ACC", categories).allowed);
          if (alternative) {
            return { allowed: false, reason: `La reserva flotante no tiene plazas Accesibles; puede usar "${alternative.name}".`, suggestedParkingAreaId: alternative.id };
          }
        }
        return {
          allowed: false,
          reason: isAccessible
            ? "No quedan plazas Accesibles disponibles en la reserva flotante."
            : "No quedan plazas Estándar disponibles en la reserva flotante.",
        };
      }
    }
  }

  const availability = calculateAvailability(ctx);
  const unitInfo = availability.unitAvailability[ctx.businessUnit.id];

  if (!unitInfo) {
    return { allowed: false, reason: "Unidad de negocio no reconocida en la instalación" };
  }

  if (unitInfo.canAdmit) {
    return { allowed: true };
  }

  if (unitInfo.isGuaranteed) {
    return {
      allowed: false,
      reason: `Capacidad garantizada (${unitInfo.effectiveQuota} plazas) y remanente dinámico agotados para ${ctx.businessUnit.name}`,
    };
  }

  return {
    allowed: false,
    reason: `Acceso restringido para ${ctx.businessUnit.name}: capacidad disponible agotada debido a protección de cupos de Hotel y Eventos`,
  };
}
