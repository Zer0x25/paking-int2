import { describe, it, expect } from "vitest";
import {
  calculateAvailability,
  canAdmitVehicle,
} from "@core/rules/allocation-engine";
import type {
  Facility,
  BusinessUnit,
  EventBooking,
  ParkingSession,
} from "@core/types/schema";

describe("User Story 2: Dynamic Quota Allocation Engine (TDD)", () => {
  const facility: Facility = {
    id: "fac-001",
    name: "Centro de Convenciones & Hotel",
    address: "Av. Costanera 1000",
    totalCapacity: 100,
    createdAt: "2026-10-15T00:00:00Z",
    updatedAt: "2026-10-15T00:00:00Z",
  };

  const hotelUnit: BusinessUnit = {
    id: "bu-hotel",
    facilityId: facility.id,
    name: "Hotel",
    code: "HOTEL",
    priorityLevel: 1,
    quotaType: "guaranteed",
    defaultQuota: 40,
    isActive: true,
    version: 1,
  };

  const eventUnit: BusinessUnit = {
    id: "bu-event",
    facilityId: facility.id,
    name: "Eventos",
    code: "EVENT",
    priorityLevel: 2,
    quotaType: "contractual",
    defaultQuota: 0,
    isActive: true,
    version: 1,
  };

  const restaurantUnit: BusinessUnit = {
    id: "bu-restaurant",
    facilityId: facility.id,
    name: "Restaurante",
    code: "REST",
    priorityLevel: 3,
    quotaType: "dynamic",
    defaultQuota: 0,
    isActive: true,
    version: 1,
  };

  const activeEvent: EventBooking = {
    id: "ev-001",
    facilityId: facility.id,
    businessUnitId: eventUnit.id,
    title: "Conferencia Médica",
    reservedSlots: 30,
    startTime: "2026-10-15T14:00:00Z",
    endTime: "2026-10-15T20:00:00Z",
    status: "active",
    version: 1,
  };

  it("should calculate correct availability protecting hotel and event quotas", () => {
    // 10 hotel cars already inside, 0 event cars inside, 5 restaurant cars inside
    const sessions: ParkingSession[] = [
      ...Array.from({ length: 10 }, (_, i) => ({
        id: `s-hotel-${i}`,
        facilityId: facility.id,
        businessUnitId: hotelUnit.id,
        spaceCategoryId: "cat-1",
        licensePlate: `H-${i}`,
        entryTime: "2026-10-15T15:00:00Z",
        exitTime: null,
        status: "active" as const,
        durationMinutes: null,
        operatorUserId: "op1",
        deviceId: "gate1",
        version: 1,
      })),
      ...Array.from({ length: 5 }, (_, i) => ({
        id: `s-rest-${i}`,
        facilityId: facility.id,
        businessUnitId: restaurantUnit.id,
        spaceCategoryId: "cat-1",
        licensePlate: `R-${i}`,
        entryTime: "2026-10-15T15:00:00Z",
        exitTime: null,
        status: "active" as const,
        durationMinutes: null,
        operatorUserId: "op1",
        deviceId: "gate1",
        version: 1,
      })),
    ];

    const availability = calculateAvailability({
      facility,
      businessUnits: [hotelUnit, eventUnit, restaurantUnit],
      events: [activeEvent],
      activeSessions: sessions,
      currentTime: "2026-10-15T16:00:00Z",
    });

    // Total = 100
    // Total occupied = 15
    // Hotel guaranteed = 40 (10 occupied + 30 protected)
    // Event contractual = 30 (0 occupied + 30 protected)
    // Protected slots not yet occupied = (40 - 10) + (30 - 0) = 60
    // Dynamic remaining pool = 100 - (15 occupied + 60 protected reserved) = 25
    expect(availability.totalCapacity).toBe(100);
    expect(availability.totalOccupied).toBe(15);
    expect(availability.dynamicPoolRemaining).toBe(25);
  });

  it("should always allow guaranteed hotel guests up to their quota", () => {
    const sessions: ParkingSession[] = Array.from({ length: 39 }, (_, i) => ({
      id: `s-hotel-${i}`,
      facilityId: facility.id,
      businessUnitId: hotelUnit.id,
      spaceCategoryId: "cat-1",
      licensePlate: `H-${i}`,
      entryTime: "2026-10-15T15:00:00Z",
      exitTime: null,
      status: "active" as const,
      durationMinutes: null,
      operatorUserId: "op1",
      deviceId: "gate1",
      version: 1,
    }));

    const result = canAdmitVehicle({
      facility,
      businessUnit: hotelUnit,
      businessUnits: [hotelUnit, eventUnit, restaurantUnit],
      events: [activeEvent],
      activeSessions: sessions,
      currentTime: "2026-10-15T16:00:00Z",
    });

    expect(result.allowed).toBe(true);
  });

  it("should reject dynamic unit when dynamic pool is exhausted", () => {
    // 40 hotel (full quota), 30 event (full quota), 30 restaurant (exhausted pool)
    const sessions: ParkingSession[] = [
      ...Array.from({ length: 40 }, (_, i) => ({
        id: `s-hotel-${i}`,
        facilityId: facility.id,
        businessUnitId: hotelUnit.id,
        spaceCategoryId: "cat-1",
        licensePlate: `H-${i}`,
        entryTime: "2026-10-15T15:00:00Z",
        exitTime: null,
        status: "active" as const,
        durationMinutes: null,
        operatorUserId: "op1",
        deviceId: "gate1",
        version: 1,
      })),
      ...Array.from({ length: 30 }, (_, i) => ({
        id: `s-event-${i}`,
        facilityId: facility.id,
        businessUnitId: eventUnit.id,
        spaceCategoryId: "cat-1",
        licensePlate: `E-${i}`,
        entryTime: "2026-10-15T15:00:00Z",
        exitTime: null,
        status: "active" as const,
        durationMinutes: null,
        operatorUserId: "op1",
        deviceId: "gate1",
        version: 1,
      })),
      ...Array.from({ length: 30 }, (_, i) => ({
        id: `s-rest-${i}`,
        facilityId: facility.id,
        businessUnitId: restaurantUnit.id,
        spaceCategoryId: "cat-1",
        licensePlate: `R-${i}`,
        entryTime: "2026-10-15T15:00:00Z",
        exitTime: null,
        status: "active" as const,
        durationMinutes: null,
        operatorUserId: "op1",
        deviceId: "gate1",
        version: 1,
      })),
    ];

    const result = canAdmitVehicle({
      facility,
      businessUnit: restaurantUnit,
      businessUnits: [hotelUnit, eventUnit, restaurantUnit],
      events: [activeEvent],
      activeSessions: sessions,
      currentTime: "2026-10-15T16:00:00Z",
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("capacidad disponible agotada");
  });

  it("should ignore cancelled or completed events when computing contractual quotas", () => {
    const cancelledEvent: EventBooking = {
      ...activeEvent,
      id: "ev-cancelled",
      status: "cancelled",
    };

    const availability = calculateAvailability({
      facility,
      businessUnits: [hotelUnit, eventUnit, restaurantUnit],
      events: [cancelledEvent],
      activeSessions: [],
      currentTime: "2026-10-15T16:00:00Z",
    });

    // Since event is cancelled, its 30 slots are NOT protected
    expect(availability.unitAvailability[eventUnit.id].effectiveQuota).toBe(0);
  });

  it("should reject vehicle if business unit is not recognized in facility", () => {
    const unknownUnit: BusinessUnit = {
      id: "bu-unknown",
      facilityId: "fac-other",
      name: "Unknown",
      code: "UNK",
      priorityLevel: 3,
      quotaType: "dynamic",
      defaultQuota: 0,
      isActive: true,
      version: 1,
    };

    const result = canAdmitVehicle({
      facility,
      businessUnit: unknownUnit,
      businessUnits: [hotelUnit],
      events: [],
      activeSessions: [],
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("no reconocida");
  });

  it("reserves type-specific area capacity and admits only from the matching floating buffer", () => {
    const categories = [
      { id: "cat-std", facilityId: facility.id, name: "Estándar", code: "STD" as const, allocatedSlots: 2 },
      { id: "cat-acc", facilityId: facility.id, name: "Accesible", code: "ACC" as const, allocatedSlots: 1 },
    ];
    const area = {
      id: "area-1", facilityId: facility.id, name: "North", code: "N", description: "",
      allocatedCapacity: 2, standardCapacity: 1, accessibleCapacity: 1, businessUnitId: null,
      isActive: true, version: 1, createdAt: "2026-10-15T00:00:00Z", updatedAt: "2026-10-15T00:00:00Z",
    };
    const activeAccessible: ParkingSession = {
      id: "acc-session", facilityId: facility.id, businessUnitId: restaurantUnit.id,
      spaceCategoryId: "cat-acc", parkingAreaId: area.id, licensePlate: "AA11BB",
      entryTime: "2026-10-15T15:00:00Z", exitTime: null, status: "active", durationMinutes: null,
      operatorUserId: "op1", deviceId: "gate1", version: 1,
    };

    const standardFromFloating = canAdmitVehicle({
      facility: { ...facility, totalCapacity: 3 }, businessUnit: restaurantUnit,
      businessUnits: [restaurantUnit], events: [], activeSessions: [activeAccessible], areas: [area],
      spaceCategories: categories, spaceCategoryCode: "STD",
    });
    const accessibleFromExhaustedArea = canAdmitVehicle({
      facility: { ...facility, totalCapacity: 3 }, businessUnit: restaurantUnit,
      businessUnits: [restaurantUnit], events: [], activeSessions: [activeAccessible], areas: [area],
      spaceCategories: categories, parkingAreaId: area.id, spaceCategoryCode: "ACC",
    });

    expect(standardFromFloating).toMatchObject({ allowed: true });
    expect(accessibleFromExhaustedArea).toMatchObject({ allowed: false, allowStandardFallback: true });
    expect(accessibleFromExhaustedArea.reason).toMatch(/accesible/i);
  });

  it("suggests an alternate area when the selected area has no Accessible spaces", () => {
    const categories = [
      { id: "cat-std", facilityId: facility.id, name: "Estándar", code: "STD" as const, allocatedSlots: 2 },
      { id: "cat-acc", facilityId: facility.id, name: "Accesible", code: "ACC" as const, allocatedSlots: 1 },
    ];
    const targetArea = {
      id: "area-target", facilityId: facility.id, name: "Sector General", code: "GEN", description: "",
      allocatedCapacity: 1, standardCapacity: 1, accessibleCapacity: 0, businessUnitId: null,
      isActive: true, version: 1, createdAt: "2026-10-15T00:00:00Z", updatedAt: "2026-10-15T00:00:00Z",
    };
    const accessibleArea = {
      id: "area-accessible", facilityId: facility.id, name: "Sector Accesible", code: "ACC", description: "",
      allocatedCapacity: 1, standardCapacity: 0, accessibleCapacity: 1, businessUnitId: null,
      isActive: true, version: 1, createdAt: "2026-10-15T00:00:00Z", updatedAt: "2026-10-15T00:00:00Z",
    };

    const result = canAdmitVehicle({
      facility: { ...facility, totalCapacity: 3 }, businessUnit: restaurantUnit,
      businessUnits: [restaurantUnit], events: [], activeSessions: [], areas: [targetArea, accessibleArea],
      spaceCategories: categories, parkingAreaId: targetArea.id, spaceCategoryCode: "ACC",
    });

    expect(result).toMatchObject({ allowed: false, suggestedParkingAreaId: accessibleArea.id });
    expect(result.reason).toContain("Sector Accesible");
  });

  it("suggests an Accessible area when the floating buffer is fully assigned", () => {
    const categories = [
      { id: "cat-std", facilityId: facility.id, name: "Estándar", code: "STD" as const, allocatedSlots: 2 },
      { id: "cat-acc", facilityId: facility.id, name: "Accesible", code: "ACC" as const, allocatedSlots: 1 },
    ];
    const accessibleArea = {
      id: "area-accessible", facilityId: facility.id, name: "Sector Accesible", code: "ACC", description: "",
      allocatedCapacity: 1, standardCapacity: 0, accessibleCapacity: 1, businessUnitId: null,
      isActive: true, version: 1, createdAt: "2026-10-15T00:00:00Z", updatedAt: "2026-10-15T00:00:00Z",
    };
    const result = canAdmitVehicle({
      facility: { ...facility, totalCapacity: 3 }, businessUnit: restaurantUnit,
      businessUnits: [restaurantUnit], events: [], activeSessions: [], areas: [accessibleArea],
      spaceCategories: categories, spaceCategoryCode: "ACC",
    });

    expect(result).toMatchObject({ allowed: false, suggestedParkingAreaId: accessibleArea.id });
  });

  it("does not offer Standard fallback when Standard itself has no capacity", () => {
    const categories = [
      { id: "cat-std", facilityId: facility.id, name: "Estándar", code: "STD" as const, allocatedSlots: 0 },
      { id: "cat-acc", facilityId: facility.id, name: "Accesible", code: "ACC" as const, allocatedSlots: 1 },
    ];
    const activeAccessible: ParkingSession = {
      id: "acc-session", facilityId: facility.id, businessUnitId: restaurantUnit.id,
      spaceCategoryId: "cat-acc", licensePlate: "AA11BB", entryTime: "2026-10-15T15:00:00Z",
      exitTime: null, status: "active", durationMinutes: null, operatorUserId: "op1", deviceId: "gate1", version: 1,
    };
    const result = canAdmitVehicle({
      facility: { ...facility, totalCapacity: 1 }, businessUnit: restaurantUnit,
      businessUnits: [restaurantUnit], events: [], activeSessions: [activeAccessible],
      spaceCategories: categories, spaceCategoryCode: "ACC",
    });

    expect(result.allowed).toBe(false);
    expect(result.allowStandardFallback).toBeUndefined();
  });
});
