import { describe, it, expect, beforeEach } from "vitest";
import app from "@server/index";
import { mockSessionsRepo } from "@server/routes/parking";
import { signJwt } from "@server/middleware/auth";

describe("Server API Endpoints Integration Tests (TDD)", () => {
  const facilityId = "fac-default-01";
  const hotelUnitId = "bu-hotel-01";
  const spaceCatId = "cat-std";
  let authToken: string;

  beforeEach(async () => {
    mockSessionsRepo.length = 0; // Clear mock repo
    authToken = await signJwt(
      { userId: "operator-api-test", username: "operador", role: "operator", facilityId },
      "supersecret_jwt_key_local_development"
    );
  });

  const authHeaders = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${authToken}` });

  it("should respond to health check", async () => {
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
  });

  it("should handle authentication login flow including validation errors", async () => {
    const validLogin = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "admin123" }),
    });
    expect(validLogin.status).toBe(200);
    const validBody = await validLogin.json();
    expect(validBody.token).toBeDefined();
    expect(validBody.user.role).toBe("admin");

    const invalidPassLogin = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "wrong" }),
    });
    expect(invalidPassLogin.status).toBe(401);

    const badPayload = await app.request("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "" }),
    });
    expect(badPayload.status).toBe(400);
  });

  it("should list facilities and return catalogs", async () => {
    const facRes = await app.request("/api/facilities");
    expect(facRes.status).toBe(200);
    const facBody = await facRes.json();
    expect(facBody.facilities.length).toBeGreaterThan(0);

    const catRes = await app.request(`/api/facilities/${facilityId}/catalogs`);
    expect(catRes.status).toBe(200);
    const catBody = await catRes.json();
    expect(catBody.businessUnits.length).toBeGreaterThan(0);
    expect(catBody.categories.length).toBeGreaterThan(0);
  });

  it("should create a new facility or reject invalid schema", async () => {
    const createRes = await app.request("/api/facilities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Terminal Aeropuerto Norte",
        totalCapacity: 500,
        address: "Ruta 68 Km 10",
      }),
    });
    expect(createRes.status).toBe(201);

    const badRes = await app.request("/api/facilities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "A", // too short
        totalCapacity: -10, // negative
      }),
    });
    expect(badRes.status).toBe(400);
  });

  it("should register vehicle entry, list active, and register exit with bad payload handling", async () => {
    // Bad payload entry
    const badEntry = await app.request("/api/parking-sessions/entry", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ licensePlate: "AB" }),
    });
    expect(badEntry.status).toBe(400);

    // Valid entry
    const entryRes = await app.request("/api/parking-sessions/entry", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        facilityId,
        businessUnitId: hotelUnitId,
        spaceCategoryId: spaceCatId,
        licensePlate: "KKL990",
        entryTime: "2026-10-15T10:00:00.000Z",
        deviceId: "gate-01",
      }),
    });
    expect(entryRes.status).toBe(201);
    const entryBody = await entryRes.json();
    expect(entryBody.session.licensePlate).toBe("KKL990");
    expect(entryBody.ticket.ticketNumber).toBeDefined();

    // Prevent duplicate entry
    const dupRes = await app.request("/api/parking-sessions/entry", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        facilityId,
        businessUnitId: hotelUnitId,
        spaceCategoryId: spaceCatId,
        licensePlate: "kk-l9-90",
      }),
    });
    expect(dupRes.status).toBe(409);

    // List active
    const listRes = await app.request(`/api/parking-sessions/active?facilityId=${facilityId}`, { headers: authHeaders() });
    expect(listRes.status).toBe(200);
    const listBody = await listRes.json();
    expect(listBody.count).toBe(1);

    // List active without facilityId (400)
    const noFacList = await app.request("/api/parking-sessions/active", { headers: authHeaders() });
    expect(noFacList.status).toBe(400);

    // Bad payload exit
    const badExit = await app.request("/api/parking-sessions/exit", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({}),
    });
    expect(badExit.status).toBe(400);

    // Valid exit
    const exitRes = await app.request("/api/parking-sessions/exit", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        facilityId,
        licensePlate: "KKL990",
        exitTime: "2026-10-15T12:00:00.000Z",
      }),
    });
    expect(exitRes.status).toBe(200);

    // Exit non-existent plate
    const notFoundExit = await app.request("/api/parking-sessions/exit", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        facilityId,
        licensePlate: "ZZZ999",
      }),
    });
    expect(notFoundExit.status).toBe(404);
  });

  it("should return dashboard metrics and alerts", async () => {
    const dashRes = await app.request(`/api/facilities/${facilityId}/dashboard`);
    expect(dashRes.status).toBe(200);
    const dashBody = await dashRes.json();
    expect(dashBody.facilityId).toBe(facilityId);
    expect(dashBody.alertLevel).toBeDefined();
    expect(dashBody.units.length).toBeGreaterThan(0);

    // Custom facility dashboard branch
    const customDash = await app.request("/api/facilities/fac-custom-99/dashboard");
    expect(customDash.status).toBe(200);
    const customBody = await customDash.json();
    expect(customBody.facilityId).toBe("fac-custom-99");
  });

  it("should process delta sync batch with conflicts and bad payload handling", async () => {
    // Bad payload
    const badSync = await app.request("/api/sync/delta", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ invalid: true }),
    });
    expect(badSync.status).toBe(400);

    // First, sync entry
    const syncRes1 = await app.request("/api/sync/delta", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        facilityId,
        deviceId: "sync-gate-01",
        mutations: [
          {
            id: "mut-in-1",
            type: "VEHICLE_ENTRY",
            payload: {
              licensePlate: "SYNC11",
              businessUnitId: hotelUnitId,
              spaceCategoryId: spaceCatId,
            },
            clientTimestamp: new Date().toISOString(),
            deviceId: "sync-gate-01",
            status: "pending",
            retryCount: 0,
          },
        ],
      }),
    });
    expect(syncRes1.status).toBe(200);

    // Second, sync duplicate entry (conflict) + sync exit for missing car (conflict)
    const syncRes2 = await app.request("/api/sync/delta", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        facilityId,
        deviceId: "sync-gate-01",
        mutations: [
          {
            id: "mut-dup",
            type: "VEHICLE_ENTRY",
            payload: {
              licensePlate: "SYNC11",
              businessUnitId: hotelUnitId,
              spaceCategoryId: spaceCatId,
            },
            clientTimestamp: new Date().toISOString(),
            deviceId: "sync-gate-01",
            status: "pending",
            retryCount: 0,
          },
          {
            id: "mut-missing-exit",
            type: "VEHICLE_EXIT",
            payload: {
              licensePlate: "ZZ9Z99",
            },
            clientTimestamp: new Date().toISOString(),
            deviceId: "sync-gate-01",
            status: "pending",
            retryCount: 0,
          },
        ],
      }),
    });
    expect(syncRes2.status).toBe(200);
    const body2 = await syncRes2.json();
    expect(body2.conflicts.length).toBe(2);
  });
});
