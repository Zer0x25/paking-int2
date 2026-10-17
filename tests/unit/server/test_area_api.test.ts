import { describe, expect, it } from "vitest";
import {
  calculateAreaAvailability,
  calculateFacilityBuffer,
  createParkingArea,
  deactivateParkingArea,
  reallocateAreaCapacity,
  updateParkingArea,
  validateFacilityCapacity,
} from "@core/rules/areaAllocationRules";
import type { ParkingArea, ParkingSession } from "@core/types/schema";

const now = "2026-10-17T00:00:00.000Z";
const area = (id: string, code: string, capacity: number, overrides: Partial<ParkingArea> = {}): ParkingArea => ({
  id, facilityId: "fac-1", name: `Area ${id}`, code, description: "", allocatedCapacity: capacity,
  businessUnitId: null, isActive: true, version: 1, createdAt: now, updatedAt: now, ...overrides,
});

describe("Parking area domain rules", () => {
  it("creates normalized areas within the unallocated buffer and rejects duplicate or excess allocation", () => {
    const created = createParkingArea({ facilityId: "fac-1", name: " Norte ", code: " north ", allocatedCapacity: 30 }, [area("a1", "SOUTH", 40)], 100);
    expect(created).toMatchObject({ facilityId: "fac-1", name: "Norte", code: "NORTH", allocatedCapacity: 30, version: 1 });
    expect(() => createParkingArea({ facilityId: "fac-1", name: "Duplicate", code: " south ", allocatedCapacity: 1 }, [area("a1", "SOUTH", 40)], 100)).toThrow(/ya existe/i);
    expect(() => createParkingArea({ facilityId: "fac-1", name: "Too much", code: "LARGE", allocatedCapacity: 61 }, [area("a1", "SOUTH", 40)], 100)).toThrow(/buffer disponible/i);
  });

  it("reallocates and edits an area with concurrency, capacity, and occupancy guards", () => {
    const areas = [area("a1", "A1", 20), area("a2", "A2", 30)];
    const resized = reallocateAreaCapacity({ areaId: "a1", newCapacity: 25, areas, facilityTotalCapacity: 100, activeOccupancy: 10, expectedVersion: 1 });
    expect(resized).toMatchObject({ allocatedCapacity: 25, version: 2 });
    expect(() => reallocateAreaCapacity({ areaId: "a1", newCapacity: 5, areas, facilityTotalCapacity: 100, activeOccupancy: 10, expectedVersion: 1 })).toThrow(/actualmente estacionados/i);
    expect(() => reallocateAreaCapacity({ areaId: "a1", newCapacity: 30, areas, facilityTotalCapacity: 55, activeOccupancy: 0, expectedVersion: 99 })).toThrow(/versión esperada/i);

    const updated = updateParkingArea({ areaId: "a1", name: "Changed", code: "a1-new", description: " Updated ", allocatedCapacity: 25, businessUnitId: null, areas, facilityTotalCapacity: 100, activeOccupancy: 3, expectedVersion: 1 });
    expect(updated).toMatchObject({ name: "Changed", code: "A1-NEW", description: "Updated", allocatedCapacity: 25, version: 2 });
    expect(() => updateParkingArea({ areaId: "a1", name: "Changed", code: "A2", description: "", allocatedCapacity: 20, businessUnitId: null, areas, facilityTotalCapacity: 100, activeOccupancy: 0, expectedVersion: 1 })).toThrow(/ya existe/i);
  });

  it("preserves active occupancy and calculates facility and area availability", () => {
    const target = area("a1", "A1", 2);
    const sessions: ParkingSession[] = [
      { id: "s1", facilityId: "fac-1", businessUnitId: "bu-1", spaceCategoryId: "cat-1", parkingAreaId: "a1", licensePlate: "AA1A11", entryTime: now, exitTime: null, status: "active", durationMinutes: null, operatorUserId: "op", deviceId: "gate", version: 1 },
      { id: "s2", facilityId: "fac-1", businessUnitId: "bu-1", spaceCategoryId: "cat-1", parkingAreaId: "a1", licensePlate: "BB2B22", entryTime: now, exitTime: null, status: "active", durationMinutes: null, operatorUserId: "op", deviceId: "gate", version: 1 },
    ];
    expect(() => deactivateParkingArea({ areaId: target.id, areas: [target], activeOccupancy: 1, expectedVersion: 1 })).toThrow(/no se puede desactivar/i);
    const inactive = deactivateParkingArea({ areaId: target.id, areas: [target], activeOccupancy: 0, expectedVersion: 1 });
    expect(inactive).toMatchObject({ isActive: false, version: 2 });
    expect(calculateFacilityBuffer(100, [target, area("a2", "A2", 20, { isActive: false })])).toBe(98);
    expect(calculateAreaAvailability(target, sessions)).toMatchObject({ occupied: 2, available: 0, occupancyPercentage: 100, isSaturated: true });
    expect(() => validateFacilityCapacity(1, [target], 0)).toThrow(/inferior/i);
    expect(() => validateFacilityCapacity(2, [], 3)).toThrow(/vehículos/i);
  });
});
