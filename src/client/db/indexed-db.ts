import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { SyncMutationSchema, type ParkingSession, type SyncMutation, type ParkingArea } from "@core/types/schema";

export interface ParkingDB extends DBSchema {
  offline_sessions: {
    key: string;
    value: ParkingSession;
    indexes: {
      "by-plate": string;
      "by-status": string;
      "by-facility": string;
      "by-area": string;
    };
  };
  parking_areas: {
    key: string;
    value: ParkingArea;
    indexes: {
      "by-facility": string;
      "by-code": string;
    };
  };
  outbox_queue: {
    key: string;
    value: SyncMutation;
    indexes: {
      "by-status": string;
      "by-timestamp": string;
    };
  };
  catalogs_cache: {
    key: string;
    value: {
      key: string;
      data: unknown;
      updatedAt: string;
    };
  };
}

const DB_NAME = "smart_parking_offline_db";
const DB_VERSION = 2;
export const OUTBOX_CHANGED_EVENT = "smart-parking:outbox-changed";

function notifyOutboxChanged(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(OUTBOX_CHANGED_EVENT));
}

let dbPromise: Promise<IDBPDatabase<ParkingDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<ParkingDB>> {
  if (!dbPromise) {
    dbPromise = openDB<ParkingDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // 1. Offline Sessions store
        if (!db.objectStoreNames.contains("offline_sessions")) {
          const sessionStore = db.createObjectStore("offline_sessions", { keyPath: "id" });
          sessionStore.createIndex("by-plate", "licensePlate");
          sessionStore.createIndex("by-status", "status");
          sessionStore.createIndex("by-facility", "facilityId");
          sessionStore.createIndex("by-area", "parkingAreaId");
        }

        // 2. Parking Areas store
        if (!db.objectStoreNames.contains("parking_areas")) {
          const areaStore = db.createObjectStore("parking_areas", { keyPath: "id" });
          areaStore.createIndex("by-facility", "facilityId");
          areaStore.createIndex("by-code", "code");
        }

        // 3. Outbox Queue store
        if (!db.objectStoreNames.contains("outbox_queue")) {
          const outboxStore = db.createObjectStore("outbox_queue", { keyPath: "id" });
          outboxStore.createIndex("by-status", "status");
          outboxStore.createIndex("by-timestamp", "clientTimestamp");
        }

        // 4. Catalogs cache
        if (!db.objectStoreNames.contains("catalogs_cache")) {
          db.createObjectStore("catalogs_cache", { keyPath: "key" });
        }
      },
    });
  }
  return dbPromise;
}

// Session helper methods
export async function saveLocalSession(session: ParkingSession): Promise<void> {
  const db = await getDB();
  await db.put("offline_sessions", session);
}

export async function deleteLocalSession(sessionId: string): Promise<void> {
  const db = await getDB();
  await db.delete("offline_sessions", sessionId);
}

export async function getLocalSessionByPlate(plate: string, facilityId: string): Promise<ParkingSession | undefined> {
  const db = await getDB();
  const tx = db.transaction("offline_sessions", "readonly");
  const index = tx.store.index("by-plate");
  const normPlate = plate.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const allWithPlate = await index.getAll(normPlate);
  return allWithPlate.find((s) => s.facilityId === facilityId && s.status === "active");
}

export async function getActiveSessionsCount(facilityId: string): Promise<number> {
  return (await getActiveSessions(facilityId)).length;
}

export async function getActiveSessions(facilityId: string): Promise<ParkingSession[]> {
  const db = await getDB();
  const tx = db.transaction("offline_sessions", "readonly");
  const index = tx.store.index("by-facility");
  const all = await index.getAll(facilityId);
  return all
    .filter((session) => session.status === "active")
    .sort((a, b) => b.entryTime.localeCompare(a.entryTime));
}

export const getLocalActiveSessions = getActiveSessions;

// Area helper methods
export async function saveLocalArea(area: ParkingArea): Promise<void> {
  const db = await getDB();
  await db.put("parking_areas", area);
}

export async function getLocalAreas(facilityId: string): Promise<ParkingArea[]> {
  const db = await getDB();
  const tx = db.transaction("parking_areas", "readonly");
  const index = tx.store.index("by-facility");
  return index.getAll(facilityId);
}

export async function getActiveSessionsByArea(areaId: string): Promise<number> {
  const db = await getDB();
  const tx = db.transaction("offline_sessions", "readonly");
  const index = tx.store.index("by-area");
  const all = await index.getAll(areaId);
  return all.filter((s) => s.status === "active").length;
}

// Outbox helper methods
export async function enqueueOutboxMutation(mutation: SyncMutation): Promise<void> {
  const validatedMutation = SyncMutationSchema.parse(mutation);
  const db = await getDB();
  await db.put("outbox_queue", validatedMutation);
  notifyOutboxChanged();
}

export async function getPendingOutboxMutations(): Promise<SyncMutation[]> {
  const db = await getDB();
  const tx = db.transaction("outbox_queue", "readonly");
  const index = tx.store.index("by-status");
  return (await index.getAll("pending")).sort((a, b) => a.clientTimestamp.localeCompare(b.clientTimestamp));
}

export async function markOutboxMutationSynced(id: string): Promise<void> {
  const db = await getDB();
  const mutation = await db.get("outbox_queue", id);
  if (mutation) {
    mutation.status = "synced";
    await db.put("outbox_queue", mutation);
    notifyOutboxChanged();
  }
}

// Catalog helper methods
export async function cacheCatalogData(key: string, data: unknown): Promise<void> {
  const db = await getDB();
  await db.put("catalogs_cache", {
    key,
    data,
    updatedAt: new Date().toISOString(),
  });
}

export async function getCachedCatalogData<T>(key: string): Promise<T | null> {
  const db = await getDB();
  const cached = await db.get("catalogs_cache", key);
  return cached ? (cached.data as T) : null;
}
