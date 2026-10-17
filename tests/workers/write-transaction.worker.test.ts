import { describe, expect, it } from "vitest";
import type { AppD1Database, AppD1Statement } from "../../src/server/types/app-environment";
import {
  commitFacilityMutation,
  PersistenceConflictError,
  PersistenceWriteError,
} from "../../src/server/db/repositories/write-transaction";

type BatchResult = { meta: { changes: number } };

function fakeDatabase(batch: () => Promise<BatchResult[]>): AppD1Database {
  return {
    prepare: () => ({ bind: () => ({}) }),
    batch,
  } as unknown as AppD1Database;
}

const statement = { sql: "UPDATE fixture SET value = 1", values: [] } as unknown as AppD1Statement;

function mutationInput(preconditionSql?: string) {
  return {
    facilityId: "fixture-facility",
    expectedFacilityVersion: 4,
    updatedAt: "2026-10-17T12:00:00.000Z",
    statements: [statement],
    ...(preconditionSql ? { preconditionSql, preconditionValues: ["fixture"] } : {}),
  };
}

describe("D1 compare-and-swap transaction result handling", () => {
  it("accepts a successful compare-and-swap with an optional entity precondition", async () => {
    const database = fakeDatabase(async () => [{ meta: { changes: 1 } }, { meta: { changes: 1 } }]);
    await expect(commitFacilityMutation(database, mutationInput("EXISTS (SELECT 1)"))).resolves.toBeUndefined();
    await expect(commitFacilityMutation(database, mutationInput())).resolves.toBeUndefined();
  });

  it("distinguishes a stale compare-and-swap from incomplete or failed writes", async () => {
    const noMatch = fakeDatabase(async () => [{ meta: { changes: 0 } }, { meta: { changes: 0 } }]);
    await expect(commitFacilityMutation(noMatch, mutationInput())).rejects.toBeInstanceOf(PersistenceConflictError);

    const incomplete = fakeDatabase(async () => [{ meta: { changes: 1 } }]);
    await expect(commitFacilityMutation(incomplete, mutationInput())).rejects.toBeInstanceOf(PersistenceWriteError);

    const skippedStatement = fakeDatabase(async () => [{ meta: { changes: 1 } }, { meta: { changes: 0 } }]);
    await expect(commitFacilityMutation(skippedStatement, mutationInput())).rejects.toBeInstanceOf(PersistenceWriteError);

    const failedBatch = fakeDatabase(async () => { throw new Error("D1 batch failure"); });
    await expect(commitFacilityMutation(failedBatch, mutationInput())).rejects.toBeInstanceOf(PersistenceWriteError);
  });
});
