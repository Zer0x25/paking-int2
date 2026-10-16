import { describe, it, expect } from "vitest";
import { signJwt, verifyJwt, authMiddleware } from "@server/middleware/auth";
import { authenticateUser } from "@server/routes/auth";
import { getFacilityAvailability, checkAllocationAvailability } from "@server/services/allocation-service";
import * as dbSchema from "@server/db/schema";
import { Hono } from "hono";

describe("User Story 5: Auth & RBAC Security (TDD)", () => {
  const secret = "test-jwt-secret-key-1234567890123456";

  it("should generate a valid verifiable JWT token", async () => {
    const token = await signJwt(
      {
        userId: "user-123",
        username: "admin_user",
        role: "admin",
        facilityId: "fac-1",
      },
      secret,
      3600
    );

    expect(typeof token).toBe("string");
    expect(token.split(".").length).toBe(3);

    const decoded = await verifyJwt(token, secret);
    expect(decoded).not.toBeNull();
    expect(decoded?.username).toBe("admin_user");
    expect(decoded?.role).toBe("admin");
  });

  it("should reject expired or corrupted token", async () => {
    const expiredToken = await signJwt(
      {
        userId: "user-123",
        username: "admin_user",
        role: "admin",
      },
      secret,
      -10 // Expired 10 seconds ago
    );

    const verified = await verifyJwt(expiredToken, secret);
    expect(verified).toBeNull();

    const corrupted = await verifyJwt("not.a.valid.jwt", secret);
    expect(corrupted).toBeNull();
  });

  it("should authenticate operator and admin credentials successfully", async () => {
    const adminAuth = await authenticateUser("admin", "admin123");
    expect(adminAuth).not.toBeNull();
    expect(adminAuth?.role).toBe("admin");

    const operatorAuth = await authenticateUser("operador", "operador123");
    expect(operatorAuth).not.toBeNull();
    expect(operatorAuth?.role).toBe("operator");

    const invalidAuth = await authenticateUser("admin", "wrong_pass");
    expect(invalidAuth).toBeNull();
  });

  it("should enforce authMiddleware for protected routes", async () => {
    const testApp = new Hono();
    testApp.use("/protected/*", authMiddleware("admin"));
    testApp.get("/protected/secret", (c) => c.json({ ok: true }));

    // 1. Missing header
    const noHeader = await testApp.request("/protected/secret");
    expect(noHeader.status).toBe(401);

    // 2. Valid admin token
    const adminToken = await signJwt(
      { userId: "1", username: "admin", role: "admin" },
      "supersecret_jwt_key_local_development"
    );
    const validReq = await testApp.request("/protected/secret", {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(validReq.status).toBe(200);

    // 3. Operator token on admin-only route
    const opToken = await signJwt(
      { userId: "2", username: "op", role: "operator" },
      "supersecret_jwt_key_local_development"
    );
    const forbiddenReq = await testApp.request("/protected/secret", {
      headers: { Authorization: `Bearer ${opToken}` },
    });
    expect(forbiddenReq.status).toBe(403);
  });

  it("should verify Drizzle DB schema tables export", () => {
    expect(dbSchema.facilities).toBeDefined();
    expect(dbSchema.spaceCategories).toBeDefined();
    expect(dbSchema.businessUnits).toBeDefined();
    expect(dbSchema.eventBookings).toBeDefined();
    expect(dbSchema.parkingSessions).toBeDefined();
    expect(dbSchema.users).toBeDefined();
    expect(dbSchema.auditLogs).toBeDefined();
  });

  it("should calculate facility availability via service", () => {
    const availability = getFacilityAvailability("fac-default-01", []);
    expect(availability.facilityId).toBe("fac-default-01");
    expect(availability.totalCapacity).toBe(100);
    expect(availability.totalAvailable).toBe(100);

    const check = checkAllocationAvailability("fac-default-01", "bu-nonexistent", []);
    expect(check.allowed).toBe(true);
  });
});
