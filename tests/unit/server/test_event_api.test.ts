import { beforeEach, describe, expect, it } from "vitest";
import app from "@server/index";
import { signJwt } from "@server/middleware/auth";
import { eventBookingAuditStore, eventBookingsStore, defaultEvents } from "@server/services/allocation-service";

const facilityId = "fac-default-01";
const eventBase = {
  title: "Conferencia de Prueba",
  businessUnitId: "bu-events-01",
  reservedSlots: 25,
  startTime: "2030-11-04T21:00:00.000Z",
  endTime: "2030-11-05T05:00:00.000Z",
};

describe("Event reservation API", () => {
  let adminHeaders: Record<string, string>;

  beforeEach(async () => {
    eventBookingsStore.splice(0, eventBookingsStore.length, ...defaultEvents.map((event) => ({ ...event })));
    eventBookingAuditStore.splice(0, eventBookingAuditStore.length);
    const token = await signJwt({
      userId: "user-admin-01",
      username: "admin",
      role: "admin",
      facilityId,
    }, "supersecret_jwt_key_local_development");
    adminHeaders = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  });

  const create = (payload: Record<string, unknown> = eventBase) => app.request(
    `/api/facilities/${facilityId}/events`,
    { method: "POST", headers: adminHeaders, body: JSON.stringify(payload) },
  );

  it("requires an administrator for reservation mutations", async () => {
    const response = await app.request(`/api/facilities/${facilityId}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(eventBase),
    });

    expect(response.status).toBe(401);
  });

  it("creates multiple bookings and lists future reservations", async () => {
    const first = await create();
    const second = await create({ ...eventBase, title: "Segundo Evento", startTime: "2030-11-06T21:00:00.000Z", endTime: "2030-11-07T05:00:00.000Z" });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    const created = await first.json();
    expect(created.event.version).toBe(1);
    expect(created.event.status).toBe("scheduled");

    const listed = await app.request(`/api/facilities/${facilityId}/events`, { headers: adminHeaders });
    const body = await listed.json();
    expect(listed.status).toBe(200);
    expect(body.events.some((event: { title: string }) => event.title === "Segundo Evento")).toBe(true);
    expect(eventBookingAuditStore.filter((entry) => entry.action === "created")).toHaveLength(2);
  });

  it("rejects invalid ranges and non-contractual units", async () => {
    const invalidRange = await create({ ...eventBase, endTime: eventBase.startTime });
    const wrongUnit = await create({ ...eventBase, businessUnitId: "bu-hotel-01" });

    expect(invalidRange.status).toBe(400);
    expect(wrongUnit.status).toBe(400);
  });

  it("rejects overlapping bookings when guaranteed and event quotas exceed capacity", async () => {
    const first = await create({ ...eventBase, reservedSlots: 35 });
    const second = await create({ ...eventBase, title: "Reserva que excede", reservedSlots: 26 });

    expect(first.status).toBe(201);
    expect(second.status).toBe(409);
  });

  it("edits a booking with version checks and records the change", async () => {
    const created = await create();
    const { event } = await created.json();
    const response = await app.request(`/api/facilities/${facilityId}/events/${event.id}`, {
      method: "PUT",
      headers: adminHeaders,
      body: JSON.stringify({
        ...eventBase,
        title: "Conferencia Editada",
        reservedSlots: 30,
        version: 1,
      }),
    });
    const updated = await response.json();
    const stale = await app.request(`/api/facilities/${facilityId}/events/${event.id}`, {
      method: "PUT",
      headers: adminHeaders,
      body: JSON.stringify({ ...eventBase, version: 1 }),
    });

    expect(response.status).toBe(200);
    expect(updated.event.title).toBe("Conferencia Editada");
    expect(updated.event.version).toBe(2);
    expect(stale.status).toBe(409);
    expect(eventBookingAuditStore.filter((entry) => entry.action === "updated")).toHaveLength(1);
  });

  it("cancels a booking without deleting its historical record", async () => {
    const created = await create();
    const { event } = await created.json();
    const cancelled = await app.request(`/api/facilities/${facilityId}/events/${event.id}/status`, {
      method: "PATCH",
      headers: adminHeaders,
      body: JSON.stringify({ status: "cancelled", version: 1 }),
    });
    const listed = await app.request(`/api/facilities/${facilityId}/events`, { headers: adminHeaders });
    const listBody = await listed.json();

    expect(cancelled.status).toBe(200);
    expect(listBody.events.find((item: { id: string }) => item.id === event.id).status).toBe("cancelled");
    expect(eventBookingAuditStore.some((entry) => entry.action === "cancelled")).toBe(true);
  });

  it("returns not found for missing event resources and rejects invalid mutation payloads", async () => {
    const missingList = await app.request("/api/facilities/fac-missing/events", { headers: adminHeaders });
    const missingCreate = await app.request("/api/facilities/fac-missing/events", {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify(eventBase),
    });
    const missingUpdate = await app.request(`/api/facilities/${facilityId}/events/event-missing`, {
      method: "PUT",
      headers: adminHeaders,
      body: JSON.stringify({ ...eventBase, version: 1 }),
    });
    const missingCancel = await app.request(`/api/facilities/${facilityId}/events/event-missing/status`, {
      method: "PATCH",
      headers: adminHeaders,
      body: JSON.stringify({ status: "cancelled", version: 1 }),
    });
    const malformedCancel = await app.request(`/api/facilities/${facilityId}/events/ev-summit-01/status`, {
      method: "PATCH",
      headers: adminHeaders,
      body: JSON.stringify({ status: "active", version: 1 }),
    });

    expect(missingList.status).toBe(404);
    expect(missingCreate.status).toBe(404);
    expect(missingUpdate.status).toBe(404);
    expect(missingCancel.status).toBe(404);
    expect(malformedCancel.status).toBe(400);
  });

  it("rejects stale edits and cancellation of reservations that are already closed", async () => {
    const created = await create();
    const { event } = await created.json();
    const staleEdit = await app.request(`/api/facilities/${facilityId}/events/${event.id}`, {
      method: "PUT",
      headers: adminHeaders,
      body: JSON.stringify({ ...eventBase, version: 2 }),
    });
    const cancelled = await app.request(`/api/facilities/${facilityId}/events/${event.id}/status`, {
      method: "PATCH",
      headers: adminHeaders,
      body: JSON.stringify({ status: "cancelled", version: 1 }),
    });
    const repeatCancel = await app.request(`/api/facilities/${facilityId}/events/${event.id}/status`, {
      method: "PATCH",
      headers: adminHeaders,
      body: JSON.stringify({ status: "cancelled", version: 2 }),
    });
    const closedEdit = await app.request(`/api/facilities/${facilityId}/events/${event.id}`, {
      method: "PUT",
      headers: adminHeaders,
      body: JSON.stringify({ ...eventBase, version: 2 }),
    });

    expect(staleEdit.status).toBe(409);
    expect(cancelled.status).toBe(200);
    expect(repeatCancel.status).toBe(409);
    expect(closedEdit.status).toBe(409);
  });
});
