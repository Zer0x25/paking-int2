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
} from "@core/types/schema";

// In-memory catalog store for default facility seed
export const defaultFacility: Facility = {
  id: "fac-default-01",
  name: "Centro de Convenciones & Hotel Grand",
  address: "Av. Costanera 1000",
  totalCapacity: 100,
  createdAt: "2026-10-15T00:00:00Z",
  updatedAt: "2026-10-15T00:00:00Z",
};

export const defaultBusinessUnits: BusinessUnit[] = [
  {
    id: "bu-hotel-01",
    facilityId: defaultFacility.id,
    name: "Hotel",
    code: "HOTEL",
    priorityLevel: 1,
    quotaType: "guaranteed",
    defaultQuota: 40,
    isActive: true,
  },
  {
    id: "bu-events-01",
    facilityId: defaultFacility.id,
    name: "Eventos",
    code: "EVENT",
    priorityLevel: 2,
    quotaType: "contractual",
    defaultQuota: 0,
    isActive: true,
  },
  {
    id: "bu-restaurant-01",
    facilityId: defaultFacility.id,
    name: "Restaurante",
    code: "REST",
    priorityLevel: 3,
    quotaType: "dynamic",
    defaultQuota: 0,
    isActive: true,
  },
  {
    id: "bu-gym-01",
    facilityId: defaultFacility.id,
    name: "Gimnasio",
    code: "GYM",
    priorityLevel: 3,
    quotaType: "dynamic",
    defaultQuota: 0,
    isActive: true,
  },
];

export const defaultEvents: EventBooking[] = [
  {
    id: "ev-summit-01",
    facilityId: defaultFacility.id,
    businessUnitId: "bu-events-01",
    title: "Cumbre de Negocios 2026",
    reservedSlots: 25,
    startTime: "2026-10-15T08:00:00Z",
    endTime: "2026-10-16T22:00:00Z",
    status: "active",
  },
];

export function checkAllocationAvailability(
  facilityId: string,
  businessUnitId: string,
  activeSessions: ParkingSession[]
): { allowed: boolean; reason?: string } {
  const bu = defaultBusinessUnits.find((b) => b.id === businessUnitId);
  if (!bu) {
    // If not found in default list, allow by default or reject if not registered
    return { allowed: true };
  }

  return canAdmitVehicle({
    facility: defaultFacility,
    businessUnit: bu,
    businessUnits: defaultBusinessUnits,
    events: defaultEvents,
    activeSessions,
  });
}

export function getFacilityAvailability(
  facilityId: string,
  activeSessions: ParkingSession[]
): AvailabilityResult {
  return calculateAvailability({
    facility: defaultFacility,
    businessUnits: defaultBusinessUnits,
    events: defaultEvents,
    activeSessions,
  });
}
