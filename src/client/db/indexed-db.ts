import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { ParkingSession, SyncMutation } from "@core/types/schema";

export interface ParkingDB extends DBSchema {
  offline_sessions: {
    key: string;
    value: ParkingSession;
    indexes: {
      "by-plate": string;
      "by-status": string;
      "by-facility": string;
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
      data: any;
      updatedAt: string;
    };
  };
}

const DB_NAME = "smart_parking_offline_db";
const DB_VERSION = 1;

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
        }

        // 2. Outbox Queue store
        if (!db.objectStoreNames.contains("outbox_queue")) {
          const outboxStore = db.createObjectStore("outbox_queue", { keyPath: "id" });
          outboxStore.createIndex("by-status", "status");
          outboxStore.createIndex("by-timestamp", "clientTimestamp");
        }

        // 3. Catalogs cache
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

export async function getLocalSessionByPlate(plate: string, facilityId: string): Promise<ParkingSession | undefined> {
  const db = await getDB();
  const tx = db.transaction("offline_sessions", "readonly");
  const index = tx.store.index("by-plate");
  const normPlate = plate.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const allWithPlate = await index.getAll(normPlate);
  return allWithPlate.find((s) => s.facilityId === facilityId && s.status === "active");
}

export async function getActiveSessionsCount(facilityId: string): Promise<number> {
  const db = await getDB();
  const tx = db.transaction("offline_sessions", "readonly");
  const index = tx.store.index("by-facility");
  const all = await index.getAll(facilityId);
  return all.filter((s) => s.status === "active").length;
}

// Outbox helper methods
export async function enqueueOutboxMutation(mutation: SyncMutation): Promise<void> {
  const db = await getDB();
  await db.put("outbox_queue", mutation);
}

export async function getPendingOutboxMutations(): Promise<SyncMutation[]> {
  const db = await getDB();
  const tx = db.transaction("outbox_queue", "readonly");
  const index = tx.store.index("by-status");
  return index.getAll("pending");
}

export async function markOutboxMutationSynced(id: string): Promise<void> {
  const db = await getDB();
  const mutation = await db.get("outbox_queue", id);
  if (mutation) {
    mutation.status = "synced";
    await db.put("outbox_queue", mutation);
  }
}

// Catalog helper methods
export async function cacheCatalogData(key: string, data: any): Promise<void> {
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
