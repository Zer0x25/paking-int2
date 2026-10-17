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
} from "@core/types/schema";

export interface AllocationSnapshot {
  facility: Facility;
  businessUnits: BusinessUnit[];
  events: EventBooking[];
  activeSessions: ParkingSession[];
  areas: ParkingArea[];
}

export function checkAllocationAvailability(
  snapshot: AllocationSnapshot,
  businessUnitId: string,
  parkingAreaId?: string | null,
): { allowed: boolean; reason?: string } {
  const businessUnit = snapshot.businessUnits.find(
    (unit) => unit.id === businessUnitId && unit.facilityId === snapshot.facility.id,
  );
  if (!businessUnit) return { allowed: false, reason: "Unidad de negocio no reconocida en la instalación" };
  if (!businessUnit.isActive) return { allowed: false, reason: `La unidad de negocio ${businessUnit.name} está inactiva` };

  return canAdmitVehicle({
    ...snapshot,
    businessUnit,
    ...(parkingAreaId ? { parkingAreaId } : {}),
  });
}

export function getFacilityAvailability(snapshot: AllocationSnapshot): AvailabilityResult {
  return calculateAvailability(snapshot);
}
