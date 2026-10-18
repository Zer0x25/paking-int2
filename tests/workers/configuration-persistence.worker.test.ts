import { env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { applyD1Migrations, countRows, getD1Database, workerFetch } from "./support/d1-fixture";

const jsonHeaders = (token?: string) => ({
  "Content-Type": "application/json",
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

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

async function adminToken(facilityId: string | null, userId = `admin-${crypto.randomUUID()}`): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(new TextEncoder().encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const payload = base64Url(new TextEncoder().encode(JSON.stringify({
    userId,
    username: "worker-test-admin",
    role: "admin",
    facilityId,
    iat: now,
    exp: now + 3600,
  })));
  const unsigned = `${header}.${payload}`;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(testSigningSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(unsigned)));
  return `${unsigned}.${base64Url(signature)}`;
}

async function createFacility(totalCapacity = 100): Promise<{ id: string }> {
  const database = getD1Database();
  const id = `fixture-${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  await database.prepare(
    "INSERT INTO facilities (id, name, address, total_capacity, version, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)",
  ).bind(id, `Persisted facility ${id}`, "Test address", totalCapacity, now, now).run();
  await database.prepare(
    "INSERT INTO space_categories (id, facility_id, name, code, allocated_slots) VALUES (?, ?, 'General / Estándar', 'STD', ?), (?, ?, 'Accesible', 'ACC', 0)",
  ).bind(`cat-std-${id}`, id, totalCapacity, `cat-acc-${id}`, id).run();
  return { id };
}

async function createUnassignedAdmin(): Promise<{ userId: string; token: string }> {
  const database = getD1Database();
  const userId = `bootstrap-admin-${crypto.randomUUID()}`;
  await database.prepare(
    "INSERT INTO users (id, username, full_name, role, facility_id, created_at) VALUES (?, ?, ?, 'admin', NULL, ?)",
  ).bind(userId, userId, "Bootstrap administrator", new Date().toISOString()).run();
  return { userId, token: await adminToken(null, userId) };
}

async function insertCategory(facilityId: string): Promise<string> {
  const database = getD1Database();
  const existing = await database.prepare(
    "SELECT id FROM space_categories WHERE facility_id = ? AND code = 'STD' LIMIT 1",
  ).bind(facilityId).first<{ id: string }>();
  if (existing) return existing.id;
  const categoryId = `cat-${crypto.randomUUID()}`;
  await database.prepare(
    "INSERT INTO space_categories (id, facility_id, name, code, allocated_slots) VALUES (?, ?, ?, ?, ?)",
  ).bind(categoryId, facilityId, "Standard", "STD", 0).run();
  return categoryId;
}

describe("Configuration persistence through the Worker API", () => {
  beforeAll(async () => {
    await applyD1Migrations();
    await installTestCredentials();
  });

  it("persists facility, area, unit, event, status, and catalog reads across new requests", async () => {
    const { token: creationToken } = await createUnassignedAdmin();
    const facilityResponse = await workerFetch("/api/facilities", {
      method: "POST",
      headers: jsonHeaders(creationToken),
      body: JSON.stringify({ name: "Persisted venue", totalCapacity: 100, address: "North entrance" }),
    });
    expect(facilityResponse.status).toBe(201);
    const { facility, token } = await facilityResponse.json() as { facility: { id: string; name: string }; token: string };
    expect(token).toBeTruthy();
    expect(await getD1Database().prepare("SELECT facility_id FROM users WHERE facility_id = ?")
      .bind(facility.id).first<{ facility_id: string }>()).toMatchObject({ facility_id: facility.id });
    const listedFacilities = await workerFetch("/api/facilities", { headers: jsonHeaders(token) });
    expect((await listedFacilities.json() as { facilities: { id: string }[] }).facilities.map(({ id }) => id)).toContain(facility.id);

    const facilityUpdate = await workerFetch(`/api/facilities/${facility.id}`, {
      method: "PUT",
      headers: jsonHeaders(token),
      body: JSON.stringify({ name: "Persisted venue updated", totalCapacity: 100, address: "South entrance" }),
    });
    expect(facilityUpdate.status).toBe(200);
    const persistedFacility = await getD1Database().prepare("SELECT id, name FROM facilities WHERE id = ?")
      .bind(facility.id).first<{ id: string; name: string }>();
    expect(persistedFacility).toMatchObject({ id: facility.id, name: "Persisted venue updated" });
    await insertCategory(facility.id);

    const areaResponse = await workerFetch(`/api/facilities/${facility.id}/areas`, {
      method: "POST",
      headers: jsonHeaders(token),
      body: JSON.stringify({ name: "North deck", code: `ND${crypto.randomUUID().slice(0, 5)}`, allocatedCapacity: 10 }),
    });
    expect(areaResponse.status).toBe(201);
    const { area } = await areaResponse.json() as { area: { id: string; code: string; version: number } };
    const areaUpdate = await workerFetch(`/api/facilities/${facility.id}/areas/${area.id}`, {
      method: "PUT",
      headers: jsonHeaders(token),
      body: JSON.stringify({ name: "North deck updated", code: area.code, description: "Updated fixture", allocatedCapacity: 12, businessUnitId: null, version: area.version }),
    });
    expect(areaUpdate.status).toBe(200);
    const areaStatus = await workerFetch(`/api/facilities/${facility.id}/areas/${area.id}/status`, {
      method: "PATCH",
      headers: jsonHeaders(token),
      body: JSON.stringify({ isActive: false, version: 2 }),
    });
    expect(areaStatus.status).toBe(200);

    const unitCollection = `/api/facilities/${facility.id}/business-units`;
    const unitResponse = await workerFetch(unitCollection, {
      method: "POST",
      headers: jsonHeaders(token),
      body: JSON.stringify({ name: "Conference Hall", code: `CH${crypto.randomUUID().slice(0, 5)}`, quotaType: "contractual", defaultQuota: 20 }),
    });
    expect(unitResponse.status).toBe(201);
    const { businessUnit } = await unitResponse.json() as { businessUnit: { id: string; code: string; version: number } };
    const unitUpdate = await workerFetch(`${unitCollection}/${businessUnit.id}`, {
      method: "PUT",
      headers: jsonHeaders(token),
      body: JSON.stringify({ name: "Conference Hall updated", code: businessUnit.code, quotaType: "contractual", defaultQuota: 18, version: businessUnit.version }),
    });
    expect(unitUpdate.status).toBe(200);
    const eventCollection = `/api/facilities/${facility.id}/events`;
    const eventBase = {
      title: "Persistence conference",
      businessUnitId: businessUnit.id,
      reservedSlots: 5,
      startTime: "2032-11-04T21:00:00.000Z",
      endTime: "2032-11-05T05:00:00.000Z",
    };
    const eventResponse = await workerFetch(eventCollection, {
      method: "POST",
      headers: jsonHeaders(token),
      body: JSON.stringify(eventBase),
    });
    expect(eventResponse.status).toBe(201);
    const { event } = await eventResponse.json() as { event: { id: string; version: number } };
    const eventUpdate = await workerFetch(`${eventCollection}/${event.id}`, {
      method: "PUT",
      headers: jsonHeaders(token),
      body: JSON.stringify({ ...eventBase, title: "Persistence conference updated", version: event.version }),
    });
    expect(eventUpdate.status).toBe(200);
    const eventStatus = await workerFetch(`${eventCollection}/${event.id}/status`, {
      method: "PATCH",
      headers: jsonHeaders(token),
      body: JSON.stringify({ status: "cancelled", version: 2 }),
    });
    expect(eventStatus.status).toBe(200);
    const unitStatus = await workerFetch(`${unitCollection}/${businessUnit.id}/status`, {
      method: "PATCH",
      headers: jsonHeaders(token),
      body: JSON.stringify({ isActive: false, version: 2 }),
    });
    expect(unitStatus.status).toBe(200);

    const facilitiesAgain = await workerFetch("/api/facilities", { headers: jsonHeaders(token) });
    expect((await facilitiesAgain.json() as { facilities: { id: string; name: string }[] }).facilities)
      .toEqual(expect.arrayContaining([expect.objectContaining({ id: facility.id, name: "Persisted venue updated" })]));
    const areasAgain = await workerFetch(`/api/facilities/${facility.id}/areas`, { headers: jsonHeaders(token) });
    expect((await areasAgain.json() as { areas: { id: string; isActive: boolean }[] }).areas)
      .toEqual(expect.arrayContaining([expect.objectContaining({ id: area.id, isActive: false })]));
    const unitsAgain = await workerFetch(unitCollection, { headers: jsonHeaders(token) });
    expect((await unitsAgain.json() as { businessUnits: { id: string; isActive: boolean }[] }).businessUnits)
      .toEqual(expect.arrayContaining([expect.objectContaining({ id: businessUnit.id, isActive: false })]));
    const eventsAgain = await workerFetch(eventCollection, { headers: jsonHeaders(token) });
    expect((await eventsAgain.json() as { events: { id: string; status: string }[] }).events)
      .toEqual(expect.arrayContaining([expect.objectContaining({ id: event.id, status: "cancelled" })]));
    const catalogOne = await workerFetch(`/api/facilities/${facility.id}/catalogs`, { headers: jsonHeaders(token) });
    const catalogTwo = await workerFetch(`/api/facilities/${facility.id}/catalogs`, { headers: jsonHeaders(token) });
    const categoriesOne = (await catalogOne.json() as { categories: { code: string }[] }).categories;
    const categoriesTwo = (await catalogTwo.json() as { categories: { code: string }[] }).categories;
    expect(categoriesOne).toEqual(categoriesTwo);
    expect(categoriesTwo.map(({ code }) => code)).toContain("STD");
  });

  it("bootstraps an unassigned administrator and logically deactivates the recinto only when empty", async () => {
    const { userId, token: initialToken } = await createUnassignedAdmin();
    const creation = await workerFetch("/api/facilities", {
      method: "POST",
      headers: jsonHeaders(initialToken),
      body: JSON.stringify({ name: "Bootstrap venue", address: "Test street", totalCapacity: 20 }),
    });
    expect(creation.status).toBe(201);
    const { facility, token } = await creation.json() as { facility: { id: string }; token: string };
    expect(token).toBeTruthy();
    expect(await getD1Database().prepare("SELECT facility_id FROM users WHERE id = ?")
      .bind(userId).first<{ facility_id: string }>()).toEqual({ facility_id: facility.id });
    const catalogs = await workerFetch(`/api/facilities/${facility.id}/catalogs`, { headers: jsonHeaders(token) });
    expect(catalogs.status).toBe(200);
    const { categories } = await catalogs.json() as { categories: { id: string; name: string; code: string; allocatedSlots: number }[] };
    expect(categories).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "General / Estándar", code: "STD", allocatedSlots: 20 }),
      expect.objectContaining({ name: "Accesible", code: "ACC", allocatedSlots: 0 }),
    ]));

    const categoryId = categories.find(({ code }) => code === "STD")?.id;
    expect(categoryId).toBeTruthy();
    const unitResponse = await workerFetch(`/api/facilities/${facility.id}/business-units`, {
      method: "POST",
      headers: jsonHeaders(token),
      body: JSON.stringify({ name: "Test unit", code: "BOOT", quotaType: "dynamic", defaultQuota: 0 }),
    });
    expect(unitResponse.status).toBe(201);
    const { businessUnit } = await unitResponse.json() as { businessUnit: { id: string } };
    const areaResponse = await workerFetch(`/api/facilities/${facility.id}/areas`, {
      method: "POST",
      headers: jsonHeaders(token),
      body: JSON.stringify({ name: "Test area", code: "BOOT-A", allocatedCapacity: 5, businessUnitId: businessUnit.id }),
    });
    expect(areaResponse.status).toBe(201);
    const { area } = await areaResponse.json() as { area: { id: string } };
    const entry = await workerFetch("/api/parking-sessions/entry", {
      method: "POST",
      headers: jsonHeaders(token),
      body: JSON.stringify({ facilityId: facility.id, businessUnitId: businessUnit.id, spaceCategoryId: categoryId, parkingAreaId: area.id, licensePlate: "ZX1Y23", entryTime: "2026-10-18T12:00:00.000Z" }),
    });
    expect(entry.status).toBe(201);

    const occupiedDeactivation = await workerFetch(`/api/facilities/${facility.id}/status`, {
      method: "PATCH", headers: jsonHeaders(token), body: JSON.stringify({ isActive: false }),
    });
    expect(occupiedDeactivation.status).toBe(409);

    const exit = await workerFetch("/api/parking-sessions/exit", {
      method: "POST",
      headers: jsonHeaders(token),
      body: JSON.stringify({ facilityId: facility.id, licensePlate: "ZX1Y23", exitTime: "2026-10-18T13:00:00.000Z" }),
    });
    expect(exit.status).toBe(200);
    const deactivation = await workerFetch(`/api/facilities/${facility.id}/status`, {
      method: "PATCH", headers: jsonHeaders(token), body: JSON.stringify({ isActive: false }),
    });
    expect(deactivation.status).toBe(200);
    expect(await getD1Database().prepare("SELECT is_active FROM facilities WHERE id = ?")
      .bind(facility.id).first<{ is_active: number }>()).toEqual({ is_active: 0 });
    expect((await workerFetch(`/api/facilities/${facility.id}/catalogs`, { headers: jsonHeaders(token) })).status).toBe(404);
    expect((await workerFetch(`/api/facilities/${facility.id}/dashboard`, { headers: jsonHeaders(token) })).status).toBe(404);
    const realtime = await workerFetch(`/api/events/${facility.id}`, {
      headers: {
        Upgrade: "websocket",
        "Sec-WebSocket-Protocol": `parking-events-v1, ${token}, client-1`,
      },
    });
    expect(realtime.status).toBe(404);
    const activeSessions = await workerFetch(`/api/parking-sessions/active?facilityId=${facility.id}`, { headers: jsonHeaders(token) });
    expect((await activeSessions.json() as { sessions: unknown[] }).sessions).toEqual([]);
    const repeatDeactivation = await workerFetch(`/api/facilities/${facility.id}/status`, {
      method: "PATCH",
      headers: jsonHeaders(token),
      body: JSON.stringify({ isActive: false }),
    });
    expect(repeatDeactivation.status).toBe(404);
    expect(await countRows(getD1Database(), "SELECT COUNT(*) AS count FROM audit_logs WHERE facility_id = ? AND entity_type = 'facility'", facility.id)).toBeGreaterThanOrEqual(2);
  });

  it("allows only one concurrent initial facility bootstrap for the same identity", async () => {
    const { userId, token } = await createUnassignedAdmin();
    const responses = await Promise.all(["First venue", "Second venue"].map((name) => workerFetch("/api/facilities", {
      method: "POST",
      headers: jsonHeaders(token),
      body: JSON.stringify({ name, totalCapacity: 10 }),
    })));
    expect(responses.map(({ status }) => status).sort()).toEqual([201, 409]);
    const assigned = await getD1Database().prepare("SELECT facility_id FROM users WHERE id = ?")
      .bind(userId).first<{ facility_id: string }>();
    expect(assigned?.facility_id).toBeTruthy();
    expect(await countRows(getD1Database(), "SELECT COUNT(*) AS count FROM facilities WHERE name IN ('First venue', 'Second venue')")).toBe(1);
  });

  it("configures the facility split, distributes it across areas, and rejects type over-allocation", async () => {
    const { token: bootstrapToken } = await createUnassignedAdmin();
    const createdResponse = await workerFetch("/api/facilities", {
      method: "POST",
      headers: jsonHeaders(bootstrapToken),
      body: JSON.stringify({ name: "Typed capacity venue", totalCapacity: 35, accessibleCapacity: 2 }),
    });
    expect(createdResponse.status).toBe(201);
    const { facility, token } = await createdResponse.json() as { facility: { id: string }; token: string };

    const catalogResponse = await workerFetch(`/api/facilities/${facility.id}/catalogs`, { headers: jsonHeaders(token) });
    const catalog = await catalogResponse.json() as { categories: { code: string; allocatedSlots: number }[] };
    expect(catalog.categories.find(({ code }) => code === "STD")?.allocatedSlots).toBe(33);
    expect(catalog.categories.find(({ code }) => code === "ACC")?.allocatedSlots).toBe(2);

    const areas = [] as { id: string; standardCapacity: number; accessibleCapacity: number; allocatedCapacity: number }[];
    for (const [code, standardCapacity] of [["A", 20], ["B", 10]] as const) {
      const response = await workerFetch(`/api/facilities/${facility.id}/areas`, {
        method: "POST",
        headers: jsonHeaders(token),
        body: JSON.stringify({ name: `Area ${code}`, code, standardCapacity, accessibleCapacity: 1 }),
      });
      expect(response.status).toBe(201);
      areas.push((await response.json() as { area: typeof areas[number] }).area);
    }
    expect(areas).toEqual(expect.arrayContaining([
      expect.objectContaining({ standardCapacity: 20, accessibleCapacity: 1, allocatedCapacity: 21 }),
      expect.objectContaining({ standardCapacity: 10, accessibleCapacity: 1, allocatedCapacity: 11 }),
    ]));

    const excessAccessible = await workerFetch(`/api/facilities/${facility.id}/areas`, {
      method: "POST",
      headers: jsonHeaders(token),
      body: JSON.stringify({ name: "Area C", code: "C", standardCapacity: 0, accessibleCapacity: 1 }),
    });
    expect(excessAccessible.status).toBe(409);
  });

  it("rejects duplicate codes, stale edits, capacity races, and audit-only partial commits", async () => {
    const facility = await createFacility(100);
    const token = await adminToken(facility.id);
    const areas = `/api/facilities/${facility.id}/areas`;
    const code = `D${crypto.randomUUID().slice(0, 5)}`;
    const first = await workerFetch(areas, {
      method: "POST", headers: jsonHeaders(token),
      body: JSON.stringify({ name: "Duplicate candidate", code, allocatedCapacity: 5 }),
    });
    expect(first.status).toBe(201);
    const { area } = await first.json() as { area: { id: string; version: number } };
    const duplicate = await workerFetch(areas, {
      method: "POST", headers: jsonHeaders(token),
      body: JSON.stringify({ name: "Duplicate area", code: code.toLowerCase(), allocatedCapacity: 1 }),
    });
    expect(duplicate.status).toBe(409);

    const stale = await workerFetch(`${areas}/${area.id}/capacity`, {
      method: "PATCH", headers: jsonHeaders(token),
      body: JSON.stringify({ allocatedCapacity: 6, version: area.version + 10 }),
    });
    expect(stale.status).toBe(409);
    const retired = await workerFetch(`${areas}/${area.id}/status`, {
      method: "PATCH", headers: jsonHeaders(token),
      body: JSON.stringify({ isActive: false, version: area.version }),
    });
    expect(retired.status).toBe(200);
    const duplicateAfterRetirement = await workerFetch(areas, {
      method: "POST", headers: jsonHeaders(token),
      body: JSON.stringify({ name: "Duplicate after retirement", code, allocatedCapacity: 1 }),
    });
    expect(duplicateAfterRetirement.status).toBe(409);

    const raceFacility = await createFacility(100);
    const raceToken = await adminToken(raceFacility.id);
    const racePath = `/api/facilities/${raceFacility.id}/areas`;
    const raceResponses = await Promise.all(["Race one", "Race two"].map((name) => workerFetch(racePath, {
      method: "POST", headers: jsonHeaders(raceToken),
      body: JSON.stringify({ name, code: `R${crypto.randomUUID().slice(0, 6)}`, allocatedCapacity: 60 }),
    })));
    expect(raceResponses.map(({ status }) => status).sort()).toEqual([201, 409]);
    const losingResponse = raceResponses.find(({ status }) => status === 409);
    const losingBody = await losingResponse?.json() as { error: string } | undefined;
    expect(losingBody?.error).toMatch(/buffer disponible Estándar \(40\)/);
    expect(await countRows(getD1Database(), "SELECT COALESCE(SUM(allocated_capacity), 0) AS count FROM parking_areas WHERE facility_id = ?", raceFacility.id)).toBeLessThanOrEqual(100);

    const database = getD1Database();
    await database.exec("CREATE TRIGGER fail_config_audit BEFORE INSERT ON audit_logs BEGIN SELECT RAISE(ABORT, 'test audit failure'); END");
    try {
      const failedCode = `F${crypto.randomUUID().slice(0, 6)}`;
      const failedWrite = await workerFetch(areas, {
        method: "POST", headers: jsonHeaders(token),
        body: JSON.stringify({ name: "Atomic audit failure", code: failedCode, allocatedCapacity: 1 }),
      });
      expect(failedWrite.status).toBeGreaterThanOrEqual(500);
      expect(await countRows(database, "SELECT COUNT(*) AS count FROM parking_areas WHERE facility_id = ? AND code = ?", facility.id, failedCode)).toBe(0);
    } finally {
      await database.exec("DROP TRIGGER IF EXISTS fail_config_audit");
    }
  });

  it("validates configuration inputs, missing records, and active dependencies", async () => {
    const facility = await createFacility(10);
    const token = await adminToken(facility.id);
    const areas = `/api/facilities/${facility.id}/areas`;
    const units = `/api/facilities/${facility.id}/business-units`;
    const events = `/api/facilities/${facility.id}/events`;
    const unknownFacility = `missing-${crypto.randomUUID()}`;
    const requestedFacilityId = `requested-${crypto.randomUUID()}`;

    const { token: bootstrapToken } = await createUnassignedAdmin();
    const requestedFacility = await workerFetch("/api/facilities", {
      method: "POST", headers: jsonHeaders(bootstrapToken),
      body: JSON.stringify({ id: requestedFacilityId, name: "Requested identifier", totalCapacity: 2 }),
    });
    expect(requestedFacility.status).toBe(400);
    expect(await countRows(getD1Database(), "SELECT COUNT(*) AS count FROM facilities WHERE id = ?", requestedFacilityId)).toBe(0);
    expect((await workerFetch(`/api/facilities/${facility.id}`, {
      method: "PUT", headers: jsonHeaders(token), body: JSON.stringify({ name: "Partially edited facility" }),
    })).status).toBe(200);

    expect((await workerFetch("/api/facilities", {
      method: "POST", headers: jsonHeaders(token), body: JSON.stringify({ name: "", totalCapacity: 0 }),
    })).status).toBe(400);
    expect((await workerFetch("/api/facilities", {
      method: "POST", headers: jsonHeaders(token), body: JSON.stringify({ name: "Second recinto", totalCapacity: 20 }),
    })).status).toBe(409);
    expect((await workerFetch(`/api/facilities/${unknownFacility}`, {
      method: "PUT", headers: jsonHeaders(token), body: JSON.stringify({ name: "Missing venue" }),
    })).status).toBe(403);
    expect((await workerFetch(`/api/facilities/${facility.id}`, {
      method: "PUT", headers: jsonHeaders(token), body: JSON.stringify({ totalCapacity: 0 }),
    })).status).toBe(400);
    const unknownFacilityToken = await adminToken(unknownFacility);
    expect((await workerFetch(`/api/facilities/${unknownFacility}/areas`, { headers: jsonHeaders(unknownFacilityToken) })).status).toBe(404);
    expect((await workerFetch(`/api/facilities/${unknownFacility}/business-units`, { headers: jsonHeaders(unknownFacilityToken) })).status).toBe(404);
    expect((await workerFetch(`/api/facilities/${unknownFacility}/events`, { headers: jsonHeaders(unknownFacilityToken) })).status).toBe(404);
    expect((await workerFetch(`/api/facilities/${unknownFacility}/catalogs`, { headers: jsonHeaders(unknownFacilityToken) })).status).toBe(404);

    expect((await workerFetch(units, {
      method: "POST", headers: jsonHeaders(token), body: JSON.stringify({}),
    })).status).toBe(400);
    const oversizedGuaranteedUnit = await workerFetch(units, {
      method: "POST", headers: jsonHeaders(token),
      body: JSON.stringify({ name: "Guaranteed", code: `G${crypto.randomUUID().slice(0, 5)}`, quotaType: "guaranteed", defaultQuota: 11 }),
    });
    expect(oversizedGuaranteedUnit.status).toBe(409);

    const dynamicUnitResponse = await workerFetch(units, {
      method: "POST", headers: jsonHeaders(token),
      body: JSON.stringify({ name: "Dynamic unit", code: `D${crypto.randomUUID().slice(0, 5)}`, quotaType: "dynamic", defaultQuota: 0 }),
    });
    expect(dynamicUnitResponse.status).toBe(201);
    const { businessUnit: createdDynamicUnit } = await dynamicUnitResponse.json() as { businessUnit: { id: string; code: string; version: number } };
    const dynamicUnitUpdate = await workerFetch(`${units}/${createdDynamicUnit.id}`, {
      method: "PUT", headers: jsonHeaders(token),
      body: JSON.stringify({ name: "Dynamic unit updated", code: createdDynamicUnit.code, quotaType: "dynamic", defaultQuota: 0, version: createdDynamicUnit.version }),
    });
    expect(dynamicUnitUpdate.status).toBe(200);
    const { businessUnit: dynamicUnit } = await dynamicUnitUpdate.json() as { businessUnit: { id: string; version: number } };
    const contractualUnitResponse = await workerFetch(units, {
      method: "POST", headers: jsonHeaders(token),
      body: JSON.stringify({ name: "Contractual unit", code: `C${crypto.randomUUID().slice(0, 5)}`, quotaType: "contractual", defaultQuota: 0 }),
    });
    expect(contractualUnitResponse.status).toBe(201);
    const { businessUnit: contractualUnit } = await contractualUnitResponse.json() as { businessUnit: { id: string } };
    const retirementUnitResponse = await workerFetch(units, {
      method: "POST", headers: jsonHeaders(token),
      body: JSON.stringify({ name: "Retirable unit", code: `R${crypto.randomUUID().slice(0, 5)}`, quotaType: "dynamic", defaultQuota: 0 }),
    });
    expect(retirementUnitResponse.status).toBe(201);
    const { businessUnit: retirementUnit } = await retirementUnitResponse.json() as { businessUnit: { id: string; version: number } };
    expect((await workerFetch(`${units}/${retirementUnit.id}/status`, {
      method: "PATCH", headers: jsonHeaders(token), body: JSON.stringify({ isActive: false, version: retirementUnit.version }),
    })).status).toBe(200);

    expect((await workerFetch(areas, {
      method: "POST", headers: jsonHeaders(token), body: JSON.stringify({ name: "x", code: "X", allocatedCapacity: 1 }),
    })).status).toBe(400);
    expect((await workerFetch(areas, {
      method: "POST", headers: jsonHeaders(token), body: JSON.stringify({ name: "Unknown unit", code: "UNK", allocatedCapacity: 1, businessUnitId: "missing-unit" }),
    })).status).toBe(409);
    expect((await workerFetch(areas, {
      method: "POST", headers: jsonHeaders(token), body: JSON.stringify({ name: "Too large", code: "BIG", allocatedCapacity: 11 }),
    })).status).toBe(409);

    const categoryId = await insertCategory(facility.id);
    const areaResponse = await workerFetch(areas, {
      method: "POST", headers: jsonHeaders(token),
      body: JSON.stringify({ name: "Occupied area", code: `OA${crypto.randomUUID().slice(0, 4)}`, allocatedCapacity: 4, businessUnitId: dynamicUnit.id }),
    });
    expect(areaResponse.status).toBe(201);
    const { area } = await areaResponse.json() as { area: { id: string; version: number; code: string } };
    const spareAreaResponse = await workerFetch(areas, {
      method: "POST", headers: jsonHeaders(token),
      body: JSON.stringify({ name: "Spare area", code: `SA${crypto.randomUUID().slice(0, 4)}`, allocatedCapacity: 1 }),
    });
    expect(spareAreaResponse.status).toBe(201);
    const { area: spareArea } = await spareAreaResponse.json() as { area: { id: string; version: number } };
    expect((await workerFetch(`${areas}/${spareArea.id}/status`, {
      method: "PATCH", headers: jsonHeaders(token), body: JSON.stringify({ isActive: false, version: spareArea.version }),
    })).status).toBe(200);
    const activeEntry = await workerFetch("/api/parking-sessions/entry", {
      method: "POST", headers: jsonHeaders(token),
      body: JSON.stringify({
        facilityId: facility.id, businessUnitId: dynamicUnit.id, spaceCategoryId: categoryId,
        parkingAreaId: area.id, licensePlate: "ZX1Y23", entryTime: "2026-10-17T10:00:00.000Z",
      }),
    });
    expect(activeEntry.status, JSON.stringify(await activeEntry.clone().json())).toBe(201);
    expect((await workerFetch("/api/parking-sessions/entry", {
      method: "POST", headers: jsonHeaders(token),
      body: JSON.stringify({ facilityId: facility.id, businessUnitId: dynamicUnit.id, spaceCategoryId: categoryId, licensePlate: "AB2C34" }),
    })).status).toBe(201);
    const areasAfterDeactivation = await workerFetch(areas, { headers: jsonHeaders(token) });
    expect((await areasAfterDeactivation.json() as { areas: { id: string; availableSlots: number }[] }).areas)
      .toEqual(expect.arrayContaining([expect.objectContaining({ id: spareArea.id, availableSlots: 0 })]));
    expect((await workerFetch(`/api/facilities/${facility.id}`, {
      method: "PUT", headers: jsonHeaders(token), body: JSON.stringify({ totalCapacity: 1 }),
    })).status).toBe(409);

    expect((await workerFetch(`${areas}/${area.id}/capacity`, {
      method: "PATCH", headers: jsonHeaders(token), body: JSON.stringify({ allocatedCapacity: 0, version: area.version }),
    })).status).toBe(409);
    expect((await workerFetch(`${areas}/${area.id}/status`, {
      method: "PATCH", headers: jsonHeaders(token), body: JSON.stringify({ isActive: false, version: area.version }),
    })).status).toBe(409);
    expect((await workerFetch(`${units}/${dynamicUnit.id}/status`, {
      method: "PATCH", headers: jsonHeaders(token), body: JSON.stringify({ isActive: false, version: dynamicUnit.version }),
    })).status).toBe(409);
    expect((await workerFetch(units, { headers: jsonHeaders(token) })).status).toBe(200);
    expect((await workerFetch(`${areas}/missing-area`, {
      method: "PUT", headers: jsonHeaders(token), body: JSON.stringify({ name: "Missing area", code: "MISS", description: "", allocatedCapacity: 1, businessUnitId: null, version: 1 }),
    })).status).toBe(404);
    expect((await workerFetch(`${areas}/${area.id}/capacity`, {
      method: "PATCH", headers: jsonHeaders(token), body: JSON.stringify({ allocatedCapacity: -1, version: area.version }),
    })).status).toBe(400);
    expect((await workerFetch(`${areas}/${area.id}/status`, {
      method: "PATCH", headers: jsonHeaders(token), body: JSON.stringify({ isActive: true, version: area.version }),
    })).status).toBe(400);

    const invalidEvent = await workerFetch(events, {
      method: "POST", headers: jsonHeaders(token), body: JSON.stringify({ title: "bad", businessUnitId: dynamicUnit.id }),
    });
    expect(invalidEvent.status).toBe(400);
    const eventBase = {
      title: "Future event", businessUnitId: contractualUnit.id, reservedSlots: 11,
      startTime: "2032-11-04T21:00:00.000Z", endTime: "2032-11-05T05:00:00.000Z",
    };
    expect((await workerFetch(events, {
      method: "POST", headers: jsonHeaders(token), body: JSON.stringify({ ...eventBase, businessUnitId: dynamicUnit.id, reservedSlots: 1 }),
    })).status).toBe(400);
    expect((await workerFetch(events, {
      method: "POST", headers: jsonHeaders(token), body: JSON.stringify(eventBase),
    })).status).toBe(409);
    const eventResponse = await workerFetch(events, {
      method: "POST", headers: jsonHeaders(token), body: JSON.stringify({ ...eventBase, reservedSlots: 2 }),
    });
    expect(eventResponse.status).toBe(201);
    const { event } = await eventResponse.json() as { event: { id: string; version: number } };
    const secondEvent = await workerFetch(events, {
      method: "POST", headers: jsonHeaders(token), body: JSON.stringify({ ...eventBase, title: "Second future event", reservedSlots: 2 }),
    });
    expect(secondEvent.status).toBe(201);
    expect((await workerFetch(`${units}/${contractualUnit.id}/status`, {
      method: "PATCH", headers: jsonHeaders(token), body: JSON.stringify({ isActive: false, version: 1 }),
    })).status).toBe(409);
    expect((await workerFetch(`${events}/${event.id}`, {
      method: "PUT", headers: jsonHeaders(token),
      body: JSON.stringify({ ...eventBase, businessUnitId: dynamicUnit.id, version: event.version }),
    })).status).toBe(400);
    expect((await workerFetch(`${units}/${contractualUnit.id}`, {
      method: "PUT", headers: jsonHeaders(token),
      body: JSON.stringify({ name: "Contractual unit", code: `C${crypto.randomUUID().slice(0, 5)}`, quotaType: "dynamic", defaultQuota: 0, version: 1 }),
    })).status).toBe(409);
    expect((await workerFetch(`${events}/${event.id}/status`, {
      method: "PATCH", headers: jsonHeaders(token), body: JSON.stringify({ status: "cancelled", version: event.version }),
    })).status).toBe(200);
    expect((await workerFetch(`${events}/${event.id}/status`, {
      method: "PATCH", headers: jsonHeaders(token), body: JSON.stringify({ status: "cancelled", version: event.version }),
    })).status).toBe(409);
    expect((await workerFetch(`${events}/missing-event`, {
      method: "PUT", headers: jsonHeaders(token), body: JSON.stringify({ ...eventBase, version: 1 }),
    })).status).toBe(404);

    const bindings = env as unknown as Record<string, unknown>;
    const originalDatabase = bindings.PARKING_DB;
    Reflect.set(bindings, "PARKING_DB", undefined);
    try {
      const reads = [
        workerFetch("/api/facilities", { headers: jsonHeaders(token) }),
        workerFetch(`/api/facilities/${facility.id}/areas`, { headers: jsonHeaders(token) }),
        workerFetch(`/api/facilities/${facility.id}/business-units`, { headers: jsonHeaders(token) }),
        workerFetch(`/api/facilities/${facility.id}/events`, { headers: jsonHeaders(token) }),
        workerFetch(`/api/facilities/${facility.id}/catalogs`, { headers: jsonHeaders(token) }),
        workerFetch(`/api/facilities/${facility.id}/dashboard`, { headers: jsonHeaders(token) }),
      ];
      expect((await Promise.all(reads)).map(({ status }) => status)).toEqual([500, 500, 500, 500, 500, 500]);
    } finally {
      Reflect.set(bindings, "PARKING_DB", originalDatabase);
    }
  });
});
