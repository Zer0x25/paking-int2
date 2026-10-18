import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import "fake-indexeddb/auto";
import {
  enqueueOutboxMutation,
  getPendingOutboxMutations,
  markOutboxMutationSynced,
  saveLocalSession,
  getLocalSessionByPlate,
  getActiveSessionsCount,
  cacheCatalogData,
  getCachedCatalogData,
} from "@client/db/indexed-db";
import { processDeltaSync, orderMutationsByTimestamp } from "@client/db/outbox-sync";
import type { ApiPoster, SyncDeltaPayload } from "@client/db/outbox-sync";
import type { SyncMutation, ParkingSession } from "@core/types/schema";
import { SyncMutationSchema } from "@core/types/schema";

describe("User Story 1: Outbox Sync Manager & IndexedDB (TDD)", () => {
  const facilityId = "11111111-1111-1111-1111-111111111111";
  const deviceId = "gate-terminal-01";

  beforeEach(() => {
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
      clear: () => values.clear(),
    });
    localStorage.setItem("auth_token", "test-auth-token");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("should save and retrieve local parking sessions from indexed-db", async () => {
    const session: ParkingSession = {
      id: "sess-local-1",
      facilityId,
      businessUnitId: "bu-1",
      spaceCategoryId: "sc-1",
      licensePlate: "LOC123",
      entryTime: new Date().toISOString(),
      exitTime: null,
      status: "active",
      durationMinutes: null,
      operatorUserId: "op1",
      deviceId,
      version: 1,
    };

    await saveLocalSession(session);

    const found = await getLocalSessionByPlate("loc-123", facilityId);
    expect(found).toBeDefined();
    expect(found?.licensePlate).toBe("LOC123");

    const count = await getActiveSessionsCount(facilityId);
    expect(count).toBeGreaterThanOrEqual(1);
  });

  it("should cache and retrieve catalog data", async () => {
    const catalog = { name: "Test Catalog", items: [1, 2, 3] };
    await cacheCatalogData("facilities", catalog);

    const retrieved = await getCachedCatalogData<typeof catalog>("facilities");
    expect(retrieved).not.toBeNull();
    expect(retrieved?.name).toBe("Test Catalog");
  });

  it("returns null for a catalog that is not cached", async () => {
    expect(await getCachedCatalogData("missing-catalog")).toBeNull();
  });

  it("should enqueue and retrieve pending mutations", async () => {
    const mutation: SyncMutation = {
      id: "mut-001",
      type: "VEHICLE_ENTRY",
      payload: {
        licensePlate: "TEST12",
        facilityId,
        businessUnitId: "bu-1",
        spaceCategoryId: "sc-1",
        entryTime: new Date().toISOString(),
      },
      clientTimestamp: new Date().toISOString(),
      deviceId,
      status: "pending",
      retryCount: 0,
    };

    await enqueueOutboxMutation(mutation);
    const pending = await getPendingOutboxMutations();
    expect(pending.length).toBeGreaterThan(0);
    expect(pending.some((m) => m.id === "mut-001")).toBe(true);
  });

  it("accepts offline active plate corrections as a synchronizable mutation", () => {
    const result = SyncMutationSchema.safeParse({
      id: "mut-plate-01",
      type: "VEHICLE_PLATE_UPDATE",
      payload: { sessionId: "session-01", facilityId, licensePlate: "AA1A11", expectedVersion: 1 },
      clientTimestamp: new Date().toISOString(),
      deviceId,
      status: "pending",
      retryCount: 0,
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid mutations before persisting them in IndexedDB", async () => {
    await expect(enqueueOutboxMutation({
      id: "invalid-outbox-mutation",
      type: "VEHICLE_ENTRY",
      payload: { facilityId, businessUnitId: "bu-1", spaceCategoryId: "sc-1", licensePlate: "INVALID" },
      clientTimestamp: new Date().toISOString(),
      deviceId,
      status: "pending",
      retryCount: 0,
    } as unknown as SyncMutation)).rejects.toThrow();

    expect((await getPendingOutboxMutations()).some((mutation) => mutation.id === "invalid-outbox-mutation")).toBe(false);
  });

  it("sends queued operations in timestamp order so an offline entry precedes its correction", () => {
    const later: SyncMutation = {
      id: "a-plate-correction",
      type: "VEHICLE_PLATE_UPDATE",
      payload: { sessionId: "session-1", facilityId, licensePlate: "AA1A11", expectedVersion: 1 },
      clientTimestamp: "2026-10-17T11:00:00.000Z",
      deviceId,
      status: "pending",
      retryCount: 0,
    };
    const earlier: SyncMutation = {
      id: "z-entry",
      type: "VEHICLE_ENTRY",
      payload: { facilityId, businessUnitId: "bu-1", spaceCategoryId: "sc-1", licensePlate: "BB2B22" },
      clientTimestamp: "2026-10-17T10:00:00.000Z",
      deviceId,
      status: "pending",
      retryCount: 0,
    };
    expect(orderMutationsByTimestamp([later, earlier]).map((mutation) => mutation.id)).toEqual(["z-entry", "a-plate-correction"]);
  });

  it("should mark mutation as synced", async () => {
    await markOutboxMutationSynced("mut-001");
    const pending = await getPendingOutboxMutations();
    expect(pending.some((m) => m.id === "mut-001")).toBe(false);
  });

  it("ignores attempts to mark an unknown mutation as synced", async () => {
    await expect(markOutboxMutationSynced("missing-mutation")).resolves.toBeUndefined();
  });

  it("should process delta sync sending batch to backend api", async () => {
    const mutation: SyncMutation = {
      id: "mut-002",
      type: "VEHICLE_ENTRY",
      payload: {
        licensePlate: "DEL456",
        facilityId,
        businessUnitId: "bu-1",
        spaceCategoryId: "sc-1",
        entryTime: new Date().toISOString(),
      },
      clientTimestamp: new Date().toISOString(),
      deviceId,
      status: "pending",
      retryCount: 0,
    };

    await enqueueOutboxMutation(mutation);

    // Mock API client function
    let payloadSent: SyncDeltaPayload | null = null;
    const mockApiPoster: ApiPoster = async (_endpoint, body) => {
      payloadSent = body;
      return {
        processed: 1,
        succeeded: ["mut-002"],
        conflicts: [],
      };
    };

    const result = await processDeltaSync(facilityId, deviceId, mockApiPoster);

    expect(result.processed).toBe(1);
    expect(result.succeeded).toContain("mut-002");
    expect(payloadSent).toMatchObject({ mutations: [{ id: "mut-002" }] });
  });

  it("should return immediately if outbox queue has no pending mutations", async () => {
    const result = await processDeltaSync("fac-empty", "dev-empty");
    expect(result.processed).toBe(0);
    expect(result.succeeded.length).toBe(0);
  });

  it("should use default fetch when apiPoster is not provided", async () => {
    const mutation: SyncMutation = {
      id: "mut-fetch-1",
      type: "VEHICLE_ENTRY",
      payload: {
        facilityId,
        businessUnitId: "bu-1",
        spaceCategoryId: "sc-1",
        licensePlate: "FETCH1",
      },
      clientTimestamp: new Date().toISOString(),
      deviceId,
      status: "pending",
      retryCount: 0,
    };
    await enqueueOutboxMutation(mutation);

    const origFetch = global.fetch;
    global.fetch = async () => new Response(
      JSON.stringify({ processed: 1, succeeded: ["mut-fetch-1"], conflicts: [] }),
      { status: 200 }
    );

    try {
      const result = await processDeltaSync(facilityId, deviceId);
      expect(result.succeeded).toContain("mut-fetch-1");
    } finally {
      global.fetch = origFetch;
    }
  });

  it("sends the stored auth token through the default fetch path", async () => {
    const mutation: SyncMutation = {
      id: "mut-fetch-auth",
      type: "VEHICLE_ENTRY",
      payload: { facilityId, businessUnitId: "bu-1", spaceCategoryId: "sc-1", licensePlate: "AUTH12" },
      clientTimestamp: new Date().toISOString(),
      deviceId,
      status: "pending",
      retryCount: 0,
    };
    await enqueueOutboxMutation(mutation);

    const originalFetch = global.fetch;
    const localStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    let requestHeaders: HeadersInit | undefined;
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: { getItem: () => "test-auth-token" },
    });
    global.fetch = (async (_input, init) => {
      requestHeaders = init?.headers;
      return { ok: true, json: async () => ({ processed: 1, succeeded: [mutation.id], conflicts: [] }) } as Response;
    }) as typeof fetch;

    try {
      await processDeltaSync(facilityId, deviceId);
      expect(new Headers(requestHeaders).get("Authorization")).toBe("Bearer test-auth-token");
    } finally {
      global.fetch = originalFetch;
      if (localStorageDescriptor) Object.defineProperty(globalThis, "localStorage", localStorageDescriptor);
      else Reflect.deleteProperty(globalThis, "localStorage");
    }
  });

  it("refuses to sync when local storage has no saved credential", async () => {
    const mutation: SyncMutation = {
      id: "mut-fetch-empty-auth",
      type: "VEHICLE_ENTRY",
      payload: { facilityId, businessUnitId: "bu-1", spaceCategoryId: "sc-1", licensePlate: "NOAUTH" },
      clientTimestamp: new Date().toISOString(),
      deviceId,
      status: "pending",
      retryCount: 0,
    };
    await enqueueOutboxMutation(mutation);

    const originalFetch = global.fetch;
    const localStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    const expired = vi.fn();
    const browserWindow = new EventTarget();
    vi.stubGlobal("window", browserWindow);
    browserWindow.addEventListener("smart-parking:session-expired", expired);
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: { getItem: () => null },
    });
    const fetchMock = vi.fn();
    global.fetch = fetchMock as typeof fetch;

    try {
      await expect(processDeltaSync(facilityId, deviceId)).rejects.toThrow("No hay una sesión autenticada");
      expect(fetchMock).not.toHaveBeenCalled();
      expect(expired).toHaveBeenCalledOnce();
    } finally {
      browserWindow.removeEventListener("smart-parking:session-expired", expired);
      global.fetch = originalFetch;
      if (localStorageDescriptor) Object.defineProperty(globalThis, "localStorage", localStorageDescriptor);
      else Reflect.deleteProperty(globalThis, "localStorage");
    }
  });

  it("keeps pending mutations when the server rejects a delta batch", async () => {
    const mutation: SyncMutation = {
      id: "mut-fetch-failure",
      type: "VEHICLE_ENTRY",
      payload: { facilityId, businessUnitId: "bu-1", spaceCategoryId: "sc-1", licensePlate: "FAIL12" },
      clientTimestamp: new Date().toISOString(),
      deviceId,
      status: "pending",
      retryCount: 0,
    };
    await enqueueOutboxMutation(mutation);

    const originalFetch = global.fetch;
    global.fetch = (async () => ({ ok: false, status: 503 }) as Response) as typeof fetch;
    try {
      await expect(processDeltaSync(facilityId, deviceId)).rejects.toThrow("HTTP 503");
      expect((await getPendingOutboxMutations()).some((item) => item.id === mutation.id)).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
