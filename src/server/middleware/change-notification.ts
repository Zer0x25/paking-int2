import type { Context, Next } from "hono";
import type { AppEnvironment } from "../types/app-environment";

const CLIENT_ID_PATTERN = /^[A-Za-z0-9._-]{1,80}$/;

function facilityFromCreateResponse(response: Response): Promise<string | null> {
  return response.clone().json().then((body: unknown) => {
    if (typeof body !== "object" || body === null || !("facility" in body)) return null;
    const facility = (body as { facility?: unknown }).facility;
    if (typeof facility !== "object" || facility === null || !("id" in facility)) return null;
    const id = (facility as { id?: unknown }).id;
    return typeof id === "string" && id.length > 0 ? id : null;
  }).catch(() => null);
}

export function publishFacilityChange() {
  return async (c: Context<AppEnvironment>, next: Next) => {
    const method = c.req.method;
    const isMutation = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
    const path = c.req.path;
    const isDataMutation = path.startsWith("/api/facilities") || path.startsWith("/api/parking-sessions") || path.startsWith("/api/sync/");
    if (!isMutation || !isDataMutation) return await next();

    await next();
    const response = c.res;
    const identity = c.get("user");
    if (!response.ok || !identity?.facilityId) return response;

    if (path.startsWith("/api/sync/")) {
      const result = await response.clone().json().catch(() => null) as { succeeded?: unknown } | null;
      if (!Array.isArray(result?.succeeded) || result.succeeded.length === 0) return response;
    }

    const facilityId = path === "/api/facilities" && method === "POST"
      ? await facilityFromCreateResponse(response) ?? identity.facilityId
      : identity.facilityId;
    const suppliedClientId = c.req.header("X-Client-Id") || "server";
    const event = {
      schemaVersion: 1,
      type: "facility.changed",
      facilityId,
      changeId: crypto.randomUUID(),
      sourceClientId: CLIENT_ID_PATTERN.test(suppliedClientId) ? suppliedClientId : "server",
    } as const;

    try {
      const namespace = c.env.FACILITY_EVENTS;
      if (!namespace) throw new Error("binding unavailable");
      const stub = namespace.get(namespace.idFromName(facilityId));
      const publishRequest = new Request("https://facility-events.internal/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(event),
      });
      const result = await stub.fetch(publishRequest);
      if (!result.ok) throw new Error("publish rejected");
    } catch {
      console.error(JSON.stringify({ event: "facility_change_broadcast_failed", facilityId }));
    }
    return response;
  };
}
