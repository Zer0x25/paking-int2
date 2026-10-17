import { beforeEach, describe, expect, it } from "vitest";
import app from "@server/index";
import { signJwt } from "@server/middleware/auth";
import { mockSessionsRepo, parkingSessionAuditStore } from "@server/routes/parking";

describe("Gate parking operations API", () => {
  const facilityId = "fac-default-01";
  const businessUnitId = "bu-hotel-01";
  const spaceCategoryId = "cat-std";
  let token: string;

  beforeEach(async () => {
    mockSessionsRepo.splice(0, mockSessionsRepo.length);
    parkingSessionAuditStore.splice(0, parkingSessionAuditStore.length);
    token = await signJwt(
      { userId: "operator-01", username: "operador", role: "operator", facilityId },
      "supersecret_jwt_key_local_development"
    );
  });

  const authHeaders = () => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" });

  const createEntry = async (id: string, licensePlate: string, entryTime: string) => app.request(
    "/api/parking-sessions/entry",
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ id, facilityId, businessUnitId, spaceCategoryId, licensePlate, entryTime }),
    }
  );

  it("requires authentication to list active sessions", async () => {
    const response = await app.request(`/api/parking-sessions/active?facilityId=${facilityId}`);
    expect(response.status).toBe(401);
  });

  it("rejects a correctly shaped token signed with the wrong key", async () => {
    const invalidToken = await signJwt(
      { userId: "operator-01", username: "operador", role: "operator", facilityId },
      "different-secret-key"
    );
    const response = await app.request(`/api/parking-sessions/active?facilityId=${facilityId}`, {
      headers: { Authorization: `Bearer ${invalidToken}` },
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: "Token inválido o expirado" });
  });

  it("lists only active sessions by newest entry first", async () => {
    await createEntry("session-old", "AA1A11", "2026-10-17T09:00:00.000Z");
    await createEntry("session-new", "11AAA1", "2026-10-17T10:00:00.000Z");
    const response = await app.request(`/api/parking-sessions/active?facilityId=${facilityId}`, { headers: authHeaders() });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.sessions.map((session: { id: string }) => session.id)).toEqual(["session-new", "session-old"]);
    expect(body.count).toBe(2);
  });

  it("rejects a plate that is not exactly six alphanumeric characters on entry", async () => {
    const response = await createEntry("session-invalid", "ABC1234", "2026-10-17T09:00:00.000Z");
    expect(response.status).toBe(400);
    expect(mockSessionsRepo).toHaveLength(0);
  });

  it("rejects unexpected JSON properties on operational requests", async () => {
    const response = await app.request("/api/parking-sessions/entry", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        id: "session-extra",
        facilityId,
        businessUnitId,
        spaceCategoryId,
        licensePlate: "AA1A11",
        unexpected: "ignored-fields-are-not-allowed",
      }),
    });

    expect(response.status).toBe(400);
    expect(mockSessionsRepo).toHaveLength(0);
  });

  it("corrects a valid active plate, preserves session context and writes an audit record", async () => {
    await createEntry("session-edit", "AA1A11", "2026-10-17T09:00:00.000Z");
    const response = await app.request("/api/parking-sessions/session-edit/plate", {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ facilityId, licensePlate: "A1-11-AA", expectedVersion: 1 }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.session).toMatchObject({ id: "session-edit", licensePlate: "A111AA", version: 2 });
    expect(body.session.entryTime).toBe("2026-10-17T09:00:00.000Z");
    expect(parkingSessionAuditStore.at(-1)).toMatchObject({
      userId: "operator-01",
      action: "plate_updated",
      sessionId: "session-edit",
      before: { licensePlate: "AA1A11" },
      after: { licensePlate: "A111AA" },
    });
  });

  it("rejects duplicate, malformed and stale plate corrections without changing the session", async () => {
    await createEntry("session-one", "AA1A11", "2026-10-17T09:00:00.000Z");
    await createEntry("session-two", "BB2B22", "2026-10-17T10:00:00.000Z");

    const duplicate = await app.request("/api/parking-sessions/session-one/plate", {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ facilityId, licensePlate: "BB-2B-22", expectedVersion: 1 }),
    });
    const malformed = await app.request("/api/parking-sessions/session-one/plate", {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ facilityId, licensePlate: "AA 1A 11", expectedVersion: 1 }),
    });
    const stale = await app.request("/api/parking-sessions/session-one/plate", {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ facilityId, licensePlate: "A1-11-AA", expectedVersion: 8 }),
    });

    expect(duplicate.status).toBe(409);
    expect(malformed.status).toBe(400);
    expect(stale.status).toBe(409);
    expect(mockSessionsRepo.find((session) => session.id === "session-one")?.licensePlate).toBe("AA1A11");
  });

  it("closes the selected session by ID and rejects a stale second exit", async () => {
    await createEntry("session-exit", "AA1A11", "2026-10-17T09:00:00.000Z");
    const exit = await app.request("/api/parking-sessions/session-exit/exit", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ facilityId, expectedVersion: 1, exitTime: "2026-10-17T10:00:00.000Z" }),
    });
    const duplicateExit = await app.request("/api/parking-sessions/session-exit/exit", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ facilityId, expectedVersion: 1 }),
    });

    expect(exit.status).toBe(200);
    expect((await exit.json()).session.status).toBe("completed");
    expect(duplicateExit.status).toBe(404);
    expect(parkingSessionAuditStore.some((entry) => entry.action === "exited")).toBe(true);
  });

  it("syncs an offline entry before correcting its active plate and audits both operations", async () => {
    const response = await app.request("/api/sync/delta", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        facilityId,
        deviceId: "gate-offline-1",
        mutations: [
          {
            id: "offline-session",
            type: "VEHICLE_ENTRY",
            payload: {
              facilityId,
              businessUnitId,
              spaceCategoryId,
              licensePlate: "AA1A11",
              entryTime: "2026-10-17T09:00:00.000Z",
            },
            clientTimestamp: "2026-10-17T09:00:00.000Z",
            deviceId: "gate-offline-1",
            status: "pending",
            retryCount: 0,
          },
          {
            id: "offline-plate-update",
            type: "VEHICLE_PLATE_UPDATE",
            payload: { facilityId, sessionId: "offline-session", licensePlate: "A1-11-AA", expectedVersion: 1 },
            clientTimestamp: "2026-10-17T09:05:00.000Z",
            deviceId: "gate-offline-1",
            status: "pending",
            retryCount: 0,
          },
          {
            id: "offline-exit",
            type: "VEHICLE_EXIT",
            payload: {
              facilityId,
              sessionId: "offline-session",
              licensePlate: "A1-11-AA",
              expectedVersion: 2,
              exitTime: "2026-10-17T09:10:00.000Z",
            },
            clientTimestamp: "2026-10-17T09:10:00.000Z",
            deviceId: "gate-offline-1",
            status: "pending",
            retryCount: 0,
          },
        ],
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.succeeded).toEqual(["offline-session", "offline-plate-update", "offline-exit"]);
    expect(mockSessionsRepo.find((session) => session.id === "offline-session")).toMatchObject({ licensePlate: "A111AA", status: "completed" });
    expect(parkingSessionAuditStore.map((entry) => entry.action)).toEqual(["created", "plate_updated", "exited"]);
  });

  it("syncs an exit by active session ID without requiring a repeated plate or client version", async () => {
    await createEntry("session-offline-exit", "AA1A11", "2026-10-17T09:00:00.000Z");

    const response = await app.request("/api/sync/delta", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        facilityId,
        deviceId: "gate-offline-2",
        mutations: [{
          id: "offline-exit-by-session",
          type: "VEHICLE_EXIT",
          payload: { facilityId, sessionId: "session-offline-exit" },
          clientTimestamp: "2026-10-17T10:00:00.000Z",
          deviceId: "gate-offline-2",
          status: "pending",
          retryCount: 0,
        }],
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.succeeded).toEqual(["offline-exit-by-session"]);
    expect(mockSessionsRepo.find((session) => session.id === "session-offline-exit")).toMatchObject({
      status: "completed",
      exitTime: "2026-10-17T10:00:00.000Z",
    });
    expect(parkingSessionAuditStore.at(-1)).toMatchObject({ action: "exited", sessionId: "session-offline-exit" });
  });

  it("reports a conflict when an offline exit references a session that is no longer active", async () => {
    const response = await app.request("/api/sync/delta", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        facilityId,
        deviceId: "gate-offline-2",
        mutations: [{
          id: "offline-exit-missing-session",
          type: "VEHICLE_EXIT",
          payload: { facilityId, sessionId: "already-closed-session" },
          clientTimestamp: "2026-10-17T10:00:00.000Z",
          deviceId: "gate-offline-2",
          status: "pending",
          retryCount: 0,
        }],
      }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.succeeded).toEqual([]);
    expect(body.conflicts).toEqual([{
      mutationId: "offline-exit-missing-session",
      reason: "No existe sesión activa para el egreso de la sesión already-closed-session",
    }]);
  });
});
