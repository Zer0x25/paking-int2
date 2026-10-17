import { Hono } from "hono";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth";
import {
  createParkingSession,
  completeParkingSession,
  normalizeLicensePlate,
  updateActiveParkingSessionPlate,
} from "@core/models/parking-session";
import { LicensePlateInputSchema } from "@core/types/schema";
import { checkAllocationAvailability } from "../services/allocation-service";
import type { AppEnvironment } from "../types/app-environment";
import { loadFacilitySnapshot } from "../db/repositories/catalog-repository";
import {
  createSessionRecord,
  findActiveSessionByPlate,
  getSession,
  listActiveSessions,
  updateSessionRecord,
} from "../db/repositories/session-repository";
import { mutationFailure, readFailure } from "./http-errors";

export const parkingRoutes = new Hono<AppEnvironment>();
parkingRoutes.use("*", authMiddleware());

const EntryRequestSchema = z.object({
  id: z.string().min(1).optional(),
  facilityId: z.string().min(1),
  businessUnitId: z.string().min(1),
  spaceCategoryId: z.string().min(1),
  parkingAreaId: z.string().nullable().optional(),
  licensePlate: LicensePlateInputSchema,
  entryTime: z.string().datetime().optional(),
  deviceId: z.string().optional(),
}).strict();

const ExitRequestSchema = z.object({
  facilityId: z.string().min(1),
  licensePlate: LicensePlateInputSchema,
  exitTime: z.string().datetime().optional(),
  deviceId: z.string().optional(),
}).strict();

const SessionActionRequestSchema = z.object({
  facilityId: z.string().min(1),
  expectedVersion: z.number().int().positive(),
  exitTime: z.string().datetime().optional(),
}).strict();

const PlateCorrectionRequestSchema = z.object({
  facilityId: z.string().min(1),
  licensePlate: LicensePlateInputSchema,
  expectedVersion: z.number().int().positive(),
}).strict();

// GET /api/parking-sessions/active?facilityId=...
parkingRoutes.get("/active", async (c) => {
  const facilityId = c.req.query("facilityId");
  if (!facilityId) return c.json({ error: "facilityId es requerido" }, 400);
  try {
    const sessions = await listActiveSessions(c.env, facilityId);
    return c.json({ sessions, count: sessions.length });
  } catch (error) {
    const failure = readFailure(error, "No se pudieron cargar las sesiones activas");
    return c.json(failure, failure.status);
  }
});

// POST /api/parking-sessions/entry
parkingRoutes.post("/entry", async (c) => {
  const parsed = EntryRequestSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Datos de entrada inválidos", details: parsed.error.format() }, 400);

  const data = parsed.data;
  const plate = normalizeLicensePlate(data.licensePlate);
  try {
    const snapshot = await loadFacilitySnapshot(c.env, data.facilityId);
    if (!snapshot) return c.json({ error: `Instalación "${data.facilityId}" no encontrada` }, 404);
    if (!snapshot.categories.some((category) => category.id === data.spaceCategoryId)) {
      return c.json({ error: "Categoría de estacionamiento no reconocida en la instalación" }, 409);
    }
    if (data.parkingAreaId) {
      const area = snapshot.areas.find((item) => item.id === data.parkingAreaId);
      if (!area || !area.isActive) return c.json({ error: "Área de estacionamiento no disponible" }, 409);
    }

    const existing = await findActiveSessionByPlate(c.env, data.facilityId, plate);
    if (existing) return c.json({ error: `El vehículo con patente ${plate} ya se encuentra activo adentro` }, 409);

    const allocation = checkAllocationAvailability(snapshot, data.businessUnitId, data.parkingAreaId);
    if (!allocation.allowed) return c.json({ error: allocation.reason }, 409);

    const session = createParkingSession({
      id: data.id,
      facilityId: data.facilityId,
      businessUnitId: data.businessUnitId,
      spaceCategoryId: data.spaceCategoryId,
      parkingAreaId: data.parkingAreaId,
      licensePlate: plate,
      entryTime: data.entryTime,
      operatorUserId: c.get("user").userId,
      deviceId: data.deviceId || "gate-default",
    });
    await createSessionRecord(c.env, {
      session,
      facilityVersion: snapshot.facilityVersion,
      actor: { userId: c.get("user").userId },
    });
    return c.json({
      session,
      ticket: {
        ticketNumber: `TK-${Date.now().toString().slice(-6)}`,
        plate: session.licensePlate,
        entryTime: session.entryTime,
      },
    }, 201);
  } catch (error) {
    const failure = mutationFailure(error, "No se pudo registrar la entrada");
    return c.json(failure, failure.status);
  }
});

// POST /api/parking-sessions/exit
parkingRoutes.post("/exit", async (c) => {
  const parsed = ExitRequestSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Datos de salida inválidos", details: parsed.error.format() }, 400);

  const { facilityId, licensePlate, exitTime } = parsed.data;
  const plate = normalizeLicensePlate(licensePlate);
  try {
    const current = await findActiveSessionByPlate(c.env, facilityId, plate);
    if (!current) return c.json({ error: `No se encontró una sesión activa para la patente ${plate}` }, 404);
    const snapshot = await loadFacilitySnapshot(c.env, facilityId);
    if (!snapshot) return c.json({ error: `Instalación "${facilityId}" no encontrada` }, 404);
    const updated = completeParkingSession(current, exitTime);
    await updateSessionRecord(c.env, {
      session: updated,
      before: current,
      expectedSessionVersion: current.version,
      facilityVersion: snapshot.facilityVersion,
      actor: { userId: c.get("user").userId },
      action: "exited",
    });
    return c.json({ session: updated, durationMinutes: updated.durationMinutes });
  } catch (error) {
    const failure = mutationFailure(error, "No se pudo registrar la salida");
    return c.json(failure, failure.status);
  }
});

// POST /api/parking-sessions/:sessionId/exit
parkingRoutes.post("/:sessionId/exit", async (c) => {
  const parsed = SessionActionRequestSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Datos de salida inválidos", details: parsed.error.format() }, 400);
  const { facilityId, expectedVersion, exitTime } = parsed.data;
  try {
    const current = await getSession(c.env, facilityId, c.req.param("sessionId"));
    if (!current || current.status !== "active") return c.json({ error: "No se encontró una sesión activa para el vehículo seleccionado" }, 404);
    if (current.version !== expectedVersion) return c.json({ error: "La versión de la sesión cambió; actualice la lista e inténtelo nuevamente" }, 409);
    const snapshot = await loadFacilitySnapshot(c.env, facilityId);
    if (!snapshot) return c.json({ error: `Instalación "${facilityId}" no encontrada` }, 404);
    const updated = completeParkingSession(current, exitTime);
    await updateSessionRecord(c.env, {
      session: updated,
      before: current,
      expectedSessionVersion: expectedVersion,
      facilityVersion: snapshot.facilityVersion,
      actor: { userId: c.get("user").userId },
      action: "exited",
    });
    return c.json({ session: updated, durationMinutes: updated.durationMinutes });
  } catch (error) {
    const failure = mutationFailure(error, "No se pudo registrar la salida");
    return c.json(failure, failure.status);
  }
});

// PATCH /api/parking-sessions/:sessionId/plate
parkingRoutes.patch("/:sessionId/plate", async (c) => {
  const parsed = PlateCorrectionRequestSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Datos de corrección de patente inválidos", details: parsed.error.format() }, 400);
  const { facilityId, licensePlate, expectedVersion } = parsed.data;
  try {
    const current = await getSession(c.env, facilityId, c.req.param("sessionId"));
    if (!current) return c.json({ error: "No se encontró la sesión de estacionamiento" }, 404);
    if (current.status !== "active") return c.json({ error: "Solo se puede corregir la patente de una sesión activa" }, 404);
    if (current.version !== expectedVersion) return c.json({ error: "La versión de la sesión cambió; actualice la lista e inténtelo nuevamente" }, 409);
    const activeSessions = await listActiveSessions(c.env, facilityId);
    const updated = updateActiveParkingSessionPlate({ currentSession: current, licensePlate, existingSessions: activeSessions, expectedVersion });
    const snapshot = await loadFacilitySnapshot(c.env, facilityId);
    if (!snapshot) return c.json({ error: `Instalación "${facilityId}" no encontrada` }, 404);
    await updateSessionRecord(c.env, {
      session: updated,
      before: current,
      expectedSessionVersion: expectedVersion,
      facilityVersion: snapshot.facilityVersion,
      actor: { userId: c.get("user").userId },
      action: "plate_updated",
    });
    return c.json({ session: updated });
  } catch (error) {
    if (error instanceof Error && /ya está activa/i.test(error.message)) return c.json({ error: error.message }, 409);
    const failure = mutationFailure(error, "No se pudo corregir la patente");
    return c.json(failure, failure.status);
  }
});
