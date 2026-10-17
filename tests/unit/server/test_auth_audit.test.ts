import { describe, it, expect } from "vitest";
import { signJwt, verifyJwt, authMiddleware } from "@server/middleware/auth";
import { authenticateLocalCredential, readLocalCredentialConfiguration } from "@server/services/local-credential-auth";
import { getFacilityAvailability, checkAllocationAvailability } from "@server/services/allocation-service";
import * as dbSchema from "@server/db/schema";
import { Hono } from "hono";
import type { AppEnvironment } from "@server/types/app-environment";
import type { Facility, BusinessUnit } from "@core/types/schema";

describe("Authentication, RBAC, and persisted allocation boundaries", () => {
  const secret = "test-jwt-secret-key-1234567890123456";
  const facility: Facility = { id: "fac-1", name: "Facility", address: "", totalCapacity: 10, createdAt: "2026-10-17T00:00:00.000Z", updatedAt: "2026-10-17T00:00:00.000Z" };
  const unit: BusinessUnit = { id: "unit-1", facilityId: facility.id, name: "Hotel", code: "HOTEL", priorityLevel: 1, quotaType: "guaranteed", defaultQuota: 4, isActive: true, version: 1 };

  it("generates and verifies HMAC JWTs and rejects expired or corrupted tokens", async () => {
    const token = await signJwt({ userId: "user-123", username: "admin_user", role: "admin", facilityId: facility.id }, secret, 3600);
    expect(token.split(".")).toHaveLength(3);
    expect((await verifyJwt(token, secret))?.username).toBe("admin_user");
    const expired = await signJwt({ userId: "user-123", username: "admin_user", role: "admin" }, secret, -10);
    expect(await verifyJwt(expired, secret)).toBeNull();
    expect(await verifyJwt("not.a.valid.jwt", secret)).toBeNull();
  });

  it("uses configured credentials and returns no password in the authenticated identity", () => {
    const configuration = readLocalCredentialConfiguration({
      ADMIN_USERNAME: "site-admin", ADMIN_PASSWORD: "private-admin-password",
      OPERATOR_USERNAME: "gate-operator", OPERATOR_PASSWORD: "private-operator-password", JWT_SECRET: secret,
    });
    expect(authenticateLocalCredential(configuration, "SITE-ADMIN", "private-admin-password"))
      .toEqual({ username: "site-admin", fullName: "Administrador del Sistema", role: "admin" });
    expect(authenticateLocalCredential(configuration, "site-admin", "incorrect")).toBeNull();
    expect(() => readLocalCredentialConfiguration({
      ADMIN_USERNAME: configuration.adminUsername,
      ADMIN_PASSWORD: configuration.adminPassword,
      OPERATOR_USERNAME: configuration.operatorUsername,
      OPERATOR_PASSWORD: configuration.operatorPassword,
      JWT_SECRET: "",
    })).toThrow("JWT_SECRET");
  });

  it("enforces authentication, configured JWT secret, and admin-only access", async () => {
    const app = new Hono<AppEnvironment>();
    app.use("/protected/*", authMiddleware("admin"));
    app.get("/protected/secret", (c) => c.json({ ok: true }));
    expect((await app.request("/protected/secret")).status).toBe(401);

    const adminToken = await signJwt({ userId: "1", username: "admin", role: "admin" }, secret);
    const adminResponse = await app.request("/protected/secret", { headers: { Authorization: `Bearer ${adminToken}` } }, { JWT_SECRET: secret });
    expect(adminResponse.status).toBe(200);

    const operatorToken = await signJwt({ userId: "2", username: "operator", role: "operator" }, secret);
    const forbidden = await app.request("/protected/secret", { headers: { Authorization: `Bearer ${operatorToken}` } }, { JWT_SECRET: secret });
    expect(forbidden.status).toBe(403);

    const noSecret = await app.request("/protected/secret", { headers: { Authorization: `Bearer ${adminToken}` } });
    expect(noSecret.status).toBe(500);
  });

  it("exports the D1 schema and calculates allocation only from the supplied facility snapshot", () => {
    expect(dbSchema.facilities).toBeDefined();
    expect(dbSchema.spaceCategories).toBeDefined();
    expect(dbSchema.businessUnits).toBeDefined();
    expect(dbSchema.eventBookings).toBeDefined();
    expect(dbSchema.parkingSessions).toBeDefined();
    expect(dbSchema.users).toBeDefined();
    expect(dbSchema.auditLogs).toBeDefined();
    expect(dbSchema.syncMutations).toBeDefined();

    const snapshot = { facility, businessUnits: [unit], events: [], activeSessions: [], areas: [] };
    const availability = getFacilityAvailability(snapshot);
    expect(availability).toMatchObject({ facilityId: facility.id, totalCapacity: 10, totalAvailable: 10 });
    expect(checkAllocationAvailability(snapshot, unit.id).allowed).toBe(true);
    expect(checkAllocationAvailability(snapshot, "unit-missing").allowed).toBe(false);
  });
});
