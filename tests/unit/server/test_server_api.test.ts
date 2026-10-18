import { describe, expect, it } from "vitest";
import app from "@server/index";
import { signJwt } from "@server/middleware/auth";

describe("Worker API startup and fail-closed behavior", () => {
  it("responds to the health check without requiring D1", async () => {
    const response = await app.request("/api/health");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "ok", service: "parking-management-worker" });
  });

  it("rejects anonymous reads and does not confirm authorized reads or writes when D1 is absent", async () => {
    const anonymousRead = await app.request("/api/facilities");
    expect(anonymousRead.status).toBe(401);

    const secret = "test-only-secret";
    const token = await signJwt({ userId: "admin-1", username: "admin", role: "admin", facilityId: "fac-1" }, secret);
    const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    const environment = { JWT_SECRET: secret, PARKING_DB: undefined };
    const read = await app.request("/api/facilities", { headers }, environment);
    const create = await app.request("/api/facilities", {
      method: "POST",
      headers,
      body: JSON.stringify({ name: "Local facility", totalCapacity: 20, address: "" }),
    }, environment);
    expect(read.status).toBe(500);
    expect(create.status).toBe(500);
    expect(((await create.json()) as { error: string }).error).toMatch(/PARKING_DB/i);
  });

  it("requires a configured signing secret for protected routes", async () => {
    const token = await signJwt({ userId: "user-1", username: "operator", role: "operator" }, "test-only-secret");
    const response = await app.request("/api/parking-sessions/active?facilityId=fac-1", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(response.status).toBe(500);
    expect(((await response.json()) as { error: string }).error).toMatch(/JWT_SECRET/i);
  });
});
