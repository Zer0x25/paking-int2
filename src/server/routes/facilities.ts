import { Hono } from "hono";
import type { Context } from "hono";
import {
  CreateFacilityInputSchema,
  DeactivateFacilityInputSchema,
  UpdateFacilityInputSchema,
  CreateParkingAreaInputSchema,
  UpdateParkingAreaCapacityInputSchema,
  UpdateParkingAreaInputSchema,
  DeactivateParkingAreaInputSchema,
  CreateBusinessUnitInputSchema,
  UpdateBusinessUnitInputSchema,
  DeactivateBusinessUnitInputSchema,
  CreateEventBookingInputSchema,
  UpdateEventBookingInputSchema,
  CancelEventBookingInputSchema,
  type BusinessUnit,
  type EventBooking,
} from "@core/types/schema";
import {
  calculateFacilityBuffer,
  validateFacilityCapacity,
  createParkingArea,
  reallocateAreaCapacity,
  updateParkingArea,
  deactivateParkingArea,
  calculateAreaAvailability,
  calculateFacilityTypeBuffer,
  splitFacilityCapacity,
  validateFacilityTypeCapacity,
} from "@core/rules/areaAllocationRules";
import {
  cancelEventBooking,
  updateEventBooking,
  isEventVisible,
  validateEventBookingCapacity,
} from "@core/rules/eventBookingRules";
import {
  createBusinessUnit,
  updateBusinessUnit,
  deactivateBusinessUnit,
} from "@core/rules/businessUnitRules";
import { authMiddleware, signJwt } from "../middleware/auth";
import type { AppEnvironment } from "../types/app-environment";
import {
  createAreaRecord,
  createBusinessUnitRecord,
  createEventRecord,
  createFacilityRecord,
  deactivateFacilityRecord,
  listFacilities,
  loadFacilityCatalogs,
  loadFacilitySnapshot,
  updateAreaRecord,
  updateBusinessUnitRecord,
  updateEventRecord,
  updateFacilityRecord,
} from "../db/repositories/catalog-repository";
import { mutationFailure, readFailure } from "./http-errors";
import { BusinessRuleError } from "@core/errors/business-rule-error";

export const facilityRoutes = new Hono<AppEnvironment>();

facilityRoutes.use("*", async (c, next) => {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(c.req.method)) {
    return authMiddleware("admin")(c, next);
  }
  await next();
});

function actor(c: { get: (key: "user") => AppEnvironment["Variables"]["user"] | undefined }): { userId: string } {
  return { userId: c.get("user")?.userId ?? "local-system" };
}

function mutationOrRuleFailure(c: Context<AppEnvironment>, error: unknown, fallback: string) {
  if (error instanceof BusinessRuleError) return { status: 409 as const, error: error.message };
  return mutationFailure(error, fallback, c);
}

function guaranteedQuota(units: BusinessUnit[]): number {
  return units.filter((unit) => unit.isActive && unit.quotaType === "guaranteed")
    .reduce((sum, unit) => sum + unit.defaultQuota, 0);
}

function validateUnitCapacity(facilityCapacity: number, units: BusinessUnit[], events: EventBooking[]): void {
  const guaranteed = guaranteedQuota(units);
  if (guaranteed > facilityCapacity) {
    throw new BusinessRuleError(`La suma de cuotas garantizadas (${guaranteed}) supera el aforo de la instalación (${facilityCapacity})`);
  }
  const visible = events.filter((event) => isEventVisible(event, new Date()));
  for (const event of visible) validateEventBookingCapacity(event, visible, facilityCapacity, guaranteed);
}

function isContractualUnit(units: BusinessUnit[], businessUnitId: string): boolean {
  return units.some((unit) => unit.id === businessUnitId && unit.isActive && unit.quotaType === "contractual");
}

function accessibleCapacityOf(categories: { code: string; allocatedSlots: number }[]): number {
  return categories.find((category) => category.code === "ACC")?.allocatedSlots ?? 0;
}

function occupancyBySpaceType(
  sessions: { status: string; spaceCategoryId: string; parkingAreaId?: string | null }[],
  categories: { id: string; code: string }[],
  areaId?: string,
): { standard: number; accessible: number; total: number } {
  const accessibleIds = new Set(categories.filter((category) => category.code === "ACC").map((category) => category.id));
  const scoped = sessions.filter((session) => session.status === "active" && (areaId === undefined || session.parkingAreaId === areaId));
  const accessible = scoped.filter((session) => accessibleIds.has(session.spaceCategoryId)).length;
  return { standard: scoped.length - accessible, accessible, total: scoped.length };
}

// GET /api/facilities
facilityRoutes.get("/", async (c) => {
  try {
    const facilityId = c.get("user")?.facilityId;
    if (!facilityId) return c.json({ error: "La sesión no tiene un recinto asignado" }, 403);
    return c.json({ facilities: await listFacilities(c.env, facilityId) });
  } catch (error) {
    const failure = readFailure(error, "No se pudieron cargar las instalaciones", c);
    return c.json(failure, failure.status);
  }
});

// POST /api/facilities
facilityRoutes.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = CreateFacilityInputSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Datos de instalación inválidos", details: parsed.error.format() }, 400);
  const user = c.get("user");
  if (!user || user.facilityId) return c.json({ error: "La cuenta ya tiene un recinto asignado; edítalo desde Configuración" }, 409);
  const now = new Date().toISOString();
  const facility = { ...parsed.data, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
  try {
    const secret = c.env.JWT_SECRET;
    if (!secret) return c.json({ error: "Error interno del servidor", status: 500 }, 500);
    const token = await signJwt({ userId: user.userId, username: user.username, role: user.role, facilityId: facility.id }, secret, 86400);
    await createFacilityRecord(c.env, facility, actor(c));
    return c.json({ facility, token }, 201);
  } catch (error) {
    const failure = mutationFailure(error, "No se pudo crear la instalación", c);
    return c.json(failure, failure.status);
  }
});

// PATCH /api/facilities/:id/status
facilityRoutes.patch("/:id/status", async (c) => {
  const facilityId = c.req.param("id")!;
  const parsed = DeactivateFacilityInputSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Datos de desactivación inválidos", details: parsed.error.format() }, 400);
  try {
    const snapshot = await loadFacilitySnapshot(c.env, facilityId);
    if (!snapshot) return c.json({ error: `Instalación "${facilityId}" no encontrada` }, 404);
    if (snapshot.activeSessions.length > 0) {
      return c.json({ error: `No se puede eliminar el recinto mientras haya ${snapshot.activeSessions.length} vehículo(s) activo(s)` }, 409);
    }
    await deactivateFacilityRecord(c.env, {
      facilityId,
      expectedVersion: snapshot.facilityVersion,
      actor: actor(c),
      updatedAt: new Date().toISOString(),
    });
    return c.json({ facilityId, status: "inactive" }, 200);
  } catch (error) {
    const failure = mutationOrRuleFailure(c, error, "No se pudo eliminar el recinto");
    return c.json(failure, failure.status);
  }
});

// PUT /api/facilities/:id
facilityRoutes.put("/:id", async (c) => {
  const facilityId = c.req.param("id")!;
  const parsed = UpdateFacilityInputSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Datos de actualización inválidos", details: parsed.error.format() }, 400);
  try {
    const snapshot = await loadFacilitySnapshot(c.env, facilityId);
    if (!snapshot) return c.json({ error: `Instalación "${facilityId}" no encontrada` }, 404);
    const currentAccessibleCapacity = accessibleCapacityOf(snapshot.categories);
    const totalCapacity = parsed.data.totalCapacity ?? snapshot.facility.totalCapacity;
    const accessibleCapacity = parsed.data.accessibleCapacity ?? currentAccessibleCapacity;
    if (parsed.data.totalCapacity !== undefined) {
      try {
        validateFacilityCapacity(parsed.data.totalCapacity, snapshot.areas, snapshot.activeSessions.length);
      } catch (error) {
        if (error instanceof BusinessRuleError) return c.json({ error: error.message }, 409);
        throw error;
      }
    }
    try {
      validateFacilityTypeCapacity({
        totalCapacity,
        accessibleCapacity,
        areas: snapshot.areas,
        activeSessions: snapshot.activeSessions,
        categories: snapshot.categories,
      });
    } catch (error) {
      if (error instanceof BusinessRuleError) return c.json({ error: error.message }, 409);
      throw error;
    }
    const facility = await updateFacilityRecord(c.env, {
      facilityId,
      expectedVersion: snapshot.facilityVersion,
      updates: parsed.data,
      current: snapshot.facility,
      currentAccessibleCapacity,
      actor: actor(c),
      activeSessions: snapshot.activeSessions,
      areas: snapshot.areas,
    });
    return c.json({ facility }, 200);
  } catch (error) {
    const failure = mutationOrRuleFailure(c, error, "No se pudo actualizar la instalación");
    return c.json(failure, failure.status);
  }
});

// GET /api/facilities/:id/business-units
facilityRoutes.get("/:id/business-units", authMiddleware("admin"), async (c) => {
  const facilityId = c.req.param("id")!;
  try {
    const snapshot = await loadFacilitySnapshot(c.env, facilityId);
    if (!snapshot) return c.json({ error: `Instalación "${facilityId}" no encontrada` }, 404);
    const businessUnits = snapshot.businessUnits.sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name));
    return c.json({ businessUnits });
  } catch (error) {
    const failure = readFailure(error, "No se pudieron cargar las unidades de negocio", c);
    return c.json(failure, failure.status);
  }
});

// POST /api/facilities/:id/business-units
facilityRoutes.post("/:id/business-units", authMiddleware("admin"), async (c) => {
  const facilityId = c.req.param("id")!;
  const parsed = CreateBusinessUnitInputSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Datos de unidad de negocio inválidos", details: parsed.error.format() }, 400);
  try {
    const snapshot = await loadFacilitySnapshot(c.env, facilityId);
    if (!snapshot) return c.json({ error: `Instalación "${facilityId}" no encontrada` }, 404);
    const unit = createBusinessUnit(parsed.data, facilityId, snapshot.businessUnits, crypto.randomUUID());
    validateUnitCapacity(snapshot.facility.totalCapacity, [...snapshot.businessUnits, unit], snapshot.events);
    await createBusinessUnitRecord(c.env, { unit, facilityVersion: snapshot.facilityVersion, actor: actor(c) });
    return c.json({ businessUnit: unit }, 201);
  } catch (error) {
    const failure = mutationOrRuleFailure(c, error, "No se pudo crear la unidad");
    return c.json(failure, failure.status);
  }
});

// PUT /api/facilities/:id/business-units/:businessUnitId
facilityRoutes.put("/:id/business-units/:businessUnitId", authMiddleware("admin"), async (c) => {
  const facilityId = c.req.param("id")!;
  const businessUnitId = c.req.param("businessUnitId")!;
  const parsed = UpdateBusinessUnitInputSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Datos de actualización de unidad inválidos", details: parsed.error.format() }, 400);
  try {
    const snapshot = await loadFacilitySnapshot(c.env, facilityId);
    if (!snapshot) return c.json({ error: `Instalación "${facilityId}" no encontrada` }, 404);
    const current = snapshot.businessUnits.find((unit) => unit.id === businessUnitId);
    if (!current) return c.json({ error: `Unidad "${businessUnitId}" no encontrada` }, 404);
    const updated = updateBusinessUnit({ current, updates: parsed.data, businessUnits: snapshot.businessUnits });
    if (snapshot.events.some((event) => event.businessUnitId === current.id && isEventVisible(event, new Date())) && updated.quotaType !== "contractual") {
      throw new BusinessRuleError("No se puede cambiar el tipo de cuota mientras la unidad tenga reservas vigentes");
    }
    const units = snapshot.businessUnits.map((unit) => unit.id === updated.id ? updated : unit);
    validateUnitCapacity(snapshot.facility.totalCapacity, units, snapshot.events);
    await updateBusinessUnitRecord(c.env, { unit: updated, current, expectedVersion: parsed.data.version, facilityVersion: snapshot.facilityVersion, actor: actor(c) });
    return c.json({ businessUnit: updated }, 200);
  } catch (error) {
    const failure = mutationOrRuleFailure(c, error, "No se pudo actualizar la unidad");
    return c.json(failure, failure.status);
  }
});

// PATCH /api/facilities/:id/business-units/:businessUnitId/status
facilityRoutes.patch("/:id/business-units/:businessUnitId/status", authMiddleware("admin"), async (c) => {
  const facilityId = c.req.param("id")!;
  const businessUnitId = c.req.param("businessUnitId")!;
  const parsed = DeactivateBusinessUnitInputSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Datos de retiro de unidad inválidos", details: parsed.error.format() }, 400);
  try {
    const snapshot = await loadFacilitySnapshot(c.env, facilityId);
    if (!snapshot) return c.json({ error: `Instalación "${facilityId}" no encontrada` }, 404);
    const current = snapshot.businessUnits.find((unit) => unit.id === businessUnitId);
    if (!current) return c.json({ error: `Unidad "${businessUnitId}" no encontrada` }, 404);
    const sessions = snapshot.activeSessions.filter((session) => session.businessUnitId === current.id).length;
    const exclusiveAreas = snapshot.areas.filter((area) => area.businessUnitId === current.id && area.isActive).length;
    const bookings = snapshot.events.filter((event) => event.businessUnitId === current.id && isEventVisible(event, new Date())).length;
    const dependencies = [
      sessions ? `${sessions} sesión activa${sessions === 1 ? "" : "es"}` : null,
      exclusiveAreas ? `${exclusiveAreas} área${exclusiveAreas === 1 ? "" : "s"} exclusiva${exclusiveAreas === 1 ? "" : "s"} activa${exclusiveAreas === 1 ? "" : "s"}` : null,
      bookings ? `${bookings} reserva${bookings === 1 ? "" : "s"} vigente${bookings === 1 ? "" : "s"}` : null,
    ].filter((dependency): dependency is string => Boolean(dependency));
    const retired = deactivateBusinessUnit(current, parsed.data.version, dependencies);
    await updateBusinessUnitRecord(c.env, { unit: retired, current, expectedVersion: parsed.data.version, facilityVersion: snapshot.facilityVersion, actor: actor(c) });
    return c.json({ businessUnit: retired }, 200);
  } catch (error) {
    const failure = mutationOrRuleFailure(c, error, "No se pudo retirar la unidad");
    return c.json(failure, failure.status);
  }
});

// GET /api/facilities/:id/areas
facilityRoutes.get("/:id/areas", async (c) => {
  const facilityId = c.req.param("id")!;
  try {
    const snapshot = await loadFacilitySnapshot(c.env, facilityId);
    if (!snapshot) return c.json({ error: `Instalación "${facilityId}" no encontrada` }, 404);
    const activeAreas = snapshot.areas.filter((area) => area.isActive);
    const allocatedCapacitySum = activeAreas.reduce((sum, area) => sum + area.allocatedCapacity, 0);
    const accessibleCapacity = accessibleCapacityOf(snapshot.categories);
    const typeCapacity = splitFacilityCapacity(snapshot.facility.totalCapacity, accessibleCapacity);
    const typeBuffer = calculateFacilityTypeBuffer(typeCapacity, activeAreas);
    const areas = snapshot.areas.map((area) => {
      const metrics = calculateAreaAvailability(area, snapshot.activeSessions, snapshot.categories);
      return {
        ...area,
        activeOccupancy: metrics.occupied,
        standardOccupied: metrics.standardOccupied,
        standardAvailable: metrics.standardAvailable,
        accessibleOccupied: metrics.accessibleOccupied,
        accessibleAvailable: metrics.accessibleAvailable,
        availableSlots: area.isActive ? metrics.available : 0,
        occupancyPercentage: area.isActive ? metrics.occupancyPercentage : 0,
        isSaturated: area.isActive && metrics.isSaturated,
      };
    });
    return c.json({ facilityId: snapshot.facility.id, totalCapacity: snapshot.facility.totalCapacity, allocatedCapacitySum,
      standardCapacity: typeCapacity.standardCapacity, accessibleCapacity: typeCapacity.accessibleCapacity,
      standardFloatingBuffer: typeBuffer.standardCapacity, accessibleFloatingBuffer: typeBuffer.accessibleCapacity,
      floatingBuffer: calculateFacilityBuffer(snapshot.facility.totalCapacity, activeAreas), areas });
  } catch (error) {
    const failure = readFailure(error, "No se pudieron cargar las áreas", c);
    return c.json(failure, failure.status);
  }
});

// POST /api/facilities/:id/areas
facilityRoutes.post("/:id/areas", async (c) => {
  const facilityId = c.req.param("id")!;
  const parsed = CreateParkingAreaInputSchema.safeParse({ ...(await c.req.json()), facilityId });
  if (!parsed.success) return c.json({ error: "Datos de área inválidos", details: parsed.error.format() }, 400);
  try {
    const snapshot = await loadFacilitySnapshot(c.env, facilityId);
    if (!snapshot) return c.json({ error: `Instalación "${facilityId}" no encontrada` }, 404);
    if (parsed.data.businessUnitId && !snapshot.businessUnits.some((unit) => unit.id === parsed.data.businessUnitId && unit.isActive)) {
      return c.json({ error: "La unidad asignada no está activa en esta instalación" }, 409);
    }
    const area = createParkingArea(parsed.data, snapshot.areas, splitFacilityCapacity(snapshot.facility.totalCapacity, accessibleCapacityOf(snapshot.categories)));
    await createAreaRecord(c.env, { area, facilityVersion: snapshot.facilityVersion, actor: actor(c) });
    return c.json({ area }, 201);
  } catch (error) {
    const failure = mutationOrRuleFailure(c, error, "No se pudo crear el área");
    return c.json(failure, failure.status);
  }
});

// PATCH /api/facilities/:id/areas/:areaId/capacity
facilityRoutes.patch("/:id/areas/:areaId/capacity", async (c) => {
  const facilityId = c.req.param("id")!;
  const areaId = c.req.param("areaId")!;
  const parsed = UpdateParkingAreaCapacityInputSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Datos de capacidad inválidos", details: parsed.error.format() }, 400);
  try {
    const snapshot = await loadFacilitySnapshot(c.env, facilityId);
    if (!snapshot) return c.json({ error: `Instalación "${facilityId}" no encontrada` }, 404);
    const targetArea = snapshot.areas.find((area) => area.id === areaId);
    if (!targetArea) return c.json({ error: `Área con ID "${areaId}" no encontrada` }, 404);
    const occupancy = occupancyBySpaceType(snapshot.activeSessions, snapshot.categories, areaId);
    const area = reallocateAreaCapacity({ areaId, newCapacity: parsed.data.allocatedCapacity,
      standardCapacity: parsed.data.standardCapacity, accessibleCapacity: parsed.data.accessibleCapacity,
      areas: snapshot.areas, facilityTotalCapacity: snapshot.facility.totalCapacity,
      facilityAccessibleCapacity: accessibleCapacityOf(snapshot.categories), activeOccupancy: occupancy.total,
      activeStandardOccupancy: occupancy.standard, activeAccessibleOccupancy: occupancy.accessible,
      expectedVersion: parsed.data.version });
    await updateAreaRecord(c.env, { area, expectedVersion: parsed.data.version, facilityVersion: snapshot.facilityVersion, actor: actor(c), before: targetArea });
    return c.json({ area }, 200);
  } catch (error) {
    const failure = mutationOrRuleFailure(c, error, "No se pudo ajustar la capacidad");
    return c.json(failure, failure.status);
  }
});

// PUT /api/facilities/:id/areas/:areaId
facilityRoutes.put("/:id/areas/:areaId", async (c) => {
  const facilityId = c.req.param("id")!;
  const areaId = c.req.param("areaId")!;
  const parsed = UpdateParkingAreaInputSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Datos de actualización de área inválidos", details: parsed.error.format() }, 400);
  try {
    const snapshot = await loadFacilitySnapshot(c.env, facilityId);
    if (!snapshot) return c.json({ error: `Instalación "${facilityId}" no encontrada` }, 404);
    const current = snapshot.areas.find((area) => area.id === areaId);
    if (!current) return c.json({ error: `Área con ID "${areaId}" no encontrada` }, 404);
    const occupancy = occupancyBySpaceType(snapshot.activeSessions, snapshot.categories, areaId);
    const area = updateParkingArea({ areaId, ...parsed.data, areas: snapshot.areas, facilityTotalCapacity: snapshot.facility.totalCapacity,
      facilityAccessibleCapacity: accessibleCapacityOf(snapshot.categories), activeOccupancy: occupancy.total,
      activeStandardOccupancy: occupancy.standard, activeAccessibleOccupancy: occupancy.accessible,
      expectedVersion: parsed.data.version });
    await updateAreaRecord(c.env, { area, expectedVersion: parsed.data.version, facilityVersion: snapshot.facilityVersion, actor: actor(c), before: current });
    return c.json({ area }, 200);
  } catch (error) {
    const failure = mutationOrRuleFailure(c, error, "No se pudo actualizar el área");
    return c.json(failure, failure.status);
  }
});

// PATCH /api/facilities/:id/areas/:areaId/status
facilityRoutes.patch("/:id/areas/:areaId/status", async (c) => {
  const facilityId = c.req.param("id")!;
  const areaId = c.req.param("areaId")!;
  const parsed = DeactivateParkingAreaInputSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Datos de estado de área inválidos", details: parsed.error.format() }, 400);
  try {
    const snapshot = await loadFacilitySnapshot(c.env, facilityId);
    if (!snapshot) return c.json({ error: `Instalación "${facilityId}" no encontrada` }, 404);
    const current = snapshot.areas.find((area) => area.id === areaId);
    if (!current) return c.json({ error: `Área con ID "${areaId}" no encontrada` }, 404);
    const occupancy = snapshot.activeSessions.filter((session) => session.parkingAreaId === areaId).length;
    const area = deactivateParkingArea({ areaId, areas: snapshot.areas, activeOccupancy: occupancy, expectedVersion: parsed.data.version });
    await updateAreaRecord(c.env, { area, expectedVersion: parsed.data.version, facilityVersion: snapshot.facilityVersion, actor: actor(c), before: current });
    return c.json({ area }, 200);
  } catch (error) {
    const failure = mutationOrRuleFailure(c, error, "No se pudo desactivar el área");
    return c.json(failure, failure.status);
  }
});

// GET /api/facilities/:id/events
facilityRoutes.get("/:id/events", authMiddleware("admin"), async (c) => {
  const facilityId = c.req.param("id")!;
  try {
    const snapshot = await loadFacilitySnapshot(c.env, facilityId);
    if (!snapshot) return c.json({ error: `Instalación "${facilityId}" no encontrada` }, 404);
    return c.json({ events: snapshot.events.sort((a, b) => a.startTime.localeCompare(b.startTime)) });
  } catch (error) {
    const failure = readFailure(error, "No se pudieron cargar las reservas", c);
    return c.json(failure, failure.status);
  }
});

// POST /api/facilities/:id/events
facilityRoutes.post("/:id/events", authMiddleware("admin"), async (c) => {
  const facilityId = c.req.param("id")!;
  const parsed = CreateEventBookingInputSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Datos de reserva inválidos", details: parsed.error.format() }, 400);
  try {
    const snapshot = await loadFacilitySnapshot(c.env, facilityId);
    if (!snapshot) return c.json({ error: `Instalación "${facilityId}" no encontrada` }, 404);
    if (!isContractualUnit(snapshot.businessUnits, parsed.data.businessUnitId)) {
      return c.json({ error: "La unidad de negocio debe estar activa y tener cuota contractual" }, 400);
    }
    const event: EventBooking = { ...parsed.data, id: crypto.randomUUID(), facilityId, status: "scheduled", version: 1 };
    validateEventBookingCapacity(event, snapshot.events, snapshot.facility.totalCapacity, guaranteedQuota(snapshot.businessUnits));
    await createEventRecord(c.env, { event, facilityVersion: snapshot.facilityVersion, actor: actor(c) });
    return c.json({ event }, 201);
  } catch (error) {
    const failure = mutationOrRuleFailure(c, error, "No se pudo crear la reserva");
    return c.json(failure, failure.status);
  }
});

// PUT /api/facilities/:id/events/:eventId
facilityRoutes.put("/:id/events/:eventId", authMiddleware("admin"), async (c) => {
  const facilityId = c.req.param("id")!;
  const eventId = c.req.param("eventId")!;
  const parsed = UpdateEventBookingInputSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Datos de actualización inválidos", details: parsed.error.format() }, 400);
  try {
    const snapshot = await loadFacilitySnapshot(c.env, facilityId);
    if (!snapshot) return c.json({ error: `Instalación "${facilityId}" no encontrada` }, 404);
    const current = snapshot.events.find((event) => event.id === eventId);
    if (!current) return c.json({ error: `Reserva "${eventId}" no encontrada` }, 404);
    if (!isContractualUnit(snapshot.businessUnits, parsed.data.businessUnitId)) {
      return c.json({ error: "La unidad de negocio debe estar activa y tener cuota contractual" }, 400);
    }
    const event = updateEventBooking({ current, updates: parsed.data, events: snapshot.events,
      facilityCapacity: snapshot.facility.totalCapacity, guaranteedQuota: guaranteedQuota(snapshot.businessUnits) });
    await updateEventRecord(c.env, { event, current, expectedVersion: parsed.data.version, facilityVersion: snapshot.facilityVersion, actor: actor(c) });
    return c.json({ event }, 200);
  } catch (error) {
    const failure = mutationOrRuleFailure(c, error, "No se pudo actualizar la reserva");
    return c.json(failure, failure.status);
  }
});

// PATCH /api/facilities/:id/events/:eventId/status
facilityRoutes.patch("/:id/events/:eventId/status", authMiddleware("admin"), async (c) => {
  const facilityId = c.req.param("id")!;
  const eventId = c.req.param("eventId")!;
  const parsed = CancelEventBookingInputSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Datos de cancelación inválidos", details: parsed.error.format() }, 400);
  try {
    const snapshot = await loadFacilitySnapshot(c.env, facilityId);
    if (!snapshot) return c.json({ error: `Instalación "${facilityId}" no encontrada` }, 404);
    const current = snapshot.events.find((event) => event.id === eventId);
    if (!current) return c.json({ error: `Reserva "${eventId}" no encontrada` }, 404);
    const event = cancelEventBooking(current, parsed.data.version);
    await updateEventRecord(c.env, { event, current, expectedVersion: parsed.data.version, facilityVersion: snapshot.facilityVersion, actor: actor(c) });
    return c.json({ event }, 200);
  } catch (error) {
    const failure = mutationOrRuleFailure(c, error, "No se pudo cancelar la reserva");
    return c.json(failure, failure.status);
  }
});

// GET /api/facilities/:id/catalogs
facilityRoutes.get("/:id/catalogs", async (c) => {
  const facilityId = c.req.param("id")!;
  try {
    const snapshot = await loadFacilityCatalogs(c.env, facilityId);
    if (!snapshot) return c.json({ error: `Instalación "${facilityId}" no encontrada` }, 404);
    return c.json({
      facility: snapshot.facility,
      categories: snapshot.categories,
      businessUnits: snapshot.businessUnits.filter((unit) => unit.isActive),
      areas: snapshot.areas.filter((area) => area.isActive),
      events: snapshot.events,
    });
  } catch (error) {
    const failure = readFailure(error, "No se pudo cargar el catálogo", c);
    return c.json(failure, failure.status);
  }
});
