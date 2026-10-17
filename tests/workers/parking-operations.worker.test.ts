import { exports as workerExports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

const worker = (workerExports as unknown as {
  default: { fetch: (request: string, init?: RequestInit) => Promise<Response> };
}).default;
const readJson = async <T>(response: Response): Promise<T> => await response.json() as T;

describe("Gate operations in the Cloudflare Worker runtime", () => {
  it("authenticates and processes entry, plate correction, quick exit, and offline sync", async () => {
    const loginResponse = await worker.fetch("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "operador", password: "operador123" }),
    });
    expect(loginResponse.status).toBe(200);
    const { token } = await readJson<{ token: string }>(loginResponse);
    const authHeaders = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    const facilityId = "fac-default-01";
    const activeUrl = `http://localhost/api/parking-sessions/active?facilityId=${facilityId}`;

    expect((await worker.fetch(activeUrl)).status).toBe(401);

    const sessionId = `worker-session-${crypto.randomUUID()}`;
    const entryResponse = await worker.fetch("http://localhost/api/parking-sessions/entry", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        id: sessionId,
        facilityId,
        businessUnitId: "bu-hotel-01",
        spaceCategoryId: "cat-std",
        licensePlate: "AB1C23",
        entryTime: "2026-10-17T09:00:00.000Z",
      }),
    });
    expect(entryResponse.status).toBe(201);
    expect((await readJson<{ session: { licensePlate: string } }>(entryResponse)).session.licensePlate).toBe("AB1C23");

    const listedBeforeExit = await worker.fetch(activeUrl, { headers: authHeaders });
    expect((await readJson<{ sessions: { id: string }[] }>(listedBeforeExit)).sessions.map((session) => session.id)).toContain(sessionId);

    const correctionResponse = await worker.fetch(`http://localhost/api/parking-sessions/${sessionId}/plate`, {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({ facilityId, licensePlate: "A1-11-AA", expectedVersion: 1 }),
    });
    expect(correctionResponse.status).toBe(200);
    expect((await readJson<{ session: { licensePlate: string; version: number } }>(correctionResponse)).session).toMatchObject({ licensePlate: "A111AA", version: 2 });

    const quickExitResponse = await worker.fetch(`http://localhost/api/parking-sessions/${sessionId}/exit`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ facilityId, expectedVersion: 2, exitTime: "2026-10-17T10:00:00.000Z" }),
    });
    expect(quickExitResponse.status).toBe(200);
    expect((await readJson<{ session: { status: string } }>(quickExitResponse)).session.status).toBe("completed");

    const offlineEntryId = `offline-session-${crypto.randomUUID()}`;
    const syncResponse = await worker.fetch("http://localhost/api/sync/delta", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        facilityId,
        deviceId: "worker-test-gate",
        mutations: [
          {
            id: offlineEntryId,
            type: "VEHICLE_ENTRY",
            payload: { facilityId, businessUnitId: "bu-hotel-01", spaceCategoryId: "cat-std", licensePlate: "CD4E56" },
            clientTimestamp: "2026-10-17T11:00:00.000Z",
            deviceId: "worker-test-gate",
            status: "pending",
            retryCount: 0,
          },
          {
            id: `offline-plate-${crypto.randomUUID()}`,
            type: "VEHICLE_PLATE_UPDATE",
            payload: { facilityId, sessionId: offlineEntryId, licensePlate: "D5-6E-7F", expectedVersion: 1 },
            clientTimestamp: "2026-10-17T11:01:00.000Z",
            deviceId: "worker-test-gate",
            status: "pending",
            retryCount: 0,
          },
          {
            id: `offline-exit-${crypto.randomUUID()}`,
            type: "VEHICLE_EXIT",
            payload: { facilityId, sessionId: offlineEntryId, licensePlate: "D56E7F", expectedVersion: 2 },
            clientTimestamp: "2026-10-17T11:02:00.000Z",
            deviceId: "worker-test-gate",
            status: "pending",
            retryCount: 0,
          },
        ],
      }),
    });
    expect(syncResponse.status).toBe(200);
    expect((await readJson<{ succeeded: string[] }>(syncResponse)).succeeded).toHaveLength(3);

    const listedAfterExit = await worker.fetch(activeUrl, { headers: authHeaders });
    expect((await readJson<{ sessions: { id: string }[] }>(listedAfterExit)).sessions.map((session) => session.id)).not.toContain(offlineEntryId);
  });
});
