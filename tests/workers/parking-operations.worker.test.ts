import { env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { applyD1Migrations, getD1Database, workerFetch } from "./support/d1-fixture";
const readJson = async <T>(response: Response): Promise<T> => await response.json() as T;
const bindings = env as unknown as Record<string, unknown>;

beforeAll(async () => {
  await applyD1Migrations();
  for (const [key, value] of Object.entries({
    ADMIN_USERNAME: `admin-${crypto.randomUUID().slice(0, 8)}`,
    ADMIN_PASSWORD: crypto.randomUUID(),
    OPERATOR_USERNAME: `operator-${crypto.randomUUID().slice(0, 8)}`,
    OPERATOR_PASSWORD: crypto.randomUUID(),
    JWT_SECRET: crypto.randomUUID() + crypto.randomUUID(),
  })) {
    Reflect.set(bindings, key, value);
  }
  const database = getD1Database();
  const now = new Date().toISOString();
  await database.prepare("INSERT OR IGNORE INTO facilities (id, name, address, total_capacity, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind("fac-default-01", "Worker test facility", "", 100, 1, now, now).run();
  await database.prepare("INSERT OR IGNORE INTO space_categories (id, facility_id, name, code, allocated_slots) VALUES (?, ?, ?, ?, ?)")
    .bind("cat-std", "fac-default-01", "Standard", "STD", 0).run();
  await database.prepare("INSERT OR IGNORE INTO business_units (id, facility_id, name, code, priority_level, quota_type, default_quota, is_active, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind("bu-hotel-01", "fac-default-01", "Hotel", "HOTEL", 1, "guaranteed", 40, 1, 1).run();
});

describe("Gate operations in the Cloudflare Worker runtime", () => {
  it("authenticates and processes entry, plate correction, quick exit, and offline sync", async () => {
    const loginResponse = await workerFetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: bindings.OPERATOR_USERNAME, password: bindings.OPERATOR_PASSWORD }),
    });
    expect(loginResponse.status).toBe(200);
    const { token } = await readJson<{ token: string }>(loginResponse);
    const authHeaders = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    const facilityId = "fac-default-01";

    expect((await workerFetch(`/api/parking-sessions/active?facilityId=${facilityId}`)).status).toBe(401);

    const sessionId = `worker-session-${crypto.randomUUID()}`;
    const entryResponse = await workerFetch("/api/parking-sessions/entry", {
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

    const listedBeforeExit = await workerFetch(`/api/parking-sessions/active?facilityId=${facilityId}`, { headers: authHeaders });
    expect((await readJson<{ sessions: { id: string }[] }>(listedBeforeExit)).sessions.map((session) => session.id)).toContain(sessionId);

    const correctionResponse = await workerFetch(`/api/parking-sessions/${sessionId}/plate`, {
      method: "PATCH",
      headers: authHeaders,
      body: JSON.stringify({ facilityId, licensePlate: "A1-11-AA", expectedVersion: 1 }),
    });
    expect(correctionResponse.status).toBe(200);
    expect((await readJson<{ session: { licensePlate: string; version: number } }>(correctionResponse)).session).toMatchObject({ licensePlate: "A111AA", version: 2 });

    const quickExitResponse = await workerFetch(`/api/parking-sessions/${sessionId}/exit`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ facilityId, expectedVersion: 2, exitTime: "2026-10-17T10:00:00.000Z" }),
    });
    expect(quickExitResponse.status).toBe(200);
    expect((await readJson<{ session: { status: string } }>(quickExitResponse)).session.status).toBe("completed");

    const offlineEntryId = `offline-session-${crypto.randomUUID()}`;
    const syncResponse = await workerFetch("/api/sync/delta", {
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

    const listedAfterExit = await workerFetch(`/api/parking-sessions/active?facilityId=${facilityId}`, { headers: authHeaders });
    expect((await readJson<{ sessions: { id: string }[] }>(listedAfterExit)).sessions.map((session) => session.id)).not.toContain(offlineEntryId);
  });
});
