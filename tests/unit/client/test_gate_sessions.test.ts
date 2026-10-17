import { beforeEach, describe, expect, it } from "vitest";
import "fake-indexeddb/auto";
import {
  getActiveSessions,
  getLocalActiveSessions,
  deleteLocalSession,
  saveLocalSession,
} from "@client/db/indexed-db";
import { findStaleActiveSessionIds, getLocalEntryValidationError, mergeActiveParkingSessions } from "@client/utils/gate-operations";
import type { ParkingSession, SyncMutation } from "@core/types/schema";

const baseSession = (overrides: Partial<ParkingSession> = {}): ParkingSession => ({
  id: "session-1",
  facilityId: "facility-1",
  businessUnitId: "unit-1",
  spaceCategoryId: "category-1",
  parkingAreaId: null,
  licensePlate: "AA1A11",
  entryTime: "2026-10-17T10:00:00.000Z",
  exitTime: null,
  status: "active",
  durationMinutes: null,
  operatorUserId: "operator-1",
  deviceId: "gate-1",
  version: 1,
  ...overrides,
});

describe("active vehicle list data", () => {
  beforeEach(async () => {
    const sessions = await getActiveSessions("facility-1");
    for (const session of sessions) {
      await saveLocalSession({ ...session, status: "completed" });
    }
  });

  it("reads active local sessions for the selected facility", async () => {
    await saveLocalSession(baseSession({ id: "active-1" }));
    await saveLocalSession(baseSession({ id: "other-facility", facilityId: "facility-2" }));
    await saveLocalSession(baseSession({ id: "completed-1", status: "completed" }));

    const active = await getActiveSessions("facility-1");
    expect(active.map((session) => session.id)).toEqual(["active-1"]);
  });

  it("merges offline changes without resurrecting pending exits", () => {
    const remote = [
      baseSession({ id: "remote-update" }),
      baseSession({ id: "remote-exit", licensePlate: "BB2B22", entryTime: "2026-10-17T09:00:00.000Z" }),
    ];
    const local = [
      baseSession({ id: "remote-update", licensePlate: "A111AA", version: 2 }),
      baseSession({ id: "local-entry", licensePlate: "11AAA1", entryTime: "2026-10-17T11:00:00.000Z" }),
      baseSession({ id: "remote-exit", licensePlate: "BB2B22", status: "completed", exitTime: "2026-10-17T11:01:00.000Z" }),
    ];
    const pending: SyncMutation[] = [
      { id: "local-entry", type: "VEHICLE_ENTRY", payload: { facilityId: "facility-1", businessUnitId: "unit-1", spaceCategoryId: "category-1", licensePlate: "11AAA1" }, clientTimestamp: "2026-10-17T11:00:00.000Z", deviceId: "gate-1", status: "pending", retryCount: 0 },
      { id: "exit-mut", type: "VEHICLE_EXIT", payload: { sessionId: "remote-exit" }, clientTimestamp: "2026-10-17T11:01:00.000Z", deviceId: "gate-1", status: "pending", retryCount: 0 },
      { id: "plate-mut", type: "VEHICLE_PLATE_UPDATE", payload: { facilityId: "facility-1", sessionId: "remote-update", licensePlate: "A111AA", expectedVersion: 1 }, clientTimestamp: "2026-10-17T11:02:00.000Z", deviceId: "gate-1", status: "pending", retryCount: 0 },
    ];

    const merged = mergeActiveParkingSessions({ facilityId: "facility-1", remoteSessions: remote, localSessions: local, pendingMutations: pending });
    expect(merged.map((session) => session.id)).toEqual(["local-entry", "remote-update"]);
    expect(merged.find((session) => session.id === "remote-update")?.licensePlate).toBe("A111AA");
  });

  it("filters sessions outside the facility and hides legacy plate-only exits", () => {
    const remote = [
      baseSession({ id: "legacy-exit", licensePlate: "BB2B22" }),
      baseSession({ id: "already-completed", status: "completed" }),
      baseSession({ id: "other-facility-remote", facilityId: "facility-2" }),
      baseSession({ id: "pending-entry-already-remote" }),
    ];
    const local = [
      baseSession({ id: "legacy-exit", licensePlate: "BB2B22" }),
      baseSession({ id: "other-facility-local", facilityId: "facility-2" }),
      baseSession({ id: "completed-local", status: "completed" }),
      baseSession({ id: "pending-entry-already-remote" }),
      baseSession({ id: "pending-plate-not-remote" }),
    ];
    const pending: SyncMutation[] = [
      { id: "pending-entry-already-remote", type: "VEHICLE_ENTRY", payload: { facilityId: "facility-1", businessUnitId: "unit-1", spaceCategoryId: "category-1", licensePlate: "CC3C33" }, clientTimestamp: "2026-10-17T11:00:00.000Z", deviceId: "gate-1", status: "pending", retryCount: 0 },
      { id: "pending-plate-not-remote-mut", type: "VEHICLE_PLATE_UPDATE", payload: { facilityId: "facility-1", sessionId: "pending-plate-not-remote", licensePlate: "DD4D44", expectedVersion: 1 }, clientTimestamp: "2026-10-17T11:01:00.000Z", deviceId: "gate-1", status: "pending", retryCount: 0 },
      { id: "legacy-exit-mut", type: "VEHICLE_EXIT", payload: { facilityId: "facility-1", licensePlate: "BB-2B-22" }, clientTimestamp: "2026-10-17T11:02:00.000Z", deviceId: "gate-1", status: "pending", retryCount: 0 },
    ];

    const merged = mergeActiveParkingSessions({ facilityId: "facility-1", remoteSessions: remote, localSessions: local, pendingMutations: pending });
    expect(merged.map((session) => session.id)).toEqual(["pending-entry-already-remote"]);
  });

  it("loads active local sessions through the public list helper", async () => {
    await saveLocalSession(baseSession({ id: "helper-session" }));
    expect((await getLocalActiveSessions("facility-1")).map((session) => session.id)).toContain("helper-session");
  });

  it("removes an inactive cached session by ID", async () => {
    await saveLocalSession(baseSession({ id: "deleted-cache", facilityId: "facility-delete" }));
    await deleteLocalSession("deleted-cache");
    expect(await getActiveSessions("facility-delete")).toEqual([]);
  });

  it("rejects an offline duplicate plate but allows a plate active only at another facility", () => {
    const active = baseSession({ licensePlate: "AA1A11" });
    expect(getLocalEntryValidationError("aa-1a-11", "facility-1", [active])).toMatch(/ya se encuentra activa/i);
    expect(getLocalEntryValidationError("AA1A11", "facility-2", [active])).toBeNull();
    expect(getLocalEntryValidationError("AA1A11", "facility-1", [baseSession({ status: "completed" })])).toBeNull();
  });

  it("returns the domain validation message for an invalid offline entry", () => {
    expect(getLocalEntryValidationError("AA 1A 11", "facility-1", [])).toMatch(/seis caracteres/i);
  });

  it("identifies stale local sessions while retaining pending offline operations", () => {
    const remote = [baseSession({ id: "still-active" })];
    const local = [
      baseSession({ id: "still-active" }),
      baseSession({ id: "stale-local" }),
      baseSession({ id: "pending-entry" }),
      baseSession({ id: "pending-plate" }),
    ];
    const pending: SyncMutation[] = [
      { id: "pending-entry", type: "VEHICLE_ENTRY", payload: { facilityId: "facility-1", businessUnitId: "unit-1", spaceCategoryId: "category-1", licensePlate: "BB2B22" }, clientTimestamp: "2026-10-17T11:00:00.000Z", deviceId: "gate-1", status: "pending", retryCount: 0 },
      { id: "plate-mutation", type: "VEHICLE_PLATE_UPDATE", payload: { facilityId: "facility-1", sessionId: "pending-plate", licensePlate: "CC3C33", expectedVersion: 1 }, clientTimestamp: "2026-10-17T11:01:00.000Z", deviceId: "gate-1", status: "pending", retryCount: 0 },
      { id: "pending-exit", type: "VEHICLE_EXIT", payload: { facilityId: "facility-1", sessionId: "stale-local" }, clientTimestamp: "2026-10-17T11:02:00.000Z", deviceId: "gate-1", status: "pending", retryCount: 0 },
    ];

    expect(findStaleActiveSessionIds({ facilityId: "facility-1", remoteSessions: remote, localSessions: local, pendingMutations: pending })).toEqual(["stale-local"]);
  });

  it("ignores cached sessions that are completed or belong to another facility", () => {
    const local = [
      baseSession({ id: "completed-local", status: "completed" }),
      baseSession({ id: "other-facility-local", facilityId: "facility-2" }),
      baseSession({ id: "stale-local" }),
    ];
    expect(findStaleActiveSessionIds({ facilityId: "facility-1", remoteSessions: [], localSessions: local, pendingMutations: [] })).toEqual(["stale-local"]);
  });
});
