import { Hono } from "hono";
import { z } from "zod";
import { SyncMutationSchema } from "@core/types/schema";
import {
  createParkingSession,
  completeParkingSession,
  normalizeLicensePlate,
} from "@core/models/parking-session";
import { mockSessionsRepo } from "./parking";

export const syncRoutes = new Hono();

const DeltaSyncPayloadSchema = z.object({
  facilityId: z.string().min(1),
  deviceId: z.string(),
  mutations: z.array(SyncMutationSchema),
});

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
        const normPlate = normalizeLicensePlate(payload.licensePlate || "");

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
          licensePlate: normPlate,
          entryTime: payload.entryTime || mut.clientTimestamp,
          operatorUserId: payload.operatorUserId || "offline-operator",
          deviceId,
        });

        mockSessionsRepo.push(session);
        succeeded.push(mut.id);
      } else if (mut.type === "VEHICLE_EXIT") {
        const payload = mut.payload;
        const normPlate = normalizeLicensePlate(payload.licensePlate || "");

        const sessionIndex = mockSessionsRepo.findIndex(
          (s) => s.facilityId === facilityId && s.licensePlate === normPlate && s.status === "active"
        );

        if (sessionIndex === -1) {
          conflicts.push({
            mutationId: mut.id,
            reason: `No existe sesión activa para el egreso de ${normPlate}`,
          });
          continue;
        }

        const currentSession = mockSessionsRepo[sessionIndex];
        const updated = completeParkingSession(
          currentSession,
          payload.exitTime || mut.clientTimestamp
        );
        mockSessionsRepo[sessionIndex] = updated;
        succeeded.push(mut.id);
      }
    } catch (err: any) {
      conflicts.push({
        mutationId: mut.id,
        reason: err.message || "Error al procesar mutación",
      });
    }
  }

  return c.json({
    processed: mutations.length,
    succeeded,
    conflicts,
  });
});
