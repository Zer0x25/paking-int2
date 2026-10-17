import type { AppD1Database, AppD1Statement } from "../../types/app-environment";
import { auditInsert } from "./write-transaction";

export interface AuditEntryInput {
  userId: string;
  facilityId: string;
  action: string;
  entityType: string;
  entityId: string;
  details: unknown;
  mutationId?: string | null;
  createdAt?: string;
}

export function createAuditStatement(
  database: AppD1Database,
  entry: AuditEntryInput,
  nextFacilityVersion: number,
): AppD1Statement {
  return auditInsert(database, {
    id: crypto.randomUUID(),
    userId: entry.userId,
    facilityId: entry.facilityId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    details: entry.details,
    mutationId: entry.mutationId,
    createdAt: entry.createdAt ?? new Date().toISOString(),
  }, nextFacilityVersion);
}
