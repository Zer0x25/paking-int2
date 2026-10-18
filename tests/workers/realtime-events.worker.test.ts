import { env } from "cloudflare:test";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { signJwt } from "../../src/server/middleware/auth";
import { applyD1Migrations, getD1Database, workerFetch } from "./support/d1-fixture";

const bindings = env as unknown as Record<string, unknown>;
const facilityId = `realtime-${crypto.randomUUID()}`;
const otherFacilityId = `realtime-other-${crypto.randomUUID()}`;
const sockets: WebSocket[] = [];
let secret = "";
let adminToken = "";

async function seedFacility(id: string, name: string): Promise<void> {
  const now = new Date().toISOString();
  await getD1Database().prepare(
    "INSERT INTO facilities (id, name, address, total_capacity, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).bind(id, name, "", 1000, 1, now, now).run();
}

async function connect(roomFacilityId: string, token: string, clientId: string): Promise<Response> {
  return workerFetch(`/api/events/${encodeURIComponent(roomFacilityId)}`, {
    headers: {
      Upgrade: "websocket",
      "Sec-WebSocket-Protocol": `parking-events-v1, ${token}, ${clientId}`,
    },
  });
}

function acceptSocket(response: Response): WebSocket {
  const socket = (response as Response & { webSocket?: WebSocket }).webSocket;
  if (!socket) throw new Error("Worker did not return a WebSocket client");
  socket.accept();
  sockets.push(socket);
  return socket;
}

function nextMessage(socket: WebSocket, timeoutMs = 2000): Promise<string> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Timed out waiting for facility event")), timeoutMs);
    socket.addEventListener("message", (event) => {
      clearTimeout(timeout);
      resolve(String((event as MessageEvent).data));
    }, { once: true });
  });
}

async function expectNoMessage(socket: WebSocket): Promise<void> {
  const result = await Promise.race([
    new Promise<string>((resolve) => socket.addEventListener("message", () => resolve("received"), { once: true })),
    new Promise<string>((resolve) => setTimeout(() => resolve("quiet"), 75)),
  ]);
  expect(result).toBe("quiet");
}

describe("authenticated facility change events", () => {
  beforeAll(async () => {
    await applyD1Migrations();
    secret = crypto.randomUUID() + crypto.randomUUID();
    Reflect.set(bindings, "JWT_SECRET", secret);
    await seedFacility(facilityId, "Realtime test facility");
    await seedFacility(otherFacilityId, "Other realtime facility");
    await getD1Database().prepare(
      "INSERT INTO business_units (id, facility_id, name, code, priority_level, quota_type, default_quota, is_active, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(`unit-${facilityId}`, facilityId, "General", "GEN", 3, "dynamic", 1000, 1, 1).run();
    await getD1Database().prepare(
      "INSERT INTO space_categories (id, facility_id, name, code, allocated_slots) VALUES (?, ?, ?, ?, ?)",
    ).bind(`category-${facilityId}`, facilityId, "Standard", "STD", 1000).run();
    adminToken = await signJwt({ userId: "realtime-admin", username: "realtime-admin", role: "admin", facilityId }, secret);
  });

  afterAll(async () => {
    await Promise.all(sockets.map((socket) => new Promise<void>((resolve) => {
      if (socket.readyState === WebSocket.CLOSED) {
        resolve();
        return;
      }
      const timeout = setTimeout(resolve, 250);
      socket.addEventListener("close", () => {
        clearTimeout(timeout);
        resolve();
      }, { once: true });
      socket.close(1000, "test complete");
    })));
  });

  it("authenticates the WebSocket subprotocol and rejects another facility", async () => {
    const noToken = await workerFetch(`/api/events/${facilityId}`, {
      headers: { Upgrade: "websocket", "Sec-WebSocket-Protocol": "parking-events-v1, tab-1" },
    });
    expect(noToken.status).toBe(401);

    const unsupportedProtocol = await workerFetch(`/api/events/${facilityId}`, {
      headers: { Upgrade: "websocket", "Sec-WebSocket-Protocol": "unsupported, ignored-token, tab-1" },
    });
    expect(unsupportedProtocol.status).toBe(401);

    const wrongFacility = await connect(otherFacilityId, adminToken, "tab-2");
    expect(wrongFacility.status).toBe(403);

    const invalidClientId = await connect(facilityId, adminToken, "invalid!");
    expect(invalidClientId.status).toBe(403);

    const notUpgrade = await workerFetch(`/api/events/${facilityId}`, { headers: { Authorization: `Bearer ${adminToken}` } });
    expect(notUpgrade.status).toBe(426);
  });

  it("broadcasts only invalidations to the same facility after a committed write", async () => {
    const firstConnection = await connect(facilityId, adminToken, "peer-tab-1");
    const secondConnection = await connect(facilityId, adminToken, "peer-tab-2");
    const otherConnection = await connect(otherFacilityId, await signJwt({
      userId: "other-admin", username: "other-admin", role: "admin", facilityId: otherFacilityId,
    }, secret), "other-tab");
    expect(firstConnection.status).toBe(101);
    expect(secondConnection.status).toBe(101);
    expect(otherConnection.status).toBe(101);
    expect(firstConnection.headers.get("Sec-WebSocket-Protocol")).toBe("parking-events-v1");
    const firstSocket = acceptSocket(firstConnection);
    const secondSocket = acceptSocket(secondConnection);
    const otherSocket = acceptSocket(otherConnection);
    const firstEvent = nextMessage(firstSocket);
    const secondEvent = nextMessage(secondSocket);

    const plate = `RT${crypto.randomUUID().replace(/-/g, "").slice(0, 4).toUpperCase()}`;
    const sessionId = `session-${crypto.randomUUID()}`;
    const entry = await workerFetch("/api/parking-sessions/entry", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
        "X-Client-Id": "writer-tab",
      },
      body: JSON.stringify({
        id: sessionId,
        facilityId,
        businessUnitId: `unit-${facilityId}`,
        spaceCategoryId: `category-${facilityId}`,
        licensePlate: plate,
        entryTime: new Date().toISOString(),
        deviceId: "realtime-test",
      }),
    });
    expect(entry.status).toBe(201);
    const [firstRaw, secondRaw] = await Promise.all([firstEvent, secondEvent]);
    const firstPayload = JSON.parse(firstRaw) as Record<string, unknown>;
    expect(firstPayload).toMatchObject({ schemaVersion: 1, type: "facility.changed", facilityId, sourceClientId: "writer-tab" });
    expect(secondRaw).toBe(firstRaw);
    expect(firstRaw).not.toContain(plate);
    const stored = await getD1Database().prepare("SELECT id FROM parking_sessions WHERE id = ?").bind(sessionId).first<{ id: string }>();
    expect(stored?.id).toBe(sessionId);
    await expectNoMessage(otherSocket);
  });

  it("validates internal room connections and event payloads", async () => {
    const namespace = bindings.FACILITY_EVENTS as DurableObjectNamespace;
    const stub = namespace.get(namespace.idFromName(`internal-${crypto.randomUUID()}`));
    const room = "https://facility-events.internal";

    expect((await stub.fetch(new Request(`${room}/unknown`))).status).toBe(404);
    expect((await stub.fetch(new Request(`${room}/connect`))).status).toBe(426);
    expect((await stub.fetch(new Request(`${room}/connect`, {
      headers: { Upgrade: "websocket", "Sec-WebSocket-Protocol": "unsupported" },
    }))).status).toBe(400);
    expect((await stub.fetch(new Request(`${room}/connect`, {
      headers: { Upgrade: "websocket", "Sec-WebSocket-Protocol": "parking-events-v1" },
    }))).status).toBe(400);
    expect((await stub.fetch(new Request(`${room}/publish`, {
      method: "POST", body: "not-json",
    }))).status).toBe(400);
    expect((await stub.fetch(new Request(`${room}/publish`, {
      method: "POST", body: JSON.stringify({ schemaVersion: 1, type: "private.data" }),
    }))).status).toBe(400);
    const published = await stub.fetch(new Request(`${room}/publish`, {
      method: "POST",
      body: JSON.stringify({
        schemaVersion: 1,
        type: "facility.changed",
        facilityId: "facility-without-connections",
        changeId: crypto.randomUUID(),
        sourceClientId: "unit-test",
      }),
    }));
    expect(published.status).toBe(200);
    expect(await published.json()).toEqual({ delivered: 0 });
  });

  it("delivers at least 95 of 100 committed changes within two seconds", async () => {
    const response = await connect(facilityId, adminToken, "latency-observer");
    expect(response.status).toBe(101);
    const socket = acceptSocket(response);
    const latenciesMs: number[] = [];

    for (let index = 0; index < 100; index += 1) {
      const event = nextMessage(socket);
      const startedAt = performance.now();
      const entry = await workerFetch("/api/parking-sessions/entry", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "Content-Type": "application/json",
          "X-Client-Id": `latency-writer-${index}`,
        },
        body: JSON.stringify({
          id: `latency-session-${index}-${crypto.randomUUID()}`,
          facilityId,
          businessUnitId: `unit-${facilityId}`,
          spaceCategoryId: `category-${facilityId}`,
          licensePlate: `RT${index.toString().padStart(4, "0")}`,
          entryTime: new Date().toISOString(),
          deviceId: "realtime-latency-test",
        }),
      });
      expect(entry.status).toBe(201);
      await event;
      latenciesMs.push(performance.now() - startedAt);
    }

    const withinTarget = latenciesMs.filter((latency) => latency <= 2000).length;
    expect(withinTarget).toBeGreaterThanOrEqual(95);
  }, 30_000);

  it("does not publish when an API write or an empty offline delta is not applied", async () => {
    const connection = await connect(facilityId, adminToken, "observer-tab");
    const socket = acceptSocket(connection);
    const invalidWrite = await workerFetch(`/api/facilities/${facilityId}/areas`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json", "X-Client-Id": "writer-tab" },
      body: JSON.stringify({ name: "Bad capacity", code: "BAD", allocatedCapacity: -1 }),
    });
    expect(invalidWrite.status).toBe(400);
    await expectNoMessage(socket);

    const emptySync = await workerFetch("/api/sync/delta", {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json", "X-Client-Id": "writer-tab" },
      body: JSON.stringify({ facilityId, deviceId: "realtime-test", mutations: [] }),
    });
    expect(emptySync.status).toBe(200);
    await expectNoMessage(socket);

    const invalidClientEvent = nextMessage(socket);
    const invalidClientEntry = await workerFetch("/api/parking-sessions/entry", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
        "X-Client-Id": "invalid client id",
      },
      body: JSON.stringify({
        id: `invalid-client-session-${crypto.randomUUID()}`,
        facilityId,
        businessUnitId: `unit-${facilityId}`,
        spaceCategoryId: `category-${facilityId}`,
        licensePlate: "IC0001",
        entryTime: new Date().toISOString(),
        deviceId: "realtime-test",
      }),
    });
    expect(invalidClientEntry.status).toBe(201);
    expect(JSON.parse(await invalidClientEvent)).toMatchObject({ sourceClientId: "server" });

    const originalNamespace = bindings.FACILITY_EVENTS;
    Reflect.set(bindings, "FACILITY_EVENTS", undefined);
    try {
      const persistedEntryId = `no-events-session-${crypto.randomUUID()}`;
      const persistedWithoutNotifier = await workerFetch("/api/parking-sessions/entry", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "Content-Type": "application/json",
          "X-Client-Id": "writer-tab",
        },
        body: JSON.stringify({
          id: persistedEntryId,
          facilityId,
          businessUnitId: `unit-${facilityId}`,
          spaceCategoryId: `category-${facilityId}`,
          licensePlate: "NE0001",
          entryTime: new Date().toISOString(),
          deviceId: "realtime-test",
        }),
      });
      expect(persistedWithoutNotifier.status).toBe(201);
      expect((await getD1Database().prepare("SELECT id FROM parking_sessions WHERE id = ?").bind(persistedEntryId).first<{ id: string }>())?.id)
        .toBe(persistedEntryId);
    } finally {
      Reflect.set(bindings, "FACILITY_EVENTS", originalNamespace);
    }
  });
});
