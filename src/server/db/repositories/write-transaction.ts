import type { AppD1Database, AppD1Statement } from "../../types/app-environment";

export class PersistenceConflictError extends Error {
  constructor(message = "La configuración cambió; actualice los datos e inténtelo nuevamente") {
    super(message);
    this.name = "PersistenceConflictError";
  }
}

export class PersistenceWriteError extends Error {
  constructor(message = "No se pudo guardar el cambio en la base de datos") {
    super(message);
    this.name = "PersistenceWriteError";
  }
}

export function insertWhenFacilityVersionMatches(
  database: AppD1Database,
  table: string,
  columns: string[],
  values: unknown[],
  facilityId: string,
  nextFacilityVersion: number,
): AppD1Statement {
  const names = columns.join(", ");
  const placeholders = values.map(() => "?").join(", ");
  return database.prepare(
    `INSERT INTO ${table} (${names}) SELECT ${placeholders} WHERE changes() = 1 AND EXISTS (SELECT 1 FROM facilities WHERE id = ? AND version = ?)`,
  ).bind(...values, facilityId, nextFacilityVersion);
}

export function updateWhenFacilityVersionMatches(
  database: AppD1Database,
  table: string,
  assignments: string[],
  values: unknown[],
  whereSql: string,
  whereValues: unknown[],
  facilityId: string,
  nextFacilityVersion: number,
): AppD1Statement {
  return database.prepare(
    `UPDATE ${table} SET ${assignments.join(", ")} WHERE changes() = 1 AND ${whereSql} AND EXISTS (SELECT 1 FROM facilities WHERE id = ? AND version = ?)`,
  ).bind(...values, ...whereValues, facilityId, nextFacilityVersion);
}

export function auditInsert(
  database: AppD1Database,
  values: {
    id: string;
    userId: string;
    facilityId: string;
    action: string;
    entityType: string;
    entityId: string;
    details: unknown;
    mutationId?: string | null;
    createdAt: string;
  },
  nextFacilityVersion: number,
): AppD1Statement {
  return insertWhenFacilityVersionMatches(
    database,
    "audit_logs",
    ["id", "user_id", "facility_id", "action", "entity_type", "entity_id", "details_json", "mutation_id", "created_at"],
    [values.id, values.userId, values.facilityId, values.action, values.entityType, values.entityId, JSON.stringify(values.details), values.mutationId ?? null, values.createdAt],
    values.facilityId,
    nextFacilityVersion,
  );
}

export async function commitFacilityMutation(
  database: AppD1Database,
  input: {
    facilityId: string;
    expectedFacilityVersion: number;
    updatedAt: string;
    statements: AppD1Statement[];
    preconditionSql?: string;
    preconditionValues?: unknown[];
  },
): Promise<void> {
  const { facilityId, expectedFacilityVersion, updatedAt, statements, preconditionSql, preconditionValues = [] } = input;
  const precondition = preconditionSql ? ` AND (${preconditionSql})` : "";
  const compareAndSwap = database.prepare(
    `UPDATE facilities SET version = version + 1, updated_at = ? WHERE id = ? AND version = ?${precondition}`,
  ).bind(updatedAt, facilityId, expectedFacilityVersion, ...preconditionValues);

  let results: unknown[];
  try {
    results = await database.batch([compareAndSwap, ...statements]);
  } catch {
    throw new PersistenceWriteError();
  }
  const firstResult = results[0] as { meta?: { changes?: number } } | undefined;
  if (firstResult?.meta?.changes !== 1) throw new PersistenceConflictError();
  if (results.length !== statements.length + 1) throw new PersistenceWriteError();
  for (const result of results.slice(1)) {
    if ((result as { meta?: { changes?: number } } | undefined)?.meta?.changes !== 1) {
      throw new PersistenceWriteError();
    }
  }
}

export function insertIdempotentMutation(
  database: AppD1Database,
  input: {
    id: string;
    facilityId: string;
    mutationType: string;
    payloadFingerprint: string;
    result: unknown;
    processedAt: string;
  },
  nextFacilityVersion: number,
): AppD1Statement {
  return insertWhenFacilityVersionMatches(
    database,
    "sync_mutations",
    ["id", "facility_id", "mutation_type", "payload_fingerprint", "result_json", "processed_at"],
    [input.id, input.facilityId, input.mutationType, input.payloadFingerprint, JSON.stringify(input.result), input.processedAt],
    input.facilityId,
    nextFacilityVersion,
  );
}
