import { Hono, type Context } from "hono";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth";
import {
  createParkingSession,
  completeParkingSession,
  normalizeLicensePlate,
  updateActiveParkingSessionPlate,
} from "@core/models/parking-session";
import { LicensePlateInputSchema, type ParkingSession } from "@core/types/schema";
import { checkAllocationAvailability } from "../services/allocation-service";
import type { AppEnvironment } from "../types/app-environment";

export const parkingRoutes = new Hono<AppEnvironment>();

// In-memory fallback repository for dev/test when D1 binding is not passed
export const mockSessionsRepo: ParkingSession[] = [];
export interface ParkingSessionAuditEntry {
  userId: string;
  action: "created" | "exited" | "plate_updated";
  facilityId: string;
  sessionId: string;
  before?: Partial<ParkingSession>;
  after: Partial<ParkingSession>;
  createdAt: string;
}
export const parkingSessionAuditStore: ParkingSessionAuditEntry[] = [];

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

function recordSessionAudit(
  c: Context<AppEnvironment>,
  entry: Omit<ParkingSessionAuditEntry, "userId" | "createdAt">
) {
  const user = c.get("user");
  parkingSessionAuditStore.push({
    ...entry,
    userId: user?.userId || "unknown-operator",
    createdAt: new Date().toISOString(),
  });
}

// GET /api/parking-sessions/active?facilityId=...
parkingRoutes.get("/active", (c) => {
  const facilityId = c.req.query("facilityId");
  if (!facilityId) {
    return c.json({ error: "facilityId es requerido" }, 400);
  }

  const active = mockSessionsRepo.filter(
    (s) => s.facilityId === facilityId && s.status === "active"
  ).sort((a, b) => b.entryTime.localeCompare(a.entryTime));
  return c.json({ sessions: active, count: active.length });
});

// POST /api/parking-sessions/entry
parkingRoutes.post("/entry", async (c) => {
  const body = await c.req.json();
  const parsed = EntryRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Datos de entrada inválidos", details: parsed.error.format() }, 400);
  }

  const data = parsed.data;
  const normPlate = normalizeLicensePlate(data.licensePlate);

  // Check duplicate active session
  const alreadyInside = mockSessionsRepo.find(
    (s) => s.facilityId === data.facilityId && s.licensePlate === normPlate && s.status === "active"
  );
  if (alreadyInside) {
    return c.json(
      { error: `El vehículo con patente ${normPlate} ya se encuentra activo adentro` },
      409
    );
  }

  // Quota allocation check (US2 integration)
  const quotaCheck = checkAllocationAvailability(data.facilityId, data.businessUnitId, mockSessionsRepo);
  if (!quotaCheck.allowed) {
    return c.json({ error: quotaCheck.reason }, 409);
  }

  const session = createParkingSession({
    id: data.id,
    facilityId: data.facilityId,
    businessUnitId: data.businessUnitId,
    spaceCategoryId: data.spaceCategoryId,
    parkingAreaId: data.parkingAreaId,
    licensePlate: normPlate,
    entryTime: data.entryTime,
    operatorUserId: c.get("user").userId || "op-local",
    deviceId: data.deviceId || "gate-default",
  });

  mockSessionsRepo.push(session);
  recordSessionAudit(c, {
    action: "created",
    facilityId: session.facilityId,
    sessionId: session.id,
    after: session,
  });

  return c.json(
    {
      session,
      ticket: {
        ticketNumber: `TK-${Date.now().toString().slice(-6)}`,
        plate: session.licensePlate,
        entryTime: session.entryTime,
      },
    },
    201
  );
});

// POST /api/parking-sessions/exit
parkingRoutes.post("/exit", async (c) => {
  const body = await c.req.json();
  const parsed = ExitRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Datos de salida inválidos", details: parsed.error.format() }, 400);
  }

  const { facilityId, licensePlate, exitTime } = parsed.data;
  const normPlate = normalizeLicensePlate(licensePlate);

  const sessionIndex = mockSessionsRepo.findIndex(
    (s) => s.facilityId === facilityId && s.licensePlate === normPlate && s.status === "active"
  );

  if (sessionIndex === -1) {
    return c.json(
      { error: `No se encontró una sesión activa para la patente ${normPlate}` },
      404
    );
  }

  const currentSession = mockSessionsRepo[sessionIndex];
  const updatedSession = completeParkingSession(currentSession, exitTime);
  mockSessionsRepo[sessionIndex] = updatedSession;
  recordSessionAudit(c, {
    action: "exited",
    facilityId,
    sessionId: updatedSession.id,
    before: currentSession,
    after: updatedSession,
  });

  return c.json({
    session: updatedSession,
    durationMinutes: updatedSession.durationMinutes,
  });
});

// POST /api/parking-sessions/:sessionId/exit
parkingRoutes.post("/:sessionId/exit", async (c) => {
  const body = await c.req.json();
  const parsed = SessionActionRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Datos de salida inválidos", details: parsed.error.format() }, 400);
  }

  const { facilityId, expectedVersion, exitTime } = parsed.data;
  const sessionIndex = mockSessionsRepo.findIndex(
    (session) => session.id === c.req.param("sessionId") && session.facilityId === facilityId
  );
  if (sessionIndex === -1 || mockSessionsRepo[sessionIndex].status !== "active") {
    return c.json({ error: "No se encontró una sesión activa para el vehículo seleccionado" }, 404);
  }

  const currentSession = mockSessionsRepo[sessionIndex];
  if (currentSession.version !== expectedVersion) {
    return c.json({ error: "La versión de la sesión cambió; actualice la lista e inténtelo nuevamente" }, 409);
  }

  const updatedSession = completeParkingSession(currentSession, exitTime);
  mockSessionsRepo[sessionIndex] = updatedSession;
  recordSessionAudit(c, {
    action: "exited",
    facilityId,
    sessionId: updatedSession.id,
    before: currentSession,
    after: updatedSession,
  });
  return c.json({ session: updatedSession, durationMinutes: updatedSession.durationMinutes });
});

// PATCH /api/parking-sessions/:sessionId/plate
parkingRoutes.patch("/:sessionId/plate", async (c) => {
  const body = await c.req.json();
  const parsed = PlateCorrectionRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Datos de corrección de patente inválidos", details: parsed.error.format() }, 400);
  }

  const { facilityId, licensePlate, expectedVersion } = parsed.data;
  const sessionIndex = mockSessionsRepo.findIndex(
    (session) => session.id === c.req.param("sessionId") && session.facilityId === facilityId
  );
  if (sessionIndex === -1) {
    return c.json({ error: "No se encontró la sesión de estacionamiento" }, 404);
  }

  const currentSession = mockSessionsRepo[sessionIndex];
  if (currentSession.status !== "active") {
    return c.json({ error: "Solo se puede corregir la patente de una sesión activa" }, 404);
  }
  if (currentSession.version !== expectedVersion) {
    return c.json({ error: "La versión de la sesión cambió; actualice la lista e inténtelo nuevamente" }, 409);
  }

  try {
    const updatedSession = updateActiveParkingSessionPlate({
      currentSession,
      licensePlate,
      existingSessions: mockSessionsRepo,
      expectedVersion,
    });
    mockSessionsRepo[sessionIndex] = updatedSession;
    recordSessionAudit(c, {
      action: "plate_updated",
      facilityId,
      sessionId: updatedSession.id,
      before: { licensePlate: currentSession.licensePlate },
      after: { licensePlate: updatedSession.licensePlate },
    });
    return c.json({ session: updatedSession });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo corregir la patente";
    return c.json({ error: message }, /ya está activa/i.test(message) ? 409 : 400);
  }
});
