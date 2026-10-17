import { env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { applyD1Migrations, countRows, getD1Database, workerFetch } from "./support/d1-fixture";

const requestHeaders = (token: string) => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" });
let testSigningSecret = "";

async function installTestCredentials(): Promise<void> {
  const bindings = env as unknown as Record<string, unknown>;
  testSigningSecret = crypto.randomUUID() + crypto.randomUUID();
  if (!Reflect.set(bindings, "JWT_SECRET", testSigningSecret)) throw new Error("Worker test environment cannot inject an ephemeral JWT secret");
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function operatorToken(facilityId: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(new TextEncoder().encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const payload = base64Url(new TextEncoder().encode(JSON.stringify({
    userId: `operator-${crypto.randomUUID()}`,
    username: "worker-test-operator",
    role: "operator",
    facilityId,
    iat: now,
    exp: now + 3600,
  })));
  const unsigned = `${header}.${payload}`;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(testSigningSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(unsigned)));
  return `${unsigned}.${base64Url(signature)}`;
}

async function seedOperationalFixture(facilityId: string, capacity: number): Promise<void> {
  const database = getD1Database();
  const now = new Date().toISOString();
  await database.prepare(
    "INSERT INTO facilities (id, name, address, total_capacity, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).bind(facilityId, "Session persistence fixture", "", capacity, 1, now, now).run();
  await database.prepare(
    "INSERT INTO space_categories (id, facility_id, name, code, allocated_slots) VALUES (?, ?, ?, ?, ?)",
  ).bind(`cat-${facilityId}`, facilityId, "Standard", "STD", 0).run();
  await database.prepare(
    "INSERT INTO business_units (id, facility_id, name, code, priority_level, quota_type, default_quota, is_active, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  ).bind(`unit-${facilityId}`, facilityId, "Hotel", "HTL", 3, "dynamic", capacity, 1, 1).run();
}

async function createEntry(token: string, facilityId: string, sessionId: string, licensePlate: string) {
  return await workerFetch("/api/parking-sessions/entry", {
    method: "POST",
    headers: requestHeaders(token),
    body: JSON.stringify({
      id: sessionId,
      facilityId,
      businessUnitId: `unit-${facilityId}`,
      spaceCategoryId: `cat-${facilityId}`,
      licensePlate,
      entryTime: "2026-10-17T09:00:00.000Z",
      deviceId: "d1-session-test",
    }),
  });
}

describe("Parking session persistence through the Worker API", () => {
  beforeAll(async () => {
    await applyD1Migrations();
    await installTestCredentials();
  });

  it("keeps entry, active listing, plate correction, exit, dashboard, and audits across requests", async () => {
    const facilityId = `session-persist-${crypto.randomUUID()}`;
    const token = await operatorToken(facilityId);
    await seedOperationalFixture(facilityId, 20);
    const sessionId = `session-${crypto.randomUUID()}`;

    const dashboardBefore = await workerFetch(`/api/facilities/${facilityId}/dashboard`, { headers: requestHeaders(token) });
    const entry = await createEntry(token, facilityId, sessionId, "AB1C23");
    expect(entry.status).toBe(201);
    expect((await entry.json() as { session: { id: string; status: string } }).session).toMatchObject({ id: sessionId, status: "active" });

    const activeList = await workerFetch(`/api/parking-sessions/active?facilityId=${facilityId}`, { headers: requestHeaders(token) });
    expect(activeList.status).toBe(200);
    expect((await activeList.json() as { sessions: { id: string }[] }).sessions.map(({ id }) => id)).toContain(sessionId);
    const dashboardWithActiveSession = await workerFetch(`/api/facilities/${facilityId}/dashboard`, { headers: requestHeaders(token) });
    expect(dashboardWithActiveSession.status).toBe(200);
    expect(await dashboardWithActiveSession.json()).not.toEqual(await dashboardBefore.json());
    const persistedEntry = await getD1Database().prepare("SELECT id, status, license_plate, version FROM parking_sessions WHERE id = ?")
      .bind(sessionId).first<{ id: string; status: string; license_plate: string; version: number }>();
    expect(persistedEntry).toMatchObject({ id: sessionId, status: "active", license_plate: "AB1C23", version: 1 });

    const plateCorrection = await workerFetch(`/api/parking-sessions/${sessionId}/plate`, {
      method: "PATCH",
      headers: requestHeaders(token),
      body: JSON.stringify({ facilityId, licensePlate: "CD-4E-56", expectedVersion: 1 }),
    });
    expect(plateCorrection.status).toBe(200);
    expect((await plateCorrection.json() as { session: { licensePlate: string; version: number } }).session)
      .toMatchObject({ licensePlate: "CD4E56", version: 2 });

    const exit = await workerFetch(`/api/parking-sessions/${sessionId}/exit`, {
      method: "POST",
      headers: requestHeaders(token),
      body: JSON.stringify({ facilityId, expectedVersion: 2, exitTime: "2026-10-17T10:00:00.000Z" }),
    });
    expect(exit.status).toBe(200);
    expect((await exit.json() as { session: { status: string } }).session.status).toBe("completed");
    const activeAgain = await workerFetch(`/api/parking-sessions/active?facilityId=${facilityId}`, { headers: requestHeaders(token) });
    expect((await activeAgain.json() as { sessions: { id: string }[] }).sessions.map(({ id }) => id)).not.toContain(sessionId);
    expect((await workerFetch(`/api/parking-sessions/${sessionId}/plate`, {
      method: "PATCH", headers: requestHeaders(token),
      body: JSON.stringify({ facilityId, licensePlate: "EF1G23", expectedVersion: 3 }),
    })).status).toBe(404);

    const persistedAfterExit = await getD1Database().prepare("SELECT status, license_plate, version FROM parking_sessions WHERE id = ?")
      .bind(sessionId).first<{ status: string; license_plate: string; version: number }>();
    expect(persistedAfterExit).toMatchObject({ status: "completed", license_plate: "CD4E56", version: 3 });
    expect(await countRows(getD1Database(), "SELECT COUNT(*) AS count FROM audit_logs WHERE entity_id = ?", sessionId)).toBe(3);
    const dashboardAfter = await workerFetch(`/api/facilities/${facilityId}/dashboard`, { headers: requestHeaders(token) });
    expect(dashboardBefore.status).toBe(200);
    expect(dashboardAfter.status).toBe(200);
    expect(await dashboardAfter.json()).toBeDefined();
  });

  it("rejects duplicate plates, capacity overflow, stale versions, and partial audit writes", async () => {
    const facilityId = `session-conflict-${crypto.randomUUID()}`;
    const token = await operatorToken(facilityId);
    await seedOperationalFixture(facilityId, 1);

    const firstId = `session-${crypto.randomUUID()}`;
    expect((await createEntry(token, facilityId, firstId, "AA1A11")).status).toBe(201);
    const duplicate = await createEntry(token, facilityId, `session-${crypto.randomUUID()}`, "AA-1A-11");
    expect(duplicate.status).toBe(409);
    const overCapacity = await createEntry(token, facilityId, `session-${crypto.randomUUID()}`, "BB2B22");
    expect(overCapacity.status).toBe(409);

    const stale = await workerFetch(`/api/parking-sessions/${firstId}/plate`, {
      method: "PATCH", headers: requestHeaders(token),
      body: JSON.stringify({ facilityId, licensePlate: "CC3C33", expectedVersion: 99 }),
    });
    expect(stale.status).toBe(409);
    const unchanged = await getD1Database().prepare("SELECT license_plate, version FROM parking_sessions WHERE id = ?")
      .bind(firstId).first<{ license_plate: string; version: number }>();
    expect(unchanged).toMatchObject({ license_plate: "AA1A11", version: 1 });

    const database = getD1Database();
    await database.prepare("UPDATE facilities SET total_capacity = 10, version = version + 1 WHERE id = ?").bind(facilityId).run();
    await database.exec("CREATE TRIGGER fail_session_audit BEFORE INSERT ON audit_logs BEGIN SELECT RAISE(ABORT, 'test audit failure'); END");
    const failedId = `session-${crypto.randomUUID()}`;
    try {
      const failedEntry = await createEntry(token, facilityId, failedId, "DD4D44");
      expect(failedEntry.status).toBeGreaterThanOrEqual(500);
      expect(await countRows(database, "SELECT COUNT(*) AS count FROM parking_sessions WHERE id = ?", failedId)).toBe(0);
      expect(await countRows(database, "SELECT COUNT(*) AS count FROM audit_logs WHERE entity_id = ?", failedId)).toBe(0);
    } finally {
      await database.exec("DROP TRIGGER IF EXISTS fail_session_audit");
    }
  });

  it("returns explicit validation, lookup, stale-session, and missing-D1 responses", async () => {
    const facilityId = `session-edge-${crypto.randomUUID()}`;
    const token = await operatorToken(facilityId);
    await seedOperationalFixture(facilityId, 2);
    expect((await workerFetch("/api/parking-sessions/active")).status).toBe(401);
    expect((await workerFetch("/api/parking-sessions/active", { headers: requestHeaders(token) })).status).toBe(400);
    expect((await workerFetch("/api/parking-sessions/entry", {
      method: "POST", headers: requestHeaders(token), body: JSON.stringify({}),
    })).status).toBe(400);
    expect((await workerFetch("/api/parking-sessions/entry", {
      method: "POST", headers: requestHeaders(token),
      body: JSON.stringify({ facilityId: `missing-${facilityId}`, businessUnitId: `unit-${facilityId}`, spaceCategoryId: `cat-${facilityId}`, licensePlate: "AA1A11" }),
    })).status).toBe(404);
    expect((await workerFetch("/api/parking-sessions/entry", {
      method: "POST", headers: requestHeaders(token),
      body: JSON.stringify({ facilityId, businessUnitId: `unit-${facilityId}`, spaceCategoryId: "missing-category", licensePlate: "BB2B22" }),
    })).status).toBe(409);
    expect((await workerFetch("/api/parking-sessions/entry", {
      method: "POST", headers: requestHeaders(token),
      body: JSON.stringify({ facilityId, businessUnitId: "missing-unit", spaceCategoryId: `cat-${facilityId}`, licensePlate: "BC3C34" }),
    })).status).toBe(409);
    await getD1Database().prepare(
      "INSERT INTO business_units (id, facility_id, name, code, priority_level, quota_type, default_quota, is_active, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(`inactive-${facilityId}`, facilityId, "Inactive unit", "INACTIVE", 3, "dynamic", 1, 0, 1).run();
    expect((await workerFetch("/api/parking-sessions/entry", {
      method: "POST", headers: requestHeaders(token),
      body: JSON.stringify({ facilityId, businessUnitId: `inactive-${facilityId}`, spaceCategoryId: `cat-${facilityId}`, licensePlate: "BD4E56" }),
    })).status).toBe(409);
    expect((await workerFetch("/api/parking-sessions/entry", {
      method: "POST", headers: requestHeaders(token),
      body: JSON.stringify({ facilityId, businessUnitId: `unit-${facilityId}`, spaceCategoryId: `cat-${facilityId}`, parkingAreaId: "missing-area", licensePlate: "CC3C33" }),
    })).status).toBe(409);
    expect((await workerFetch("/api/parking-sessions/exit", {
      method: "POST", headers: requestHeaders(token), body: JSON.stringify({ facilityId, licensePlate: "DD4D44" }),
    })).status).toBe(404);
    expect((await workerFetch("/api/parking-sessions/exit", {
      method: "POST", headers: requestHeaders(token), body: JSON.stringify({ facilityId }),
    })).status).toBe(400);
    expect((await workerFetch("/api/parking-sessions/missing-session/exit", {
      method: "POST", headers: requestHeaders(token), body: JSON.stringify({ facilityId, expectedVersion: 1 }),
    })).status).toBe(404);
    expect((await workerFetch("/api/parking-sessions/missing-session/plate", {
      method: "PATCH", headers: requestHeaders(token), body: JSON.stringify({ facilityId, licensePlate: "EE5F66", expectedVersion: 1 }),
    })).status).toBe(404);
    expect((await workerFetch("/api/parking-sessions/missing-session/plate", {
      method: "PATCH", headers: requestHeaders(token), body: JSON.stringify({ facilityId, licensePlate: "invalid", expectedVersion: 1 }),
    })).status).toBe(400);

    const firstId = `session-${crypto.randomUUID()}`;
    const secondId = `session-${crypto.randomUUID()}`;
    expect((await createEntry(token, facilityId, firstId, "GH4J56")).status).toBe(201);
    expect((await createEntry(token, facilityId, secondId, "KL7M89")).status).toBe(201);
    expect((await workerFetch(`/api/parking-sessions/${firstId}/exit`, {
      method: "POST", headers: requestHeaders(token), body: JSON.stringify({ facilityId, expectedVersion: 99 }),
    })).status).toBe(409);
    expect((await workerFetch(`/api/parking-sessions/${firstId}/plate`, {
      method: "PATCH", headers: requestHeaders(token), body: JSON.stringify({ facilityId, licensePlate: "KL7M89", expectedVersion: 1 }),
    })).status).toBe(409);
    expect((await workerFetch(`/api/facilities/missing-${facilityId}/dashboard`, { headers: requestHeaders(token) })).status).toBe(404);

    const bindings = (await import("cloudflare:test")).env as unknown as Record<string, unknown>;
    const original = bindings.PARKING_DB;
    Reflect.set(bindings, "PARKING_DB", undefined);
    try {
      expect((await workerFetch(`/api/parking-sessions/active?facilityId=${facilityId}`, { headers: requestHeaders(token) })).status).toBe(500);
    } finally {
      Reflect.set(bindings, "PARKING_DB", original);
    }
  });
});
