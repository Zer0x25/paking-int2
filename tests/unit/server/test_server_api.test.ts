import { describe, expect, it } from "vitest";
import app from "@server/index";
import { signJwt } from "@server/middleware/auth";

describe("Worker API startup and fail-closed behavior", () => {
  it("responds to the health check without requiring D1", async () => {
    const response = await app.request("/api/health");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "ok", service: "parking-management-worker" });
  });

  it("does not confirm configuration reads or writes when the D1 binding is absent", async () => {
    const read = await app.request("/api/facilities");
    const create = await app.request("/api/facilities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Local facility", totalCapacity: 20, address: "" }),
    });
    expect(read.status).toBe(500);
    expect(create.status).toBe(500);
    expect((await create.json()).error).toMatch(/PARKING_DB/i);
  });

  it("requires a configured signing secret for protected routes", async () => {
    const token = await signJwt({ userId: "user-1", username: "operator", role: "operator" }, "test-only-secret");
    const response = await app.request("/api/parking-sessions/active?facilityId=fac-1", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(response.status).toBe(500);
    expect((await response.json()).error).toMatch(/JWT_SECRET/i);
  });
});
