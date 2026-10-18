import { describe, expect, it, vi } from "vitest";
import { loadFacilityCatalogs } from "@server/db/repositories/catalog-repository";
import type { AppEnvironment } from "@server/types/app-environment";

describe("facility catalog reads", () => {
  it("loads catalogs in one D1 batch without scanning active parking sessions", async () => {
    const preparedSql: string[] = [];
    const database = {
      prepare(sql: string) {
        preparedSql.push(sql);
        return { bind: () => ({ sql }) };
      },
      batch: vi.fn(async (statements: Array<{ sql: string }>) => [
        { results: [{
          id: "facility-1",
          name: "Test facility",
          address: "",
          total_capacity: 25,
          version: 1,
          created_at: "2026-10-18T00:00:00.000Z",
          updated_at: "2026-10-18T00:00:00.000Z",
        }] },
        ...statements.slice(1).map(() => ({ results: [] })),
      ]),
    };
    const bindings = { PARKING_DB: database } as unknown as AppEnvironment["Bindings"];

    const catalogs = await loadFacilityCatalogs(bindings, "facility-1");

    expect(database.batch).toHaveBeenCalledOnce();
    expect(database.batch.mock.calls[0][0]).toHaveLength(5);
    expect(preparedSql).toHaveLength(5);
    expect(preparedSql.some((sql) => /parking_sessions/i.test(sql))).toBe(false);
    expect(catalogs).not.toHaveProperty("activeSessions");
    if (!catalogs) throw new Error("Expected the seeded facility catalog");
    expect(catalogs.facility.id).toBe("facility-1");
  });
});
