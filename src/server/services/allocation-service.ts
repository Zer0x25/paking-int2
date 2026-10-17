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
    version: 1,
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
    version: 1,
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
    version: 1,
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
    version: 1,
  },
];

export const businessUnitsStore: BusinessUnit[] = defaultBusinessUnits.map((unit) => ({ ...unit }));

export type BusinessUnitAuditAction = "created" | "updated" | "deactivated";

export interface BusinessUnitAuditEntry {
  id: string;
  facilityId: string;
  businessUnitId: string;
  userId: string;
  action: BusinessUnitAuditAction;
  before: BusinessUnit | null;
  after: BusinessUnit;
  createdAt: string;
}

export const businessUnitAuditStore: BusinessUnitAuditEntry[] = [];

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
    version: 1,
  },
];

export type EventBookingAuditAction = "created" | "updated" | "cancelled";

export interface EventBookingAuditEntry {
  id: string;
  facilityId: string;
  eventId: string;
  userId: string;
  action: EventBookingAuditAction;
  details: Record<string, unknown>;
  createdAt: string;
}

export const eventBookingsStore: EventBooking[] = defaultEvents.map((event) => ({ ...event }));
export const eventBookingAuditStore: EventBookingAuditEntry[] = [];

export function checkAllocationAvailability(
  facilityId: string,
  businessUnitId: string,
  activeSessions: ParkingSession[]
): { allowed: boolean; reason?: string } {
  const bu = businessUnitsStore.find((b) => b.id === businessUnitId);
  if (!bu) {
    // If not found in default list, allow by default or reject if not registered
    return { allowed: true };
  }
  if (!bu.isActive) {
    return { allowed: false, reason: `La unidad de negocio ${bu.name} está inactiva` };
  }

  const availableUnits = businessUnitsStore.filter(
    (unit) => unit.isActive && (unit.facilityId === facilityId || unit.facilityId === defaultFacility.id),
  );

  return canAdmitVehicle({
    facility: defaultFacility,
    businessUnit: bu,
    businessUnits: availableUnits,
    events: eventBookingsStore.filter((event) => event.facilityId === facilityId),
    activeSessions,
  });
}

export function getFacilityAvailability(
  facilityId: string,
  activeSessions: ParkingSession[]
): AvailabilityResult {
  return calculateAvailability({
    facility: defaultFacility,
    businessUnits: businessUnitsStore.filter(
      (unit) => unit.isActive && (unit.facilityId === facilityId || unit.facilityId === defaultFacility.id),
    ),
    events: eventBookingsStore.filter((event) => event.facilityId === facilityId),
    activeSessions,
  });
}
