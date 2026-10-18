import { env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { applyD1Migrations, countRows, getD1Database, workerFetch } from "./support/d1-fixture";
import { fingerprintMutation } from "../../src/server/db/repositories/sync-repository";

const jsonHeaders = (token: string) => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" });
let testSigningSecret = "";

async function installTestCredentials(): Promise<void> {
  const suffix = crypto.randomUUID().slice(0, 8);
  const bindings = env as unknown as Record<string, unknown>;
  const values = {
    ADMIN_USERNAME: `admin-${suffix}`,
    ADMIN_PASSWORD: crypto.randomUUID(),
    OPERATOR_USERNAME: `operator-${suffix}`,
    OPERATOR_PASSWORD: crypto.randomUUID(),
    JWT_SECRET: crypto.randomUUID() + crypto.randomUUID(),
  };
  testSigningSecret = values.JWT_SECRET;
  for (const [key, value] of Object.entries(values)) {
    if (!Reflect.set(bindings, key, value)) throw new Error("Worker test environment cannot inject ephemeral login variables");
  }
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
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(testSigningSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(unsigned)));
  return `${unsigned}.${base64Url(signature)}`;
}

async function seedOperationalFixture(facilityId: string, capacity = 20): Promise<void> {
  const database = getD1Database();
  const now = new Date().toISOString();
  await database.prepare(
    "INSERT INTO facilities (id, name, address, total_capacity, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).bind(facilityId, "Sync persistence fixture", "", capacity, 1, now, now).run();
  await database.prepare(
    "INSERT INTO space_categories (id, facility_id, name, code, allocated_slots) VALUES (?, ?, ?, ?, ?)",
  ).bind(`cat-${facilityId}`, facilityId, "Standard", "STD", capacity).run();
  await database.prepare(
    "INSERT INTO business_units (id, facility_id, name, code, priority_level, quota_type, default_quota, is_active, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  ).bind(`unit-${facilityId}`, facilityId, "Hotel", "HTL", 3, "dynamic", capacity, 1, 1).run();
}

function entryMutation(facilityId: string, mutationId: string, licensePlate: string) {
  return {
    id: mutationId,
    type: "VEHICLE_ENTRY",
    payload: {
      facilityId,
      businessUnitId: `unit-${facilityId}`,
      spaceCategoryId: `cat-${facilityId}`,
      licensePlate,
      entryTime: "2026-10-17T11:00:00.000Z",
    },
    clientTimestamp: "2026-10-17T11:00:00.000Z",
    deviceId: "d1-sync-test",
    status: "pending",
    retryCount: 0,
  };
}

async function sync(token: string, facilityId: string, mutations: unknown[]) {
  return await workerFetch("/api/sync/delta", {
    method: "POST",
    headers: jsonHeaders(token),
    body: JSON.stringify({ facilityId, deviceId: "d1-sync-test", mutations }),
  });
}

describe("Offline delta sync persistence through the Worker API", () => {
  beforeAll(async () => {
    await applyD1Migrations();
    await installTestCredentials();
  });

  it("stores a durable success receipt and replays the same mutation without duplicate effects", async () => {
    const facilityId = `sync-repeat-${crypto.randomUUID()}`;
    await seedOperationalFixture(facilityId);
    const token = await operatorToken(facilityId);
    const mutationId = `offline-${crypto.randomUUID()}`;
    const mutation = entryMutation(facilityId, mutationId, "EF1G23");

    const firstResponse = await sync(token, facilityId, [mutation]);
    expect(firstResponse.status).toBe(200);
    const first = await firstResponse.json() as { processed: number; succeeded: string[]; conflicts: unknown[] };
    expect(first.processed).toBeGreaterThanOrEqual(1);
    expect(first.succeeded).toContain(mutationId);
    expect(first.conflicts).toEqual([]);

    const repeatedResponse = await sync(token, facilityId, [mutation]);
    expect(repeatedResponse.status).toBe(200);
    const repeated = await repeatedResponse.json();
    expect(repeated).toEqual(first);
    const database = getD1Database();
    expect(await countRows(database, "SELECT COUNT(*) AS count FROM parking_sessions WHERE id = ?", mutationId)).toBe(1);
    expect(await countRows(database, "SELECT COUNT(*) AS count FROM sync_mutations WHERE facility_id = ? AND id = ?", facilityId, mutationId)).toBe(1);
    expect(await countRows(database, "SELECT COUNT(*) AS count FROM audit_logs WHERE facility_id = ? AND mutation_id = ?", facilityId, mutationId)).toBe(1);

    const replayWithChangedPayload = await sync(token, facilityId, [entryMutation(facilityId, mutationId, "GH4J56")]);
    expect(replayWithChangedPayload.status).toBe(200);
    const changed = await replayWithChangedPayload.json() as { succeeded: string[]; conflicts: { mutationId: string }[] };
    expect(changed.succeeded).not.toContain(mutationId);
    expect(changed.conflicts.map(({ mutationId: id }) => id)).toContain(mutationId);
    expect(await countRows(database, "SELECT COUNT(*) AS count FROM parking_sessions WHERE id = ?", mutationId)).toBe(1);
  });

  it("reports stale-version and business conflicts without receipts or partial writes", async () => {
    const facilityId = `sync-conflict-${crypto.randomUUID()}`;
    await seedOperationalFixture(facilityId, 1);
    const token = await operatorToken(facilityId);
    const firstId = `offline-${crypto.randomUUID()}`;
    const firstEntry = await sync(token, facilityId, [entryMutation(facilityId, firstId, "JK7L89")]);
    expect(firstEntry.status).toBe(200);
    expect((await firstEntry.json() as { succeeded: string[] }).succeeded).toContain(firstId);

    const staleMutationId = `offline-${crypto.randomUUID()}`;
    const staleMutation = {
      id: staleMutationId,
      type: "VEHICLE_PLATE_UPDATE",
      payload: { facilityId, sessionId: firstId, licensePlate: "MN1P23", expectedVersion: 99 },
      clientTimestamp: "2026-10-17T11:01:00.000Z",
      deviceId: "d1-sync-test",
      status: "pending",
      retryCount: 0,
    };
    const staleResponse = await sync(token, facilityId, [staleMutation]);
    expect(staleResponse.status).toBe(200);
    const stale = await staleResponse.json() as { succeeded: string[]; conflicts: { mutationId: string }[] };
    expect(stale.succeeded).not.toContain(staleMutationId);
    expect(stale.conflicts.map(({ mutationId }) => mutationId)).toContain(staleMutationId);
    expect(await countRows(getD1Database(), "SELECT COUNT(*) AS count FROM sync_mutations WHERE facility_id = ? AND id = ?", facilityId, staleMutationId)).toBe(0);

    const duplicatePlateId = `offline-${crypto.randomUUID()}`;
    const duplicatePlate = await sync(token, facilityId, [entryMutation(facilityId, duplicatePlateId, "JK7L89")]);
    expect(duplicatePlate.status).toBe(200);
    expect((await duplicatePlate.json() as { conflicts: { mutationId: string }[] }).conflicts.map(({ mutationId }) => mutationId)).toContain(duplicatePlateId);
    expect(await countRows(getD1Database(), "SELECT COUNT(*) AS count FROM parking_sessions WHERE facility_id = ? AND status = 'active'", facilityId)).toBe(1);
  });

  it("does not confirm a sync mutation when its audit insert fails", async () => {
    const facilityId = `sync-rollback-${crypto.randomUUID()}`;
    await seedOperationalFixture(facilityId);
    const token = await operatorToken(facilityId);
    const mutationId = `offline-${crypto.randomUUID()}`;
    const database = getD1Database();
    await database.exec("CREATE TRIGGER fail_sync_audit BEFORE INSERT ON audit_logs BEGIN SELECT RAISE(ABORT, 'test audit failure'); END");
    try {
      const response = await sync(token, facilityId, [entryMutation(facilityId, mutationId, "QR4S56")]);
      expect(response.status).toBeGreaterThanOrEqual(500);
      expect(await countRows(database, "SELECT COUNT(*) AS count FROM parking_sessions WHERE id = ?", mutationId)).toBe(0);
      expect(await countRows(database, "SELECT COUNT(*) AS count FROM audit_logs WHERE facility_id = ? AND mutation_id = ?", facilityId, mutationId)).toBe(0);
      expect(await countRows(database, "SELECT COUNT(*) AS count FROM sync_mutations WHERE facility_id = ? AND id = ?", facilityId, mutationId)).toBe(0);
    } finally {
      await database.exec("DROP TRIGGER IF EXISTS fail_sync_audit");
    }
  });

  it("rejects malformed and cross-facility mutations and syncs correction and exit by either lookup key", async () => {
    const facilityId = `sync-edge-${crypto.randomUUID()}`;
    await seedOperationalFixture(facilityId);
    const token = await operatorToken(facilityId);

    expect((await workerFetch("/api/sync/delta", {
      method: "POST", headers: jsonHeaders(token), body: JSON.stringify({ facilityId, deviceId: "d1-sync-test" }),
    })).status).toBe(400);

    const wrongFacilityMutation = entryMutation(facilityId, `offline-${crypto.randomUUID()}`, "ST1U23");
    wrongFacilityMutation.payload.facilityId = `other-${facilityId}`;
    const wrongFacility = await sync(token, facilityId, [wrongFacilityMutation]);
    expect((await wrongFacility.json() as { conflicts: { mutationId: string }[] }).conflicts).toHaveLength(1);

    const missingFacilityId = `missing-${facilityId}`;
    const missingFacilityMutation = entryMutation(missingFacilityId, `offline-${crypto.randomUUID()}`, "VW4X56");
    expect((await sync(token, missingFacilityId, [missingFacilityMutation])).status).toBe(403);

    const missingCategory = entryMutation(facilityId, `offline-${crypto.randomUUID()}`, "YZ7A89");
    missingCategory.payload.spaceCategoryId = "missing-category";
    const categoryConflict = await sync(token, facilityId, [missingCategory]);
    expect((await categoryConflict.json() as { conflicts: unknown[] }).conflicts).toHaveLength(1);

    const missingAreaBase = entryMutation(facilityId, `offline-${crypto.randomUUID()}`, "BC1D23");
    const missingArea = { ...missingAreaBase, payload: { ...missingAreaBase.payload, parkingAreaId: "missing-area" } };
    const areaConflict = await sync(token, facilityId, [missingArea]);
    expect((await areaConflict.json() as { conflicts: unknown[] }).conflicts).toHaveLength(1);

    const entryId = `offline-${crypto.randomUUID()}`;
    expect((await sync(token, facilityId, [entryMutation(facilityId, entryId, "EF4G56")])).status).toBe(200);
    const correctionId = `offline-${crypto.randomUUID()}`;
    const correction = {
      id: correctionId, type: "VEHICLE_PLATE_UPDATE",
      payload: { sessionId: entryId, licensePlate: "HJ7K89", expectedVersion: 1 },
      clientTimestamp: "2026-10-17T11:01:00.000Z", deviceId: "d1-sync-test", status: "pending", retryCount: 0,
    };
    const corrected = await sync(token, facilityId, [correction]);
    expect((await corrected.json() as { succeeded: string[] }).succeeded).toContain(correctionId);

    const exitId = `offline-${crypto.randomUUID()}`;
    const exitById = {
      id: exitId, type: "VEHICLE_EXIT",
      payload: { sessionId: entryId, expectedVersion: 2 },
      clientTimestamp: "2026-10-17T12:00:00.000Z", deviceId: "d1-sync-test", status: "pending", retryCount: 0,
    };
    const exited = await sync(token, facilityId, [exitById]);
    expect((await exited.json() as { succeeded: string[] }).succeeded).toContain(exitId);

    const exitByPlateId = `offline-${crypto.randomUUID()}`;
    const exitByPlate = {
      id: exitByPlateId, type: "VEHICLE_EXIT",
      payload: { licensePlate: "LM1N23" },
      clientTimestamp: "2026-10-17T12:01:00.000Z", deviceId: "d1-sync-test", status: "pending", retryCount: 0,
    };
    const missingActivePlate = await sync(token, facilityId, [exitByPlate]);
    expect((await missingActivePlate.json() as { conflicts: { mutationId: string }[] }).conflicts.map(({ mutationId }) => mutationId)).toContain(exitByPlateId);

    const missingSessionCorrection = {
      id: `offline-${crypto.randomUUID()}`, type: "VEHICLE_PLATE_UPDATE",
      payload: { sessionId: "missing-session", licensePlate: "PQ4R56", expectedVersion: 1 },
      clientTimestamp: "2026-10-17T12:02:00.000Z", deviceId: "d1-sync-test", status: "pending", retryCount: 0,
    };
    const correctionConflict = await sync(token, facilityId, [missingSessionCorrection]);
    expect((await correctionConflict.json() as { conflicts: unknown[] }).conflicts).toHaveLength(1);
    expect(await fingerprintMutation(["item", { z: 1, a: 2 }]))
      .toBe(await fingerprintMutation(["item", { a: 2, z: 1 }]));
    expect(await fingerprintMutation("unwrapped mutation")).toMatch(/^[a-f0-9]{64}$/);
  });
});
