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
import { loadFacilitySnapshot } from "../db/repositories/catalog-repository";
import { createSessionRecord, findActiveSessionByPlate, getSession, updateSessionRecord } from "../db/repositories/session-repository";
import { fingerprintMutation, getMutationReceipt } from "../db/repositories/sync-repository";
import { checkAllocationAvailability } from "../services/allocation-service";
import { PersistenceConflictError } from "../db/repositories/write-transaction";
import { mutationFailure } from "./http-errors";

export const syncRoutes = new Hono<AppEnvironment>();
syncRoutes.use("*", authMiddleware());

const DeltaSyncPayloadSchema = z.object({
  facilityId: z.string().min(1),
  deviceId: z.string(),
  mutations: z.array(SyncMutationSchema),
}).strict();

class SyncRuleConflict extends Error {}

function isConstraintConflict(error: unknown): boolean {
  return error instanceof Error && /UNIQUE constraint|FOREIGN KEY constraint|CHECK constraint/i.test(error.message);
}

// POST /api/sync/delta
syncRoutes.post("/delta", async (c) => {
  const parsed = DeltaSyncPayloadSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Payload de sincronización inválido", details: parsed.error.format() }, 400);

  const { facilityId, deviceId, mutations } = parsed.data;
  const succeeded: string[] = [];
  const conflicts: Array<{ mutationId: string; reason: string }> = [];
  const userId = c.get("user").userId;

  for (const mutation of mutations) {
    const fingerprint = await fingerprintMutation(mutation);
    try {
      const prior = await getMutationReceipt(c.env, facilityId, mutation.id);
      if (prior) {
        if (prior.mutationType === mutation.type && prior.payloadFingerprint === fingerprint) succeeded.push(mutation.id);
        else conflicts.push({ mutationId: mutation.id, reason: "El identificador de mutación ya se utilizó con otro contenido" });
        continue;
      }

      const payloadFacility = mutation.payload.facilityId;
      if (payloadFacility && payloadFacility !== facilityId) throw new SyncRuleConflict("La mutación pertenece a otro recinto");
      const snapshot = await loadFacilitySnapshot(c.env, facilityId);
      if (!snapshot) throw new SyncRuleConflict(`Instalación "${facilityId}" no encontrada`);
      const processedAt = new Date().toISOString();

      if (mutation.type === "VEHICLE_ENTRY") {
        const payload = mutation.payload;
        const plate = normalizeLicensePlate(payload.licensePlate);
        const selectedCategory = snapshot.categories.find((category) => category.id === payload.spaceCategoryId);
        if (!selectedCategory) {
          throw new SyncRuleConflict("Categoría de estacionamiento no reconocida en la instalación");
        }
        if (selectedCategory.code !== "STD" && selectedCategory.code !== "ACC") {
          throw new SyncRuleConflict("Solo se admiten espacios Estándar o Accesibles para nuevas entradas");
        }
        if (payload.parkingAreaId) {
          const area = snapshot.areas.find((item) => item.id === payload.parkingAreaId);
          if (!area || !area.isActive) throw new SyncRuleConflict("Área de estacionamiento no disponible");
        }
        if (await findActiveSessionByPlate(c.env, facilityId, plate)) {
          throw new SyncRuleConflict(`Vehículo ${plate} ya se encuentra registrado activamente`);
        }
        const allocation = checkAllocationAvailability(snapshot, payload.businessUnitId, payload.parkingAreaId, selectedCategory.code);
        if (!allocation.allowed) throw new SyncRuleConflict(allocation.reason ?? "No hay capacidad disponible");
        const session = createParkingSession({
          id: mutation.id,
          facilityId,
          businessUnitId: payload.businessUnitId,
          spaceCategoryId: payload.spaceCategoryId,
          parkingAreaId: payload.parkingAreaId,
          licensePlate: plate,
          entryTime: payload.entryTime || mutation.clientTimestamp,
          operatorUserId: payload.operatorUserId || userId,
          deviceId,
        });
        await createSessionRecord(c.env, {
          session,
          facilityVersion: snapshot.facilityVersion,
          actor: { userId },
          mutation: { fingerprint, result: { session }, processedAt },
        });
      } else if (mutation.type === "VEHICLE_EXIT") {
        const payload = mutation.payload;
        const plate = payload.licensePlate ? normalizeLicensePlate(payload.licensePlate) : "";
        const current = payload.sessionId
          ? await getSession(c.env, facilityId, payload.sessionId)
          : await findActiveSessionByPlate(c.env, facilityId, plate);
        if (!current || current.status !== "active") {
          throw new SyncRuleConflict(payload.sessionId
            ? `No existe sesión activa para el egreso de la sesión ${payload.sessionId}`
            : `No existe sesión activa para el egreso de ${plate}`);
        }
        if (payload.expectedVersion !== undefined && current.version !== payload.expectedVersion) {
          throw new SyncRuleConflict("La versión de la sesión cambió antes del egreso");
        }
        const updated = completeParkingSession(current, payload.exitTime || mutation.clientTimestamp);
        await updateSessionRecord(c.env, {
          session: updated,
          before: current,
          expectedSessionVersion: current.version,
          facilityVersion: snapshot.facilityVersion,
          actor: { userId },
          action: "exited",
          mutation: { id: mutation.id, type: mutation.type, fingerprint, result: { session: updated }, processedAt },
        });
      } else {
        const payload = mutation.payload;
        const current = await getSession(c.env, facilityId, payload.sessionId);
        if (!current || current.status !== "active") throw new SyncRuleConflict("No existe una sesión activa para corregir");
        if (current.version !== payload.expectedVersion) throw new SyncRuleConflict("La versión de la sesión cambió antes de corregir la patente");
        const updated = updateActiveParkingSessionPlate({
          currentSession: current,
          licensePlate: payload.licensePlate,
          existingSessions: snapshot.activeSessions,
          expectedVersion: payload.expectedVersion,
        });
        await updateSessionRecord(c.env, {
          session: updated,
          before: current,
          expectedSessionVersion: current.version,
          facilityVersion: snapshot.facilityVersion,
          actor: { userId },
          action: "plate_updated",
          mutation: { id: mutation.id, type: mutation.type, fingerprint, result: { session: updated }, processedAt },
        });
      }
      succeeded.push(mutation.id);
    } catch (error) {
      if (error instanceof SyncRuleConflict || error instanceof PersistenceConflictError || isConstraintConflict(error)) {
        conflicts.push({ mutationId: mutation.id, reason: error instanceof Error ? error.message : "Conflicto de sincronización" });
        continue;
      }
      const failure = mutationFailure(error, "No se pudo guardar la sincronización", c);
      return c.json({ ...failure, mutationId: mutation.id }, failure.status);
    }
  }

  return c.json({ processed: mutations.length, succeeded, conflicts });
});
