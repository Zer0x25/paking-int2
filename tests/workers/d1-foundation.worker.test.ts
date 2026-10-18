import { env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import {
  applyD1Migrations,
  applyLocalCatalogSeed,
  countRows,
  getD1Database,
  getMigrationFileCount,
  readRows,
  workerFetch,
} from "./support/d1-fixture";
import { MissingD1BindingError } from "../../src/server/db/client";
import { mutationFailure, readFailure } from "../../src/server/routes/http-errors";
import { PersistenceConflictError } from "../../src/server/db/repositories/write-transaction";
import { loadFacilitySnapshot } from "../../src/server/db/repositories/catalog-repository";
import type { AppD1Database, AppEnvironment } from "../../src/server/types/app-environment";
import { signJwt } from "../../src/server/middleware/auth";

const requiredTables = [
  "facilities",
  "space_categories",
  "parking_areas",
  "business_units",
  "event_bookings",
  "parking_sessions",
  "users",
  "audit_logs",
  "sync_mutations",
];

let adminAuthorization = "";

describe("D1 persistence foundation", () => {
  beforeAll(async () => {
    await applyD1Migrations();
    await applyLocalCatalogSeed();
    const signingSecret = crypto.randomUUID() + crypto.randomUUID();
    Reflect.set(env as unknown as Record<string, unknown>, "JWT_SECRET", signingSecret);
    const token = await signJwt({
      userId: "d1-foundation-admin",
      username: "d1-foundation-admin",
      role: "admin",
      facilityId: "fac-default-01",
    }, signingSecret);
    adminAuthorization = `Bearer ${token}`;
  });

  it("applies the feature migrations and creates the required tables and indexes", async () => {
    const database = getD1Database();
    expect(getMigrationFileCount()).toBeGreaterThan(0);

    const tableRows = await readRows<{ name: string }>(
      database,
      "SELECT name FROM sqlite_master WHERE type = 'table'",
    );
    const tableNames = tableRows.map(({ name }) => name);
    expect(tableNames).toEqual(expect.arrayContaining(requiredTables));

    const foreignKeys = await readRows<{ table: string }>(database, "PRAGMA foreign_key_list('parking_sessions')");
    expect(foreignKeys.map(({ table }) => table)).toEqual(expect.arrayContaining(["facilities", "business_units", "space_categories", "parking_areas"]));

    const activeSessionIndexes = await readRows<{ name: string; unique: number; partial: number }>(
      database,
      "PRAGMA index_list('parking_sessions')",
    );
    const activePlateIndex = activeSessionIndexes.find(({ unique, partial }) => unique === 1 && partial === 1);
    expect(activePlateIndex).toBeDefined();
    const activePlateColumns = await readRows<{ name: string }>(database, `PRAGMA index_info('${activePlateIndex?.name ?? ""}')`);
    expect(activePlateColumns.map(({ name }) => name)).toEqual(["facility_id", "license_plate"]);

    const userColumns = await readRows<{ name: string }>(database, "PRAGMA table_info('users')");
    expect(userColumns.map(({ name }) => name)).toEqual(expect.arrayContaining(["username", "full_name", "role", "facility_id"]));
    expect(userColumns.map(({ name }) => name.toLowerCase())).not.toContain("password");
    expect(userColumns.map(({ name }) => name.toLowerCase())).not.toContain("password_hash");
  });

  it("can reapply the local migrations without replacing already stored rows", async () => {
    const database = getD1Database();
    const fixtureId = `migration-replay-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    await database.prepare(
      "INSERT INTO facilities (id, name, address, total_capacity, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).bind(fixtureId, "Migration replay fixture", "", 12, 1, now, now).run();
    const before = await countRows(database, "SELECT COUNT(*) AS count FROM facilities WHERE id = ?", fixtureId);

    await applyD1Migrations(database);

    const after = await countRows(database, "SELECT COUNT(*) AS count FROM facilities WHERE id = ?", fixtureId);
    expect(after).toBe(before);
  });

  it("seeds the local catalog once and preserves later edits on repeated initialization", async () => {
    const database = getD1Database();
    const before = await database.prepare("SELECT name FROM facilities WHERE id = 'fac-default-01'").first<{ name: string }>();
    expect(before?.name).toBe("Centro de Convenciones & Hotel Grand");
    await database.prepare("UPDATE facilities SET name = ?, version = version + 1 WHERE id = 'fac-default-01'").bind("Edited local facility").run();
    await applyLocalCatalogSeed(database);
    const after = await database.prepare("SELECT name FROM facilities WHERE id = 'fac-default-01'").first<{ name: string }>();
    expect(after?.name).toBe("Edited local facility");
    expect(await countRows(database, "SELECT COUNT(*) AS count FROM __local_catalog_seed")).toBe(0);
  });

  it("returns an explicit error and leaves no domain row when an audit write fails", async () => {
    const database = getD1Database();
    await database.exec("CREATE TRIGGER fail_test_audit BEFORE INSERT ON audit_logs BEGIN SELECT RAISE(ABORT, 'test audit failure'); END");
    try {
      const response = await workerFetch("/api/facilities", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: adminAuthorization },
        body: JSON.stringify({ name: "Audit rollback fixture", totalCapacity: 30, address: "" }),
      });
      expect(response.status).toBeGreaterThanOrEqual(500);
      expect(await countRows(database, "SELECT COUNT(*) AS count FROM facilities WHERE name = ?", "Audit rollback fixture")).toBe(0);
      expect(await countRows(database, "SELECT COUNT(*) AS count FROM audit_logs WHERE entity_type = ?", "facility")).toBe(0);
    } finally {
      await database.exec("DROP TRIGGER IF EXISTS fail_test_audit");
    }
  });

  it("fails closed when the D1 binding is unavailable on a configuration write", async () => {
    const bindings = (await import("cloudflare:test")).env as unknown as Record<string, unknown>;
    const original = bindings.PARKING_DB;
    const changed = Reflect.set(bindings, "PARKING_DB", undefined);
    expect(changed).toBe(true);
    try {
      const response = await workerFetch("/api/facilities", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: adminAuthorization },
        body: JSON.stringify({ name: "No binding fixture", totalCapacity: 4 }),
      });
      expect(response.status).toBeGreaterThanOrEqual(500);
      expect((await workerFetch("/api/facilities", { headers: { Authorization: adminAuthorization } })).status).toBe(500);
    } finally {
      Reflect.set(bindings, "PARKING_DB", original);
    }
  });

  it("maps database and conflict errors to explicit mutation responses", () => {
    expect(mutationFailure(new PersistenceConflictError("stale"), "fallback")).toMatchObject({ status: 409, error: "stale" });
    expect(mutationFailure(new MissingD1BindingError(), "fallback").status).toBe(500);
    expect(mutationFailure(new Error("UNIQUE constraint failed"), "fallback").status).toBe(409);
    expect(mutationFailure(new Error("unexpected"), "fallback")).toMatchObject({ status: 500, error: "fallback" });
    expect(mutationFailure("unknown", "fallback")).toMatchObject({ status: 500, error: "fallback" });
    expect(readFailure("unknown", "fallback")).toMatchObject({ status: 500, error: "fallback" });
  });

  it("treats a D1 batch with no facility row as an absent snapshot", async () => {
    const emptyDatabase = {
      prepare: () => ({ bind: () => ({}) }),
      batch: async () => [],
    } as unknown as AppD1Database;
    await expect(loadFacilitySnapshot({ PARKING_DB: emptyDatabase } as AppEnvironment["Bindings"], "missing")).resolves.toBeNull();
  });
});
