import { env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { applyD1Migrations, countRows, getD1Database, workerFetch } from "./support/d1-fixture";
import { signJwt, verifyJwt } from "../../src/server/middleware/auth";

interface TestCredentials {
  adminUsername: string;
  adminPassword: string;
  operatorUsername: string;
  operatorPassword: string;
  jwtSecret: string;
}

let credentials: TestCredentials;
const bindings = env as unknown as Record<string, unknown>;

async function installEphemeralCredentials(): Promise<void> {
  const suffix = crypto.randomUUID().slice(0, 8);
  credentials = {
    adminUsername: `admin-${suffix}`,
    adminPassword: crypto.randomUUID(),
    operatorUsername: `operator-${suffix}`,
    operatorPassword: crypto.randomUUID(),
    jwtSecret: crypto.randomUUID() + crypto.randomUUID(),
  };
  const values = {
    ADMIN_USERNAME: credentials.adminUsername,
    ADMIN_PASSWORD: credentials.adminPassword,
    OPERATOR_USERNAME: credentials.operatorUsername,
    OPERATOR_PASSWORD: credentials.operatorPassword,
    JWT_SECRET: credentials.jwtSecret,
  };
  for (const [key, value] of Object.entries(values)) {
    if (!Reflect.set(bindings, key, value)) throw new Error("Worker test environment cannot inject ephemeral login variables");
  }
}

async function login(username?: string, password?: string): Promise<{ response: Response; body: Record<string, unknown> }> {
  const response = await workerFetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  return { response, body: await response.json() as Record<string, unknown> };
}

async function seedRoleFacility(): Promise<void> {
  const database = getD1Database();
  const now = new Date().toISOString();
  await database.prepare(
    "INSERT OR IGNORE INTO facilities (id, name, address, total_capacity, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).bind("fac-default-01", "Auth role fixture", "", 300, 1, now, now).run();
  await database.prepare(
    "INSERT OR IGNORE INTO business_units (id, facility_id, name, code, priority_level, quota_type, default_quota, is_active, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  ).bind("bu-auth-existing", "fac-default-01", "Auth fixture unit", "AUTH", 3, "dynamic", 10, 1, 1).run();
}

describe("Local authentication persistence through the Worker API", () => {
  beforeAll(async () => {
    await applyD1Migrations();
    await installEphemeralCredentials();
    await seedRoleFacility();
  });

  it("bootstraps both configured identities idempotently without password data in D1", async () => {
    const firstAdmin = await login(credentials.adminUsername, credentials.adminPassword);
    expect(firstAdmin.response.status).toBe(200);
    expect(firstAdmin.body).toMatchObject({ user: { role: "admin" } });
    const firstOperator = await login(credentials.operatorUsername, credentials.operatorPassword);
    expect(firstOperator.response.status).toBe(200);
    expect(firstOperator.body).toMatchObject({ user: { role: "operator" } });

    const database = getD1Database();
    const adminRow = await database.prepare("SELECT * FROM users WHERE username = ?").bind(credentials.adminUsername).first<Record<string, unknown>>();
    const operatorRow = await database.prepare("SELECT * FROM users WHERE username = ?").bind(credentials.operatorUsername).first<Record<string, unknown>>();
    expect(adminRow).toMatchObject({ username: credentials.adminUsername, role: "admin" });
    expect(operatorRow).toMatchObject({ username: credentials.operatorUsername, role: "operator" });
    for (const row of [adminRow, operatorRow]) {
      const columns = Object.keys(row ?? {}).map((column) => column.toLowerCase());
      expect(columns).not.toContain("password");
      expect(columns).not.toContain("password_hash");
    }

    const countBefore = await countRows(database, "SELECT COUNT(*) AS count FROM users WHERE username IN (?, ?)", credentials.adminUsername, credentials.operatorUsername);
    expect((await login(credentials.adminUsername, credentials.adminPassword)).response.status).toBe(200);
    expect((await login(credentials.operatorUsername, credentials.operatorPassword)).response.status).toBe(200);
    const countAfter = await countRows(database, "SELECT COUNT(*) AS count FROM users WHERE username IN (?, ?)", credentials.adminUsername, credentials.operatorUsername);
    expect(countAfter).toBe(countBefore);
  });

  it("uses indistinguishable failures for an unknown account and a wrong password", async () => {
    const wrongPassword = await login(credentials.adminUsername, crypto.randomUUID());
    const unknownUser = await login(`absent-${crypto.randomUUID()}`, crypto.randomUUID());
    expect(wrongPassword.response.status).toBe(401);
    expect(unknownUser.response.status).toBe(401);
    expect(unknownUser.body.error).toBe(wrongPassword.body.error);
  });

  it("validates login fields, distinct configured usernames, and protected-route signing configuration", async () => {
    const invalid = await workerFetch("/api/auth/login", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "", password: "" }),
    });
    expect(invalid.status).toBe(400);

    const originalAdminUsername = bindings.ADMIN_USERNAME;
    Reflect.set(bindings, "ADMIN_USERNAME", credentials.operatorUsername.toUpperCase());
    try {
      const duplicateNames = await login(credentials.adminUsername, credentials.adminPassword);
      expect(duplicateNames.response.status).toBe(500);
      expect(String(duplicateNames.body.error)).toBe("Error interno del servidor");
    } finally {
      Reflect.set(bindings, "ADMIN_USERNAME", originalAdminUsername);
    }

    const originalSecret = bindings.JWT_SECRET;
    Reflect.set(bindings, "JWT_SECRET", undefined);
    try {
      const protectedResponse = await workerFetch("/api/parking-sessions/active?facilityId=missing", {
        headers: { Authorization: "Bearer invalid-token" },
      });
      expect(protectedResponse.status).toBe(500);
    } finally {
      Reflect.set(bindings, "JWT_SECRET", originalSecret);
    }

    const claims = {
      userId: `jwt-${crypto.randomUUID()}`,
      username: "jwt-test-user",
      role: "operator" as const,
      facilityId: "fac-default-01",
    };
    const token = await signJwt(claims, credentials.jwtSecret);
    expect(await verifyJwt(token, credentials.jwtSecret)).toMatchObject(claims);
    expect(await verifyJwt("malformed-token", credentials.jwtSecret)).toBeNull();
    expect(await verifyJwt(token, `wrong-${credentials.jwtSecret}`)).toBeNull();
    const expiredToken = await signJwt(claims, credentials.jwtSecret, -1);
    expect(await verifyJwt(expiredToken, credentials.jwtSecret)).toBeNull();
    expect((await workerFetch("/api/parking-sessions/active?facilityId=missing", {
      headers: { Authorization: "Bearer malformed-token" },
    })).status).toBe(401);
  });

  it("fails closed without exposing missing local configuration or credential values", async () => {
    const cases: Array<{ key: string; username: string; password: string }> = [
      { key: "ADMIN_USERNAME", username: credentials.adminUsername, password: credentials.adminPassword },
      { key: "ADMIN_PASSWORD", username: credentials.adminUsername, password: credentials.adminPassword },
      { key: "OPERATOR_USERNAME", username: credentials.operatorUsername, password: credentials.operatorPassword },
      { key: "OPERATOR_PASSWORD", username: credentials.operatorUsername, password: credentials.operatorPassword },
      { key: "JWT_SECRET", username: credentials.adminUsername, password: credentials.adminPassword },
    ];
    const originalValues: Record<string, unknown> = {
      ADMIN_USERNAME: credentials.adminUsername,
      ADMIN_PASSWORD: credentials.adminPassword,
      OPERATOR_USERNAME: credentials.operatorUsername,
      OPERATOR_PASSWORD: credentials.operatorPassword,
      JWT_SECRET: credentials.jwtSecret,
    };

    for (const { key, username, password } of cases) {
      Reflect.set(bindings, key, undefined);
      try {
        const { response, body } = await login(username, password);
        expect(response.status).toBeGreaterThanOrEqual(400);
        expect(response.status).not.toBe(200);
        expect(response.status).toBe(500);
        expect(String(body.error ?? "")).toBe("Error interno del servidor");
        expect(JSON.stringify(body)).not.toContain(key);
        expect(JSON.stringify(body)).not.toContain(credentials.adminPassword);
        expect(JSON.stringify(body)).not.toContain(credentials.operatorPassword);
        expect(JSON.stringify(body)).not.toContain(credentials.jwtSecret);
      } finally {
        Reflect.set(bindings, key, originalValues[key]);
      }
    }
  });

  it("fails closed when D1 is absent and preserves role authorization across requests", async () => {
    const originalDatabase = bindings.PARKING_DB;
    Reflect.set(bindings, "PARKING_DB", undefined);
    try {
      const missingDatabase = await login(credentials.adminUsername, credentials.adminPassword);
      expect(missingDatabase.response.status).toBeGreaterThanOrEqual(500);
    } finally {
      Reflect.set(bindings, "PARKING_DB", originalDatabase);
    }

    const admin = await login(credentials.adminUsername, credentials.adminPassword);
    const operator = await login(credentials.operatorUsername, credentials.operatorPassword);
    expect(admin.response.status).toBe(200);
    expect(operator.response.status).toBe(200);
    const adminToken = String(admin.body.token);
    const operatorToken = String(operator.body.token);
    const path = "/api/facilities/fac-default-01/business-units";
    const payload = { name: "Role persistence unit", code: `R${crypto.randomUUID().slice(0, 6)}`, quotaType: "dynamic", defaultQuota: 1 };

    const adminWrite = await workerFetch(path, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    expect(adminWrite.status).toBe(201);
    const operatorWrite = await workerFetch(path, {
      method: "POST",
      headers: { Authorization: `Bearer ${operatorToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, code: `O${crypto.randomUUID().slice(0, 6)}` }),
    });
    expect(operatorWrite.status).toBe(403);
  });
});
