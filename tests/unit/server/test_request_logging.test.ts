import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";
import { publishFacilityChange } from "@server/middleware/change-notification";
import { logServerError, requestLoggingMiddleware } from "@server/middleware/request-logging";
import type { AppEnvironment } from "@server/types/app-environment";

afterEach(() => vi.restoreAllMocks());

describe("privacy-safe structured request logging", () => {
  it("logs a normalized path and status without query, headers, or body", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const testApp = new Hono<AppEnvironment>();
    testApp.use("*", requestLoggingMiddleware);
    testApp.post("/api/parking-sessions/:sessionId/exit", (c) => c.json({ ok: true }));

    const response = await testApp.request("/api/parking-sessions/session-private-id/exit?facilityId=facility-private-id&licensePlate=SA-DS-AD", {
      method: "POST",
      headers: {
        Authorization: "Bearer private-jwt-token",
        Cookie: "session=private-cookie-value",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ licensePlate: "SA-DS-AD", sessionId: "session-private-id" }),
    });
    const line = String(info.mock.calls[0]?.[0]);

    expect(response.status).toBe(200);
    expect(JSON.parse(line)).toMatchObject({
      event: "http.request",
      method: "POST",
      path: "/api/parking-sessions/:sessionId/exit",
      status: 200,
    });
    expect(line).not.toContain("facilityId=");
    expect(line).not.toContain("SA-DS-AD");
    expect(line).not.toContain("session-private-id");
    expect(line).not.toContain("private-jwt-token");
    expect(line).not.toContain("private-cookie-value");
  });

  it("redacts secrets, JWTs, plates, and session identifiers from structured errors", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const testApp = new Hono<AppEnvironment>();
    testApp.use("*", requestLoggingMiddleware);
    testApp.get("/api/parking-sessions/session-private-id", (c) => {
      logServerError(c, new Error(
        "failure password=private-password authorization=Bearer private-jwt-token cookie=private-cookie-value plate=SA-DS-AD sessionId=session-private-id",
      ));
      return c.json({ error: "Error interno del servidor" }, 500);
    });

    await testApp.request("/api/parking-sessions/session-private-id?debug=private-query");
    const line = String(error.mock.calls[0]?.[0]);

    expect(JSON.parse(line)).toMatchObject({
      event: "server.error",
      method: "GET",
      path: "/api/parking-sessions/:sessionId",
      status: 500,
    });
    for (const sensitiveValue of [
      "private-password",
      "private-jwt-token",
      "private-cookie-value",
      "SA-DS-AD",
      "session-private-id",
      "private-query",
    ]) {
      expect(line).not.toContain(sensitiveValue);
    }
  });

  it("keeps failed event-broadcast logs from exposing facility and session identifiers", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const testApp = new Hono<AppEnvironment>();
    testApp.use("*", requestLoggingMiddleware);
    testApp.use("*", publishFacilityChange());
    testApp.post("/api/parking-sessions/:sessionId/exit", (c) => {
      c.set("user", {
        userId: "operator-private-id",
        username: "operator",
        role: "operator",
        facilityId: "facility-private-id",
        exp: 1_900_000_000,
      });
      return c.json({ ok: true });
    });

    const response = await testApp.request("/api/parking-sessions/session-private-id/exit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ facilityId: "facility-private-id" }),
    }, {});
    const line = String(error.mock.calls[0]?.[0]);
    const requestLine = String(info.mock.calls[0]?.[0]);

    expect(response.status).toBe(200);
    expect(JSON.parse(line)).toMatchObject({ event: "server.error", status: 503 });
    expect(JSON.parse(line).requestId).toBe(JSON.parse(requestLine).requestId);
    expect(line).not.toContain("facility-private-id");
    expect(line).not.toContain("session-private-id");
    expect(line).not.toContain("operator-private-id");
  });
});
