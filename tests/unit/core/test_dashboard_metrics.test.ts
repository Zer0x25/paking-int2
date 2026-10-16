import { describe, it, expect } from "vitest";
import { computeDashboardMetrics } from "@core/rules/dashboard-calculator";
import type { Facility, BusinessUnit, ParkingSession } from "@core/types/schema";

describe("User Story 3: Dashboard Metrics & Alert Thresholds (TDD)", () => {
  const facility: Facility = {
    id: "fac-100",
    name: "Gran Centro de Convenciones",
    address: "Av. Costanera 1000",
    totalCapacity: 100,
    createdAt: "2026-10-15T00:00:00Z",
    updatedAt: "2026-10-15T00:00:00Z",
  };

  const businessUnits: BusinessUnit[] = [
    {
      id: "bu-hotel",
      facilityId: facility.id,
      name: "Hotel",
      code: "HOTEL",
      priorityLevel: 1,
      quotaType: "guaranteed",
      defaultQuota: 50,
      isActive: true,
    },
    {
      id: "bu-rest",
      facilityId: facility.id,
      name: "Restaurante",
      code: "REST",
      priorityLevel: 3,
      quotaType: "dynamic",
      defaultQuota: 0,
      isActive: true,
    },
  ];

  it("should report normal alert level when occupancy is below 90%", () => {
    const sessions: ParkingSession[] = Array.from({ length: 80 }, (_, i) => ({
      id: `s-${i}`,
      facilityId: facility.id,
      businessUnitId: "bu-hotel",
      spaceCategoryId: "cat-1",
      licensePlate: `CAR-${i}`,
      entryTime: "2026-10-15T12:00:00Z",
      exitTime: null,
      status: "active" as const,
      durationMinutes: null,
      operatorUserId: "op1",
      deviceId: "gate1",
      version: 1,
    }));

    const metrics = computeDashboardMetrics({
      facility,
      businessUnits,
      activeSessions: sessions,
    });

    expect(metrics.totalOccupied).toBe(80);
    expect(metrics.totalAvailable).toBe(20);
    expect(metrics.occupancyPercentage).toBe(80);
    expect(metrics.alertLevel).toBe("normal");
  });

  it("should trigger warning alert when occupancy is >= 90% and < 100%", () => {
    const sessions: ParkingSession[] = Array.from({ length: 92 }, (_, i) => ({
      id: `s-${i}`,
      facilityId: facility.id,
      businessUnitId: "bu-hotel",
      spaceCategoryId: "cat-1",
      licensePlate: `CAR-${i}`,
      entryTime: "2026-10-15T12:00:00Z",
      exitTime: null,
      status: "active" as const,
      durationMinutes: null,
      operatorUserId: "op1",
      deviceId: "gate1",
      version: 1,
    }));

    const metrics = computeDashboardMetrics({
      facility,
      businessUnits,
      activeSessions: sessions,
    });

    expect(metrics.occupancyPercentage).toBe(92);
    expect(metrics.alertLevel).toBe("warning");
  });

  it("should trigger critical alert when occupancy is 100%", () => {
    const sessions: ParkingSession[] = Array.from({ length: 100 }, (_, i) => ({
      id: `s-${i}`,
      facilityId: facility.id,
      businessUnitId: "bu-hotel",
      spaceCategoryId: "cat-1",
      licensePlate: `CAR-${i}`,
      entryTime: "2026-10-15T12:00:00Z",
      exitTime: null,
      status: "active" as const,
      durationMinutes: null,
      operatorUserId: "op1",
      deviceId: "gate1",
      version: 1,
    }));

    const metrics = computeDashboardMetrics({
      facility,
      businessUnits,
      activeSessions: sessions,
    });

    expect(metrics.occupancyPercentage).toBe(100);
    expect(metrics.alertLevel).toBe("critical");
  });
});
