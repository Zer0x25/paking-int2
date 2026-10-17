import { Hono } from "hono";
import { z } from "zod";
import { SyncMutationSchema } from "@core/types/schema";
import {
  createParkingSession,
  completeParkingSession,
  normalizeLicensePlate,
  updateActiveParkingSessionPlate,
} from "@core/models/parking-session";
import { authMiddleware } from "../middleware/auth";
import type { AppEnvironment } from "../types/app-environment";
import { mockSessionsRepo, parkingSessionAuditStore } from "./parking";

export const syncRoutes = new Hono<AppEnvironment>();
syncRoutes.use("*", authMiddleware());

const DeltaSyncPayloadSchema = z.object({
  facilityId: z.string().min(1),
  deviceId: z.string(),
  mutations: z.array(SyncMutationSchema),
}).strict();

// POST /api/sync/delta
syncRoutes.post("/delta", async (c) => {
  const body = await c.req.json();
  const parsed = DeltaSyncPayloadSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Payload de sincronización inválido", details: parsed.error.format() }, 400);
  }

  const { facilityId, deviceId, mutations } = parsed.data;
  const succeeded: string[] = [];
  const conflicts: Array<{ mutationId: string; reason: string }> = [];

  for (const mut of mutations) {
    try {
      if (mut.type === "VEHICLE_ENTRY") {
        const payload = mut.payload;
        const normPlate = normalizeLicensePlate(payload.licensePlate);

        // Check if already active
        const existing = mockSessionsRepo.find(
          (s) => s.facilityId === facilityId && s.licensePlate === normPlate && s.status === "active"
        );

        if (existing) {
          conflicts.push({
            mutationId: mut.id,
            reason: `Vehículo ${normPlate} ya se encuentra registrado activamente`,
          });
          continue;
        }

        const session = createParkingSession({
          id: mut.id,
          facilityId,
          businessUnitId: payload.businessUnitId,
          spaceCategoryId: payload.spaceCategoryId,
          parkingAreaId: payload.parkingAreaId,
          licensePlate: normPlate,
          entryTime: payload.entryTime || mut.clientTimestamp,
          operatorUserId: payload.operatorUserId || "offline-operator",
          deviceId,
        });

        mockSessionsRepo.push(session);
        const user = c.get("user");
        parkingSessionAuditStore.push({
          userId: user?.userId || payload.operatorUserId || "offline-operator",
          action: "created",
          facilityId,
          sessionId: session.id,
          after: session,
          createdAt: new Date().toISOString(),
        });
        succeeded.push(mut.id);
      } else if (mut.type === "VEHICLE_EXIT") {
        const payload = mut.payload;
        const normPlate = payload.licensePlate ? normalizeLicensePlate(payload.licensePlate) : "";
        const sessionIndex = mockSessionsRepo.findIndex((session) => {
          if (session.facilityId !== facilityId || session.status !== "active") return false;
          if (payload.sessionId) return session.id === payload.sessionId;
          return session.licensePlate === normPlate;
        });

        if (sessionIndex === -1) {
          conflicts.push({
            mutationId: mut.id,
            reason: payload.sessionId
              ? `No existe sesión activa para el egreso de la sesión ${payload.sessionId}`
              : `No existe sesión activa para el egreso de ${normPlate}`,
          });
          continue;
        }

        const currentSession = mockSessionsRepo[sessionIndex];
        if (payload.expectedVersion !== undefined && currentSession.version !== payload.expectedVersion) {
          conflicts.push({ mutationId: mut.id, reason: "La versión de la sesión cambió antes del egreso" });
          continue;
        }
        const updated = completeParkingSession(
          currentSession,
          payload.exitTime || mut.clientTimestamp
        );
        mockSessionsRepo[sessionIndex] = updated;
        const user = c.get("user");
        parkingSessionAuditStore.push({
          userId: user?.userId || payload.operatorUserId || "offline-operator",
          action: "exited",
          facilityId,
          sessionId: updated.id,
          before: currentSession,
          after: updated,
          createdAt: new Date().toISOString(),
        });
        succeeded.push(mut.id);
      } else if (mut.type === "VEHICLE_PLATE_UPDATE") {
        const payload = mut.payload;
        const sessionIndex = mockSessionsRepo.findIndex(
          (session) => session.id === payload.sessionId && session.facilityId === facilityId && session.status === "active"
        );
        if (sessionIndex === -1) {
          conflicts.push({ mutationId: mut.id, reason: "No existe una sesión activa para corregir" });
          continue;
        }

        const currentSession = mockSessionsRepo[sessionIndex];
        const updated = updateActiveParkingSessionPlate({
          currentSession,
          licensePlate: payload.licensePlate,
          existingSessions: mockSessionsRepo,
          expectedVersion: payload.expectedVersion,
        });
        mockSessionsRepo[sessionIndex] = updated;
        const user = c.get("user");
        parkingSessionAuditStore.push({
          userId: user?.userId || payload.operatorUserId || "offline-operator",
          action: "plate_updated",
          facilityId,
          sessionId: updated.id,
          before: { licensePlate: currentSession.licensePlate },
          after: { licensePlate: updated.licensePlate },
          createdAt: new Date().toISOString(),
        });
        succeeded.push(mut.id);
      }
    } catch (err: unknown) {
      conflicts.push({
        mutationId: mut.id,
        reason: err instanceof Error ? err.message : "Error al procesar mutación",
      });
    }
  }

  return c.json({
    processed: mutations.length,
    succeeded,
    conflicts,
  });
});
