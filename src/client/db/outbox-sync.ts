import {
  getPendingOutboxMutations,
  markOutboxMutationSynced,
} from "./indexed-db";
import type { SyncMutation } from "@core/types/schema";

export interface SyncResult {
  processed: number;
  succeeded: string[];
  conflicts: any[];
}

export type ApiPoster = (endpoint: string, body: any) => Promise<SyncResult>;

export function orderMutationsByTimestamp(mutations: SyncMutation[]): SyncMutation[] {
  return [...mutations].sort((a, b) => a.clientTimestamp.localeCompare(b.clientTimestamp));
}

export async function processDeltaSync(
  facilityId: string,
  deviceId: string,
  apiPoster?: ApiPoster
): Promise<SyncResult> {
  const pendingMutations = orderMutationsByTimestamp(await getPendingOutboxMutations());

  if (pendingMutations.length === 0) {
    return { processed: 0, succeeded: [], conflicts: [] };
  }

  const payload = {
    facilityId,
    deviceId,
    mutations: pendingMutations,
  };

  let result: SyncResult;

  if (apiPoster) {
    result = await apiPoster("/api/sync/delta", payload);
  } else {
    // Default fetch to server API
    const token = typeof localStorage !== "undefined" ? localStorage.getItem("auth_token") || "" : "";
    const response = await fetch("/api/sync/delta", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Error en sincronización delta: HTTP ${response.status}`);
    }

    result = await response.json();
  }

  // Update synced mutations locally
  for (const id of result.succeeded) {
    await markOutboxMutationSynced(id);
  }

  return result;
}
