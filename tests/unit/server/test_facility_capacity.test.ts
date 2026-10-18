import { describe, expect, it } from "vitest";
import {
  CreateFacilityInputSchema,
  CreateParkingAreaInputSchema,
  DashboardMetricsSchema,
  ParkingAreaMetricsSchema,
  ParkingAreaSchema,
  SyncMutationSchema,
  UpdateFacilityInputSchema,
} from "@core/types/schema";
import { splitFacilityCapacity, validateFacilityTypeCapacity } from "@core/rules/areaAllocationRules";
import type { ParkingArea, ParkingSession, SpaceCategory } from "@core/types/schema";

describe("typed capacity contracts", () => {
  it("defaults a new facility to all Standard spaces and accepts an Accessible split", () => {
    const standardOnly = CreateFacilityInputSchema.parse({ name: "Venue", totalCapacity: 35 });
    const split = CreateFacilityInputSchema.parse({ name: "Venue", totalCapacity: 35, accessibleCapacity: 2 });

    expect(standardOnly).toMatchObject({ totalCapacity: 35, accessibleCapacity: 0 });
    expect(split).toMatchObject({ totalCapacity: 35, accessibleCapacity: 2 });
  });

  it("rejects invalid Accessible counts and permits capacity edits without changing the count", () => {
    expect(CreateFacilityInputSchema.safeParse({ name: "Venue", totalCapacity: 35, accessibleCapacity: 36 }).success).toBe(false);
    expect(CreateFacilityInputSchema.safeParse({ name: "Venue", totalCapacity: 35, accessibleCapacity: -1 }).success).toBe(false);
    expect(UpdateFacilityInputSchema.parse({ name: "Updated Venue", accessibleCapacity: 2 })).toMatchObject({ accessibleCapacity: 2 });
    expect(UpdateFacilityInputSchema.parse({ name: "Updated Venue" })).not.toHaveProperty("accessibleCapacity");
  });

  it("normalizes split area inputs and keeps legacy aggregate requests Standard", () => {
    const split = CreateParkingAreaInputSchema.parse({
      facilityId: "facility-1", name: "North", code: "N", standardCapacity: 20, accessibleCapacity: 1,
    });
    const legacy = CreateParkingAreaInputSchema.parse({
      facilityId: "facility-1", name: "South", code: "S", allocatedCapacity: 5,
    });

    expect(split).toMatchObject({ standardCapacity: 20, accessibleCapacity: 1, allocatedCapacity: 21 });
    expect(legacy).toMatchObject({ standardCapacity: 5, accessibleCapacity: 0, allocatedCapacity: 5 });
    expect(CreateParkingAreaInputSchema.safeParse({ facilityId: "facility-1", name: "Missing", code: "M" }).success).toBe(false);
    expect(CreateParkingAreaInputSchema.safeParse({ facilityId: "facility-1", name: "Mismatch", code: "X", allocatedCapacity: 5, standardCapacity: 4, accessibleCapacity: 0 }).success).toBe(false);
  });

  it("backfills legacy area rows and rejects totals that do not equal the typed split", () => {
    const legacy = ParkingAreaSchema.parse({
      id: "legacy-area", facilityId: "facility-1", name: "Legacy", code: "L", allocatedCapacity: 5,
      createdAt: "2026-10-18T12:00:00.000Z", updatedAt: "2026-10-18T12:00:00.000Z",
    });
    const mismatch = ParkingAreaSchema.safeParse({
      id: "bad-area", facilityId: "facility-1", name: "Mismatch", code: "M", allocatedCapacity: 5,
      standardCapacity: 4, accessibleCapacity: 0,
      createdAt: "2026-10-18T12:00:00.000Z", updatedAt: "2026-10-18T12:00:00.000Z",
    });
    const legacyMetrics = ParkingAreaMetricsSchema.parse({
      areaId: "legacy-area", name: "Legacy", code: "L", allocatedCapacity: 5, occupied: 2, available: 3,
      occupancyPercentage: 40, isSaturated: false, businessUnitId: null,
    });

    expect(legacy).toMatchObject({ standardCapacity: 5, accessibleCapacity: 0 });
    expect(mismatch.success).toBe(false);
    expect(legacyMetrics).toMatchObject({ standardCapacity: 5, standardOccupied: 2, standardAvailable: 3, accessibleCapacity: 0, accessibleOccupied: 0, accessibleAvailable: 0 });
  });

  it("validates that an offline vehicle exit has a session or a plate", () => {
    const base = { id: "mutation-1", type: "VEHICLE_EXIT", clientTimestamp: "2026-10-18T12:00:00.000Z", deviceId: "gate", payload: {} };
    expect(SyncMutationSchema.safeParse(base).success).toBe(false);
    expect(SyncMutationSchema.safeParse({ ...base, payload: { sessionId: "session-1" } }).success).toBe(true);
  });

  it("retains per-type area and facility occupancy metrics", () => {
    const area = ParkingAreaMetricsSchema.parse({
      areaId: "area-1", name: "North", code: "N", allocatedCapacity: 21, occupied: 7, available: 14,
      standardCapacity: 20, standardOccupied: 6, standardAvailable: 14,
      accessibleCapacity: 1, accessibleOccupied: 1, accessibleAvailable: 0,
      occupancyPercentage: 33.3, isSaturated: false, businessUnitId: null,
    });
    const dashboard = DashboardMetricsSchema.parse({
      facilityId: "facility-1", totalCapacity: 35, totalOccupied: 7, totalAvailable: 28,
      standardCapacity: 33, standardOccupied: 6, standardAvailable: 27,
      accessibleCapacity: 2, accessibleOccupied: 1, accessibleAvailable: 1,
      occupancyPercentage: 20, alertLevel: "normal", units: [], areas: [area], floatingBuffer: 14,
      timestamp: "2026-10-18T12:00:00.000Z",
    });

    expect(area).toMatchObject({ standardCapacity: 20, accessibleCapacity: 1, accessibleAvailable: 0 });
    expect(dashboard).toMatchObject({ standardCapacity: 33, accessibleCapacity: 2, standardOccupied: 6, accessibleOccupied: 1 });
  });

  it("derives Standard capacity and protects active occupancy and area assignments by type", () => {
    const categories: SpaceCategory[] = [
      { id: "standard", facilityId: "facility-1", name: "Estándar", code: "STD", allocatedSlots: 33 },
      { id: "accessible", facilityId: "facility-1", name: "Accesible", code: "ACC", allocatedSlots: 2 },
    ];
    const areas: ParkingArea[] = [{
      id: "area-1", facilityId: "facility-1", name: "North", code: "N", description: "", allocatedCapacity: 21,
      standardCapacity: 20, accessibleCapacity: 1, businessUnitId: null, isActive: true, version: 1,
      createdAt: "2026-10-18T12:00:00.000Z", updatedAt: "2026-10-18T12:00:00.000Z",
    }];
    const sessions: ParkingSession[] = [
      { id: "session-std", facilityId: "facility-1", businessUnitId: "unit-1", spaceCategoryId: "standard", parkingAreaId: "area-1", licensePlate: "AA11BB", entryTime: "2026-10-18T12:00:00.000Z", exitTime: null, status: "active", durationMinutes: null, operatorUserId: "operator", deviceId: "gate", version: 1 },
      { id: "session-acc", facilityId: "facility-1", businessUnitId: "unit-1", spaceCategoryId: "accessible", parkingAreaId: "area-1", licensePlate: "CC22DD", entryTime: "2026-10-18T12:00:00.000Z", exitTime: null, status: "active", durationMinutes: null, operatorUserId: "operator", deviceId: "gate", version: 1 },
    ];

    expect(splitFacilityCapacity(35, 2)).toEqual({ standardCapacity: 33, accessibleCapacity: 2 });
    expect(() => splitFacilityCapacity(0, 0)).toThrow(/capacidad total/i);
    expect(() => splitFacilityCapacity(35, 36)).toThrow(/capacidad accesible/i);
    expect(() => validateFacilityTypeCapacity({ totalCapacity: 35, accessibleCapacity: 0, areas, activeSessions: sessions, categories }))
      .toThrow(/accesible.*ocupación|ocupación.*accesible/i);
    expect(() => validateFacilityTypeCapacity({
      totalCapacity: 35, accessibleCapacity: 2,
      areas: [{ ...areas[0], standardCapacity: 34, accessibleCapacity: 0, allocatedCapacity: 34 }],
      activeSessions: sessions, categories,
    })).toThrow(/asignación.*estándar|estándar.*recinto/i);
    expect(() => validateFacilityTypeCapacity({ totalCapacity: 35, accessibleCapacity: 2, areas: [{ ...areas[0], accessibleCapacity: 3, standardCapacity: 18, allocatedCapacity: 21 }], activeSessions: sessions, categories }))
      .toThrow(/asignación.*accesible|accesible.*área/i);
    expect(() => validateFacilityTypeCapacity({
      totalCapacity: 3, accessibleCapacity: 2, areas: [],
      activeSessions: [...sessions, { ...sessions[0], id: "session-std-2", licensePlate: "DD44EE" }], categories,
    })).toThrow(/estándar.*ocupación|ocupación.*estándar/i);
  });
});
