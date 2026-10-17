import { Hono } from "hono";
import type { AppEnvironment } from "../types/app-environment";
import { computeDashboardMetrics } from "@core/rules/dashboard-calculator";
import { loadFacilitySnapshot } from "../db/repositories/catalog-repository";
import { readFailure } from "./http-errors";

export const dashboardRoutes = new Hono<AppEnvironment>();

// GET /api/facilities/:id/dashboard
dashboardRoutes.get("/:id/dashboard", async (c) => {
  const facilityId = c.req.param("id");
  try {
    const snapshot = await loadFacilitySnapshot(c.env, facilityId);
    if (!snapshot) return c.json({ error: `Instalación "${facilityId}" no encontrada` }, 404);
    const metrics = computeDashboardMetrics({
      facility: snapshot.facility,
      businessUnits: snapshot.businessUnits.filter((unit) => unit.isActive),
      activeSessions: snapshot.activeSessions,
      areas: snapshot.areas.filter((area) => area.isActive),
    });
    return c.json(metrics);
  } catch (error) {
    const failure = readFailure(error, "No se pudieron cargar las métricas del recinto");
    return c.json(failure, failure.status);
  }
});
