import {
  canAdmitVehicle,
  calculateAvailability,
  type AvailabilityResult,
} from "@core/rules/allocation-engine";
import type {
  Facility,
  BusinessUnit,
  EventBooking,
  ParkingSession,
  ParkingArea,
  SpaceCategory,
} from "@core/types/schema";

export interface AllocationSnapshot {
  facility: Facility;
  businessUnits: BusinessUnit[];
  events: EventBooking[];
  activeSessions: ParkingSession[];
  areas: ParkingArea[];
  categories?: SpaceCategory[];
}

export function checkAllocationAvailability(
  snapshot: AllocationSnapshot,
  businessUnitId: string,
  parkingAreaId?: string | null,
  spaceCategoryCode?: "STD" | "ACC",
): { allowed: boolean; reason?: string; suggestedParkingAreaId?: string; allowStandardFallback?: boolean } {
  const businessUnit = snapshot.businessUnits.find(
    (unit) => unit.id === businessUnitId && unit.facilityId === snapshot.facility.id,
  );
  if (!businessUnit) return { allowed: false, reason: "Unidad de negocio no reconocida en la instalación" };
  if (!businessUnit.isActive) return { allowed: false, reason: `La unidad de negocio ${businessUnit.name} está inactiva` };

  return canAdmitVehicle({
    ...snapshot,
    businessUnit,
    spaceCategories: snapshot.categories ?? [],
    ...(parkingAreaId ? { parkingAreaId } : {}),
    ...(spaceCategoryCode ? { spaceCategoryCode } : {}),
  });
}

export function getFacilityAvailability(snapshot: AllocationSnapshot): AvailabilityResult {
  return calculateAvailability(snapshot);
}
