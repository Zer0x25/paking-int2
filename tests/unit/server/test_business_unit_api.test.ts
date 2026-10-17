import { beforeEach, describe, expect, it } from "vitest";
import app from "@server/index";
import { signJwt } from "@server/middleware/auth";
import * as allocationService from "@server/services/allocation-service";
import { checkAllocationAvailability, defaultBusinessUnits, defaultEvents, eventBookingsStore } from "@server/services/allocation-service";
import { businessUnitsStore, parkingAreasStore } from "@server/routes/facilities";
import { mockSessionsRepo } from "@server/routes/parking";

interface UnitAuditEntry {
  userId: string;
  action: string;
  before?: unknown;
  after: unknown;
}

const businessUnitAuditLog = () => (
  (allocationService as unknown as Record<string, unknown>).businessUnitAuditStore as UnitAuditEntry[] | undefined
);

const facilityId = "fac-default-01";
const validUnit = {
  name: "Spa & Club",
  code: "SPA",
  quotaType: "dynamic",
  defaultQuota: 0,
};

describe("Business unit lifecycle API", () => {
  let adminHeaders: Record<string, string>;

  beforeEach(async () => {
    businessUnitsStore.splice(0, businessUnitsStore.length, ...defaultBusinessUnits.map((unit) => ({ ...unit })));
    eventBookingsStore.splice(0, eventBookingsStore.length, ...defaultEvents.map((event) => ({ ...event })));
    businessUnitAuditLog()?.splice(0, businessUnitAuditLog()?.length || 0);
    parkingAreasStore.splice(0, parkingAreasStore.length);
    mockSessionsRepo.splice(0, mockSessionsRepo.length);

    const token = await signJwt({
      userId: "user-admin-01",
      username: "admin",
      role: "admin",
      facilityId,
    }, "supersecret_jwt_key_local_development");
    adminHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
  });

  const collectionPath = `/api/facilities/${facilityId}/business-units`;
  const create = (body: Record<string, unknown> = validUnit) => app.request(collectionPath, {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify(body),
  });

  it("requires administrator access for listing and mutations", async () => {
    const noToken = await app.request(collectionPath);
    const operatorToken = await signJwt({
      userId: "user-operator-01", username: "operator", role: "operator", facilityId,
    }, "supersecret_jwt_key_local_development");
    const forbidden = await app.request(collectionPath, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${operatorToken}` },
      body: JSON.stringify(validUnit),
    });

    expect(noToken.status).toBe(401);
    expect(forbidden.status).toBe(403);
  });

  it("creates units, normalizes codes and lists the full management catalog", async () => {
    const response = await create({ ...validUnit, code: " spa " });
    const { businessUnit } = await response.json();
    const listed = await app.request(collectionPath, { headers: adminHeaders });
    const listBody = await listed.json();

    expect(response.status).toBe(201);
    expect(businessUnit).toMatchObject({ name: validUnit.name, code: "SPA", priorityLevel: 3, version: 1, isActive: true });
    expect(listed.status).toBe(200);
    expect(listBody.businessUnits.some((unit: { id: string }) => unit.id === businessUnit.id)).toBe(true);
    expect(businessUnitAuditLog()).toHaveLength(1);
    expect(businessUnitAuditLog()?.[0]).toMatchObject({ userId: "user-admin-01", action: "created", after: businessUnit });
  });

  it("rejects invalid and duplicate codes, including codes in the inactive history", async () => {
    const invalid = await create({ ...validUnit, defaultQuota: -1 });
    const first = await create();
    const { businessUnit } = await first.json();
    const retired = await app.request(`${collectionPath}/${businessUnit.id}/status`, {
      method: "PATCH", headers: adminHeaders,
      body: JSON.stringify({ isActive: false, version: 1 }),
    });
    const duplicate = await create({ ...validUnit, code: "spa" });

    expect(invalid.status).toBe(400);
    expect(retired.status).toBe(200);
    expect(duplicate.status).toBe(409);
  });

  it("rejects a new guaranteed quota that would exceed the facility capacity", async () => {
    const response = await create({ ...validUnit, code: "TOOMUCH", quotaType: "guaranteed", defaultQuota: 61 });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toMatch(/aforo/i);
    expect(businessUnitsStore.some((unit) => unit.code === "TOOMUCH")).toBe(false);
  });

  it("edits all four fields with optimistic versioning and audit", async () => {
    const created = await create();
    const { businessUnit } = await created.json();
    const response = await app.request(`${collectionPath}/${businessUnit.id}`, {
      method: "PUT",
      headers: adminHeaders,
      body: JSON.stringify({ name: "Spa Editado", code: "SPA-2", quotaType: "guaranteed", defaultQuota: 8, version: 1 }),
    });
    const { businessUnit: updated } = await response.json();
    const stale = await app.request(`${collectionPath}/${businessUnit.id}`, {
      method: "PUT", headers: adminHeaders,
      body: JSON.stringify({ name: "Otro", code: "SPA-3", quotaType: "dynamic", defaultQuota: 0, version: 1 }),
    });

    expect(response.status).toBe(200);
    expect(updated).toMatchObject({ name: "Spa Editado", code: "SPA-2", quotaType: "guaranteed", defaultQuota: 8, priorityLevel: 1, version: 2 });
    expect(stale.status).toBe(409);
    expect(businessUnitAuditLog()?.filter((item) => item.action === "updated")).toHaveLength(1);
  });

  it("preserves the unit when active sessions, exclusive areas or visible bookings refer to it", async () => {
    const created = await create({ ...validUnit, quotaType: "contractual" });
    const { businessUnit } = await created.json();
    parkingAreasStore.push({
      id: "area-protected-01", facilityId, name: "Área exclusiva", code: "AREA-1", description: "",
      allocatedCapacity: 5, businessUnitId: businessUnit.id, isActive: true, version: 1,
      createdAt: "2030-01-01T00:00:00.000Z", updatedAt: "2030-01-01T00:00:00.000Z",
    });
    mockSessionsRepo.push({
      id: "session-protected-01", facilityId, businessUnitId: businessUnit.id, spaceCategoryId: "cat-std",
      parkingAreaId: null, licensePlate: "ABC123", entryTime: "2030-01-01T00:00:00.000Z", exitTime: null,
      status: "active", durationMinutes: null, operatorUserId: "operator-01", deviceId: "gate-01", version: 1,
    });
    eventBookingsStore.push({
      id: "event-protected-01", facilityId, businessUnitId: businessUnit.id, title: "Evento vigente",
      reservedSlots: 5, startTime: "2035-11-04T21:00:00.000Z", endTime: "2035-11-05T05:00:00.000Z",
      status: "scheduled", version: 1,
    });

    const response = await app.request(`${collectionPath}/${businessUnit.id}/status`, {
      method: "PATCH", headers: adminHeaders,
      body: JSON.stringify({ isActive: false, version: 1 }),
    });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toMatch(/sesión activa/i);
    expect(body.error).toMatch(/área exclusiva/i);
    expect(body.error).toMatch(/reserva vigente/i);
    expect(businessUnitsStore.find((unit) => unit.id === businessUnit.id)?.isActive).toBe(true);
  });

  it("retires an unused unit logically, keeps it in history and removes it from operational catalogs", async () => {
    const created = await create();
    const { businessUnit } = await created.json();
    const response = await app.request(`${collectionPath}/${businessUnit.id}/status`, {
      method: "PATCH", headers: adminHeaders,
      body: JSON.stringify({ isActive: false, version: 1 }),
    });
    const { businessUnit: retired } = await response.json();
    const listed = await app.request(collectionPath, { headers: adminHeaders });
    const catalog = await app.request(`/api/facilities/${facilityId}/catalogs`);
    const listBody = await listed.json();
    const catalogBody = await catalog.json();

    expect(response.status).toBe(200);
    expect(retired).toMatchObject({ id: businessUnit.id, isActive: false, version: 2 });
    expect(listBody.businessUnits.find((unit: { id: string }) => unit.id === businessUnit.id).isActive).toBe(false);
    expect(catalogBody.businessUnits.some((unit: { id: string }) => unit.id === businessUnit.id)).toBe(false);
    expect(checkAllocationAvailability(facilityId, businessUnit.id, []).allowed).toBe(false);
    expect(businessUnitAuditLog()?.at(-1)).toMatchObject({ action: "deactivated", before: businessUnit, after: retired });
  });

  it("keeps contractual quota type while a visible booking depends on the unit", async () => {
    const created = await create({ ...validUnit, quotaType: "contractual" });
    const { businessUnit } = await created.json();
    eventBookingsStore.push({
      id: "event-type-guard-01", facilityId, businessUnitId: businessUnit.id, title: "Reserva futura",
      reservedSlots: 5, startTime: "2035-11-04T21:00:00.000Z", endTime: "2035-11-05T05:00:00.000Z",
      status: "scheduled", version: 1,
    });

    const response = await app.request(`${collectionPath}/${businessUnit.id}`, {
      method: "PUT", headers: adminHeaders,
      body: JSON.stringify({ name: businessUnit.name, code: businessUnit.code, quotaType: "dynamic", defaultQuota: 0, version: 1 }),
    });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toMatch(/reservas vigentes/i);
    expect(businessUnitsStore.find((unit) => unit.id === businessUnit.id)?.quotaType).toBe("contractual");
  });

  it("rejects missing facility, missing unit, foreign unit and malformed retirement requests", async () => {
    const missingFacility = await app.request("/api/facilities/fac-missing/business-units", { headers: adminHeaders });
    const missingUnit = await app.request(`${collectionPath}/bu-missing`, {
      method: "PUT", headers: adminHeaders,
      body: JSON.stringify({ ...validUnit, version: 1 }),
    });
    const invalidStatus = await app.request(`${collectionPath}/bu-events-01/status`, {
      method: "PATCH", headers: adminHeaders, body: JSON.stringify({ isActive: true, version: 1 }),
    });
    const foreign = await app.request(`/api/facilities/fac-other/business-units/bu-events-01`, {
      method: "PUT", headers: adminHeaders,
      body: JSON.stringify({ ...validUnit, version: 1 }),
    });

    expect(missingFacility.status).toBe(404);
    expect(missingUnit.status).toBe(404);
    expect(invalidStatus.status).toBe(400);
    expect(foreign.status).toBe(404);
  });
});
