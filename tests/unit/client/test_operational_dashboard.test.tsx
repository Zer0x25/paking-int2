// @vitest-environment jsdom
import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { DashboardMetrics } from "@core/types/schema";
import { OperationalDashboard } from "@client/components/OperationalDashboard";

const metrics: DashboardMetrics = {
  facilityId: "facility-1", totalCapacity: 35, totalOccupied: 7, totalAvailable: 28,
  standardCapacity: 33, standardOccupied: 6, standardAvailable: 27,
  accessibleCapacity: 2, accessibleOccupied: 1, accessibleAvailable: 1,
  occupancyPercentage: 20, alertLevel: "normal", units: [],
  areas: [{
    areaId: "area-1", name: "North", code: "N", allocatedCapacity: 21,
    standardCapacity: 20, standardOccupied: 5, standardAvailable: 15,
    accessibleCapacity: 1, accessibleOccupied: 1, accessibleAvailable: 0,
    occupied: 6, available: 15, occupancyPercentage: 28.6, isSaturated: false, businessUnitId: null,
  }],
  floatingBuffer: 14,
  timestamp: "2026-10-18T12:00:00.000Z",
};

describe("OperationalDashboard capacity by physical space type", () => {
  it("shows facility and area occupancy and remaining spaces for both types", () => {
    render(<OperationalDashboard metrics={metrics} />);

    expect(screen.getByText(/Estándar: 6 de 33 · 27 libres/i)).toBeTruthy();
    expect(screen.getByText(/Accesibles: 1 de 2 · 1 libre/i)).toBeTruthy();
    expect(screen.getByText(/Estándar: 5 de 20 · 15 libres/i)).toBeTruthy();
    expect(screen.getByText(/Accesibles: 1 de 1 · 0 libres/i)).toBeTruthy();
  });
});
