import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import app from "@server/index";
import { authMiddleware, signJwt } from "@server/middleware/auth";
import type { AppEnvironment } from "@server/types/app-environment";

const secret = "unit-test-signing-secret";
const environment = {
  JWT_SECRET: secret,
  ADMIN_USERNAME: "unit-admin",
  ADMIN_PASSWORD: "unit-admin-password",
  OPERATOR_USERNAME: "unit-operator",
  OPERATOR_PASSWORD: "unit-operator-password",
  PARKING_DB: undefined,
};

async function token(role: "admin" | "operator" = "operator", facilityId?: string, expiresInSeconds = 3600): Promise<string> {
  return await signJwt({ userId: "unit-user", username: "unit-user", role, facilityId }, secret, expiresInSeconds);
}

function request(path: string, init?: RequestInit) {
  return app.request(path, init, environment);
}

function authHeaders(value: string): HeadersInit {
  return { Authorization: `Bearer ${value}`, "Content-Type": "application/json" };
}

describe("default-deny authentication middleware", () => {
  it("rejects malformed, tampered, expired, and invalid-role JWTs", async () => {
    const valid = await token("admin", "facility-one");
    const [header, payload] = valid.split(".");
    const invalidSignature = `${header}.${payload}.not-a-valid-signature`;
    const expired = await token("admin", "facility-one", -1);
    const invalidRole = await signJwt({
      userId: "unit-user",
      username: "unit-user",
      role: "visitor" as never,
      facilityId: "facility-one",
    }, secret);

    for (const value of ["malformed", invalidSignature, expired, invalidRole]) {
      const response = await request("/api/facilities", { headers: authHeaders(value) });
      expect(response.status).toBe(401);
    }
  });

  it("rejects a missing facility, missing request scope, cross-facility reads, and operator writes", async () => {
    const operator = await token("operator", "facility-one");
    const administrator = await token("admin", "facility-one");
    const noFacility = await token("admin");

    expect((await request("/api/facilities", { headers: authHeaders(noFacility) })).status).toBe(403);
    expect((await request("/api/parking-sessions/active", { headers: authHeaders(operator) })).status).toBe(400);
    expect((await request("/api/facilities/facility-two/catalogs", { headers: authHeaders(administrator) })).status).toBe(403);
    expect((await request("/api/facilities", {
      method: "POST",
      headers: authHeaders(operator),
      body: JSON.stringify({ name: "Forbidden", totalCapacity: 1 }),
    })).status).toBe(403);
    expect((await request("/api/facilities/facility-one/areas", {
      method: "POST",
      headers: authHeaders(operator),
      body: JSON.stringify({ name: "Forbidden", code: "FORBIDDEN", allocatedCapacity: 1 }),
    })).status).toBe(403);
  });

  it("rejects malformed scope bodies before route access and allows an authorized request to reach D1", async () => {
    const operator = await token("operator", "facility-one");
    expect((await request("/api/sync/delta", {
      method: "POST", headers: authHeaders(operator), body: "not-json",
    })).status).toBe(400);
    expect((await request("/api/sync/delta", {
      method: "POST", headers: authHeaders(operator), body: JSON.stringify({ facilityId: "facility-one" }),
    })).status).toBe(400);
    expect((await request("/api/facilities", { headers: authHeaders(operator) })).status).toBe(500);
  });

  it("keeps login and event handshakes outside bearer middleware", async () => {
    const login = await request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "wrong", password: "wrong" }),
    });
    expect(login.status).toBe(401);
    expect((await request("/api/events/facility-one")).status).toBe(426);
  });

  it("applies an explicitly requested role to a protected Hono route", async () => {
    const gated = new Hono<AppEnvironment>();
    gated.use("*", authMiddleware("admin"));
    gated.get("/", (context) => context.json({ userId: context.get("user").userId }));
    const operator = await token("operator", "facility-one");
    const administrator = await token("admin", "facility-one");

    expect((await gated.request("/", { headers: authHeaders(operator) }, environment)).status).toBe(403);
    const allowed = await gated.request("/", { headers: authHeaders(administrator) }, environment);
    expect(allowed.status).toBe(200);
    expect(await allowed.json()).toEqual({ userId: "unit-user" });
  });
});
