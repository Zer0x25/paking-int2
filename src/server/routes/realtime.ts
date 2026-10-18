import { Hono } from "hono";
import { verifyJwt } from "../middleware/auth";
import type { AppEnvironment } from "../types/app-environment";
import { logServerError } from "../middleware/request-logging";
import { GENERIC_SERVER_ERROR } from "./http-errors";
import { isFacilityActive } from "../db/repositories/catalog-repository";

export const realtimeRoutes = new Hono<AppEnvironment>();
const CLIENT_ID_PATTERN = /^[A-Za-z0-9._-]{1,80}$/;

realtimeRoutes.get("/:facilityId", async (c) => {
  if (c.req.header("Upgrade")?.toLowerCase() !== "websocket") {
    return c.json({ error: "Se requiere una conexión WebSocket" }, 426);
  }

  const offered = (c.req.header("Sec-WebSocket-Protocol") || "").split(",").map((part) => part.trim()).filter(Boolean);
  if (offered[0] !== "parking-events-v1" || !offered[1]) {
    return c.json({ error: "Token de autorización requerido" }, 401);
  }

  const secret = c.env?.JWT_SECRET;
  if (!secret) {
    logServerError(c, new Error("JWT signing secret is not configured"));
    return c.json({ error: GENERIC_SERVER_ERROR, status: 500 }, 500);
  }
  const identity = await verifyJwt(offered[1], secret);
  if (!identity) return c.json({ error: "Token inválido o expirado" }, 401);

  const clientId = offered[2];
  if (!clientId || !CLIENT_ID_PATTERN.test(clientId)) {
    return c.json({ error: "Identificador de cliente inválido" }, 403);
  }

  const facilityId = c.req.param("facilityId");
  if (!facilityId || identity.facilityId !== facilityId) {
    return c.json({ error: "No tiene acceso a este recinto" }, 403);
  }
  const namespace = c.env.FACILITY_EVENTS;
  if (!namespace) {
    logServerError(c, new Error("Facility event namespace binding is unavailable"), 503);
    return c.json({ error: "Servicio temporalmente no disponible" }, 503);
  }
  if (!await isFacilityActive(c.env, facilityId)) {
    return c.json({ error: "El recinto no está activo" }, 404);
  }
  const stub = namespace.get(namespace.idFromName(facilityId));
  const request = new Request("https://facility-events.internal/connect", {
    headers: {
      Upgrade: "websocket",
      "Sec-WebSocket-Protocol": "parking-events-v1",
      "X-Facility-Id": facilityId,
      "X-Client-Id": clientId,
    },
  });
  return await stub.fetch(request);
});
