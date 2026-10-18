import { env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { signJwt } from "../../src/server/middleware/auth";
import { applyD1Migrations, getD1Database, workerFetch } from "./support/d1-fixture";

const bindings = env as unknown as Record<string, unknown>;
const facilityOne = "security-facility-one";
const facilityTwo = "security-facility-two";
let secret = "";
let adminOne = "";
let operatorOne = "";

async function addFacility(id: string): Promise<void> {
  const now = new Date().toISOString();
  await getD1Database().prepare(
    "INSERT OR IGNORE INTO facilities (id, name, address, total_capacity, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).bind(id, `Security fixture ${id}`, "", 100, 1, now, now).run();
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

describe("default-deny API route security", () => {
  beforeAll(async () => {
    await applyD1Migrations();
    secret = crypto.randomUUID() + crypto.randomUUID();
    const testCredentials = {
      ADMIN_USERNAME: `security-admin-${crypto.randomUUID()}`,
      ADMIN_PASSWORD: crypto.randomUUID(),
      OPERATOR_USERNAME: `security-operator-${crypto.randomUUID()}`,
      OPERATOR_PASSWORD: crypto.randomUUID(),
      JWT_SECRET: secret,
    };
    for (const [key, value] of Object.entries(testCredentials)) {
      if (!Reflect.set(bindings, key, value)) throw new Error("Worker test environment cannot inject ephemeral login variables");
    }
    await addFacility(facilityOne);
    await addFacility(facilityTwo);
    adminOne = await signJwt({ userId: "security-admin", username: "security-admin", role: "admin", facilityId: facilityOne }, secret);
    operatorOne = await signJwt({ userId: "security-operator", username: "security-operator", role: "operator", facilityId: facilityOne }, secret);
  });

  it("rejects anonymous data reads while keeping only health and login public", async () => {
    const dataRequests: Array<[string, RequestInit?]> = [
      ["/api/facilities"],
      [`/api/facilities/${facilityOne}/catalogs`],
      [`/api/facilities/${facilityOne}/dashboard`],
      [`/api/parking-sessions/active?facilityId=${facilityOne}`],
      ["/api/sync/delta", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ facilityId: facilityOne, deviceId: "test", mutations: [] }) }],
    ];
    for (const [path, init] of dataRequests) {
      const response = await workerFetch(path, init);
      expect(response.status, path).toBe(401);
      expect(response.headers.get("Cache-Control")).toContain("no-store");
    }

    const health = await workerFetch("/api/health");
    expect(health.status).toBe(200);
    expect(health.headers.get("Cache-Control")).toContain("no-store");
    const login = await workerFetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "unknown", password: "unknown" }),
    });
    expect(login.status).toBe(401);
    expect(login.headers.get("Cache-Control")).toContain("no-store");
  });

  it("allows the assigned facility, rejects other facilities, and limits the facility collection", async () => {
    const own = await workerFetch(`/api/facilities/${facilityOne}/catalogs`, { headers: authHeaders(adminOne) });
    expect(own.status).toBe(200);

    const otherCatalog = await workerFetch(`/api/facilities/${facilityTwo}/catalogs`, { headers: authHeaders(adminOne) });
    expect(otherCatalog.status).toBe(403);
    const otherSessions = await workerFetch(`/api/parking-sessions/active?facilityId=${facilityTwo}`, { headers: authHeaders(adminOne) });
    expect(otherSessions.status).toBe(403);
    const otherSync = await workerFetch("/api/sync/delta", {
      method: "POST",
      headers: authHeaders(adminOne),
      body: JSON.stringify({ facilityId: facilityTwo, deviceId: "test", mutations: [] }),
    });
    expect(otherSync.status).toBe(403);

    const collection = await workerFetch("/api/facilities", { headers: authHeaders(adminOne) });
    expect(collection.status).toBe(200);
    const { facilities } = await collection.json() as { facilities: Array<{ id: string }> };
    expect(facilities.map(({ id }) => id)).toContain(facilityOne);
    expect(facilities.map(({ id }) => id)).not.toContain(facilityTwo);
  });

  it("rejects operator configuration writes before modifying D1", async () => {
    const database = getD1Database();
    const before = await database.prepare("SELECT COUNT(*) AS count FROM parking_areas WHERE facility_id = ?")
      .bind(facilityOne).first<{ count: number }>();
    const response = await workerFetch(`/api/facilities/${facilityOne}/areas`, {
      method: "POST",
      headers: authHeaders(operatorOne),
      body: JSON.stringify({ name: "Operator forbidden", code: `OF-${crypto.randomUUID().slice(0, 6)}`, allocatedCapacity: 1 }),
    });
    expect(response.status).toBe(403);
    const after = await database.prepare("SELECT COUNT(*) AS count FROM parking_areas WHERE facility_id = ?")
      .bind(facilityOne).first<{ count: number }>();
    expect(after?.count).toBe(before?.count);
  });
});
