import { Hono } from "hono";
import { computeDashboardMetrics } from "@core/rules/dashboard-calculator";
import { defaultFacility, defaultBusinessUnits } from "../services/allocation-service";
import { mockSessionsRepo } from "./parking";
import { parkingAreasStore } from "./facilities";

export const dashboardRoutes = new Hono();

// GET /api/facilities/:id/dashboard
dashboardRoutes.get("/:id/dashboard", (c) => {
  const facilityId = c.req.param("id");

  // In production, load facility and units from D1; fallback to default in dev/test
  const facility = facilityId === defaultFacility.id ? defaultFacility : { ...defaultFacility, id: facilityId };

  const metrics = computeDashboardMetrics({
    facility,
    businessUnits: defaultBusinessUnits,
    activeSessions: mockSessionsRepo.filter((s) => s.facilityId === facilityId),
    areas: parkingAreasStore.filter((a) => a.facilityId === facilityId && a.isActive),
  });

  return c.json(metrics);
});
