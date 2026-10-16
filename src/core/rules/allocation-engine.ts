import type {
  Facility,
  BusinessUnit,
  EventBooking,
  ParkingSession,
} from "../types/schema";

export interface AllocationContext {
  facility: Facility;
  businessUnits: BusinessUnit[];
  events: EventBooking[];
  activeSessions: ParkingSession[];
  currentTime?: string;
}

export interface AvailabilityResult {
  facilityId: string;
  totalCapacity: number;
  totalOccupied: number;
  totalAvailable: number;
  dynamicPoolRemaining: number;
  occupancyPercentage: number;
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
  const occupancyPercentage =
    totalCapacity > 0 ? Math.min(100, Math.round((totalOccupied / totalCapacity) * 100)) : 0;

  return {
    facilityId: ctx.facility.id,
    totalCapacity,
    totalOccupied,
    totalAvailable,
    dynamicPoolRemaining,
    occupancyPercentage,
    unitAvailability,
  };
}

export function canAdmitVehicle(
  ctx: AllocationContext & { businessUnit: BusinessUnit }
): { allowed: boolean; reason?: string } {
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
