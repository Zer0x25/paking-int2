import { describe, expect, it } from "vitest";
import app from "@server/index";
import { signJwt } from "@server/middleware/auth";

const genericError = "Error interno del servidor";

describe("generic server error responses", () => {
  it("does not expose an uncaught JSON parsing error", async () => {
    const response = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: genericError, status: 500 });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("hides credential configuration failures during login", async () => {
    const response = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "private-password" }),
    }, {});

    expect(response.status).toBe(500);
    expect(((await response.json()) as { error: string }).error).toBe(genericError);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("hides the internal failure from an authenticated read", async () => {
    const secret = "generic-error-test-secret";
    const token = await signJwt({ userId: "admin-1", username: "admin", role: "admin", facilityId: "fac-1" }, secret);
    const response = await app.request("/api/facilities", {
      headers: { Authorization: `Bearer ${token}` },
    }, { JWT_SECRET: secret });

    expect(response.status).toBe(500);
    expect(((await response.json()) as { error: string }).error).toBe(genericError);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("hides the internal failure from an authenticated write", async () => {
    const secret = "generic-error-test-secret";
    const token = await signJwt({ userId: "admin-1", username: "admin", role: "admin" }, secret);
    const response = await app.request("/api/facilities", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Local facility", totalCapacity: 20, address: "" }),
    }, { JWT_SECRET: secret });

    expect(response.status).toBe(500);
    expect(((await response.json()) as { error: string }).error).toBe(genericError);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("hides real-time binding details while returning service unavailable", async () => {
    const secret = "generic-error-test-secret";
    const token = await signJwt({ userId: "admin-1", username: "admin", role: "admin", facilityId: "fac-1" }, secret);
    const response = await app.request("/api/events/fac-1", {
      headers: {
        Upgrade: "websocket",
        "Sec-WebSocket-Protocol": `parking-events-v1, ${token}, client-1`,
      },
    }, { JWT_SECRET: secret });

    expect(response.status).toBe(503);
    expect(((await response.json()) as { error: string }).error).toBe("Servicio temporalmente no disponible");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("keeps intentional credential errors readable", async () => {
    const response = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "wrong-password" }),
    }, {
      ADMIN_USERNAME: "admin",
      ADMIN_PASSWORD: "correct-password",
      OPERATOR_USERNAME: "operator",
      OPERATOR_PASSWORD: "correct-operator-password",
      JWT_SECRET: "generic-error-test-secret",
    });

    expect(response.status).toBe(401);
    expect(((await response.json()) as { error: string }).error).toBe("Usuario o contraseña incorrectos");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
