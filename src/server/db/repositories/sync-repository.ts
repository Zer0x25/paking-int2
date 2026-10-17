import type { AppEnvironment } from "../../types/app-environment";
import { requireD1 } from "../client";

type Bindings = AppEnvironment["Bindings"];

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalize(entry)]));
  }
  return value;
}

export async function fingerprintMutation(mutation: unknown): Promise<string> {
  const record = mutation as { id?: unknown; type?: unknown; payload?: unknown; clientTimestamp?: unknown; deviceId?: unknown };
  const fingerprintInput = record && typeof record === "object" && "payload" in record
    ? { id: record.id, type: record.type, payload: record.payload, clientTimestamp: record.clientTimestamp, deviceId: record.deviceId }
    : mutation;
  const bytes = new TextEncoder().encode(JSON.stringify(canonicalize(fingerprintInput)));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function getMutationReceipt(bindings: Bindings, facilityId: string, mutationId: string): Promise<{
  mutationType: string;
  payloadFingerprint: string;
  result: unknown;
} | null> {
  const row = await requireD1(bindings).prepare(
    "SELECT mutation_type, payload_fingerprint, result_json FROM sync_mutations WHERE facility_id = ? AND id = ? LIMIT 1",
  ).bind(facilityId, mutationId).first<{ mutation_type: string; payload_fingerprint: string; result_json: string }>();
  if (!row) return null;
  return { mutationType: row.mutation_type, payloadFingerprint: row.payload_fingerprint, result: JSON.parse(row.result_json) as unknown };
}
