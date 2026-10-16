import { describe, it, expect, beforeEach } from "vitest";
import app from "@server/index";

describe("Server API: Facility & Parking Areas Management (Feature 002 TDD)", () => {
  const facilityId = "fac-default-01";

  it("should get facility areas summary including floating buffer", async () => {
    const res = await app.request(`/api/facilities/${facilityId}/areas`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.facilityId).toBe(facilityId);
    expect(body.totalCapacity).toBeGreaterThan(0);
    expect(Array.isArray(body.areas)).toBe(true);
    expect(body.floatingBuffer).toBeDefined();
  });

  it("should create a new parking area within available buffer", async () => {
    const uniqueCode = "TDD" + Math.floor(Math.random() * 1000);
    const createRes = await app.request(`/api/facilities/${facilityId}/areas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Sector Prueba TDD",
        code: uniqueCode,
        description: "Sector automatizado",
        allocatedCapacity: 5,
        businessUnitId: null,
      }),
    });
    expect(createRes.status).toBe(201);
    const body = await createRes.json();
    expect(body.area.code).toBe(uniqueCode.toUpperCase());
    expect(body.area.allocatedCapacity).toBe(5);

    // Reject duplicate code
    const dupRes = await app.request(`/api/facilities/${facilityId}/areas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Otro Sector",
        code: uniqueCode,
        allocatedCapacity: 2,
      }),
    });
    expect(dupRes.status).toBe(409);
  });

  it("should reject area creation if capacity exceeds floating buffer", async () => {
    const res = await app.request(`/api/facilities/${facilityId}/areas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Sector Excesivo",
        code: "EXCESS",
        allocatedCapacity: 99999, // Exceeds facility capacity
      }),
    });
    expect(res.status).toBe(409);
  });

  it("should dynamically adjust area capacity in caliente with optimistic locking", async () => {
    // 1. Create area
    const code = "DYN" + Math.floor(Math.random() * 1000);
    const createRes = await app.request(`/api/facilities/${facilityId}/areas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Sector Dinámico",
        code,
        allocatedCapacity: 10,
      }),
    });
    const { area } = await createRes.json();

    // 2. Adjust capacity up to 15
    const patchRes = await app.request(
      `/api/facilities/${facilityId}/areas/${area.id}/capacity`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allocatedCapacity: 15,
          version: area.version,
        }),
      }
    );
    expect(patchRes.status).toBe(200);
    const patchBody = await patchRes.json();
    expect(patchBody.area.allocatedCapacity).toBe(15);
    expect(patchBody.area.version).toBe(area.version + 1);

    // 3. Stale version should fail with 409
    const staleRes = await app.request(
      `/api/facilities/${facilityId}/areas/${area.id}/capacity`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allocatedCapacity: 20,
          version: area.version, // Still version 1, but current is 2
        }),
      }
    );
    expect(staleRes.status).toBe(409);
  });

  it("should update facility total capacity and enforce invariants", async () => {
    const putRes = await app.request(`/api/facilities/${facilityId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Centro Principal Actualizado",
        totalCapacity: 350,
      }),
    });
    expect(putRes.status).toBe(200);
    const putBody = await putRes.json();
    expect(putBody.facility.totalCapacity).toBe(350);

    // Reject reducing below allocated areas sum
    const invalidReduce = await app.request(`/api/facilities/${facilityId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        totalCapacity: 5, // smaller than current allocated areas
      }),
    });
    expect(invalidReduce.status).toBe(409);

    // 404 for unknown facility
    const notFoundFac = await app.request(`/api/facilities/fac-unknown-999`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Desconocido" }),
    });
    expect(notFoundFac.status).toBe(404);

    // 400 for invalid body in PUT facility
    const badPutFac = await app.request(`/api/facilities/${facilityId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ totalCapacity: -1 }),
    });
    expect(badPutFac.status).toBe(400);

    // 404 for unknown area capacity patch
    const notFoundArea = await app.request(
      `/api/facilities/${facilityId}/areas/area-unknown-999/capacity`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allocatedCapacity: 10, version: 1 }),
      }
    );
    expect(notFoundArea.status).toBe(404);

    // 400 for bad area capacity patch payload
    const badPatchArea = await app.request(
      `/api/facilities/${facilityId}/areas/area-default-01/capacity`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allocatedCapacity: -5, version: 0 }),
      }
    );
    expect(badPatchArea.status).toBe(400);

    // 400 for bad create area payload
    const badCreateArea = await app.request(`/api/facilities/${facilityId}/areas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "" }),
    });
    expect(badCreateArea.status).toBe(400);
  });
});
