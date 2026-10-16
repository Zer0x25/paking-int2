import { Hono } from "hono";
import { z } from "zod";
import {
  createParkingSession,
  completeParkingSession,
  normalizeLicensePlate,
} from "@core/models/parking-session";
import type { ParkingSession } from "@core/types/schema";
import { checkAllocationAvailability } from "../services/allocation-service";

export const parkingRoutes = new Hono<{ Bindings: any }>();

// In-memory fallback repository for dev/test when D1 binding is not passed
export const mockSessionsRepo: ParkingSession[] = [];

const EntryRequestSchema = z.object({
  id: z.string().min(1).optional(),
  facilityId: z.string().min(1),
  businessUnitId: z.string().min(1),
  spaceCategoryId: z.string().min(1),
  licensePlate: z.string().min(3),
  entryTime: z.string().datetime().optional(),
  deviceId: z.string().optional(),
});

const ExitRequestSchema = z.object({
  facilityId: z.string().min(1),
  licensePlate: z.string().min(3),
  exitTime: z.string().datetime().optional(),
  deviceId: z.string().optional(),
});

// GET /api/parking-sessions/active?facilityId=...
parkingRoutes.get("/active", (c) => {
  const facilityId = c.req.query("facilityId");
  if (!facilityId) {
    return c.json({ error: "facilityId es requerido" }, 400);
  }

  const active = mockSessionsRepo.filter(
    (s) => s.facilityId === facilityId && s.status === "active"
  );
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
    licensePlate: normPlate,
    entryTime: data.entryTime,
    operatorUserId: (c.get as any)("user")?.userId || "op-local",
    deviceId: data.deviceId || "gate-default",
  });

  mockSessionsRepo.push(session);

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

  return c.json({
    session: updatedSession,
    durationMinutes: updatedSession.durationMinutes,
  });
});
