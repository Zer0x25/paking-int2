import { describe, it, expect } from "vitest";
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
import { processDeltaSync } from "@client/db/outbox-sync";
import type { SyncMutation, ParkingSession } from "@core/types/schema";

describe("User Story 1: Outbox Sync Manager & IndexedDB (TDD)", () => {
  const facilityId = "11111111-1111-1111-1111-111111111111";
  const deviceId = "gate-terminal-01";

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

  it("should enqueue and retrieve pending mutations", async () => {
    const mutation: SyncMutation = {
      id: "mut-001",
      type: "VEHICLE_ENTRY",
      payload: {
        licensePlate: "TEST123",
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

  it("should mark mutation as synced", async () => {
    await markOutboxMutationSynced("mut-001");
    const pending = await getPendingOutboxMutations();
    expect(pending.some((m) => m.id === "mut-001")).toBe(false);
  });

  it("should process delta sync sending batch to backend api", async () => {
    const mutation: SyncMutation = {
      id: "mut-002",
      type: "VEHICLE_ENTRY",
      payload: {
        licensePlate: "DELTA456",
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
    let payloadSent: any = null;
    const mockApiPoster = async (endpoint: string, body: any) => {
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
    expect(payloadSent.mutations[0].id).toBe("mut-002");
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
      payload: { licensePlate: "FETCH1" },
      clientTimestamp: new Date().toISOString(),
      deviceId,
      status: "pending",
      retryCount: 0,
    };
    await enqueueOutboxMutation(mutation);

    const origFetch = global.fetch;
    global.fetch = (async () => {
      return {
        ok: true,
        json: async () => ({ processed: 1, succeeded: ["mut-fetch-1"], conflicts: [] }),
      } as any;
    }) as any;

    try {
      const result = await processDeltaSync(facilityId, deviceId);
      expect(result.succeeded).toContain("mut-fetch-1");
    } finally {
      global.fetch = origFetch;
    }
  });
});
