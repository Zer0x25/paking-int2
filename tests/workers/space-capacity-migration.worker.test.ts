import { beforeAll, describe, expect, it } from "vitest";
import { applyD1Migrations, getD1Database, readRows } from "./support/d1-fixture";

const facilityId = "capacity-migration-fixture";
const now = "2026-10-18T12:00:00.000Z";

describe("D1 space capacity migration", () => {
  beforeAll(async () => {
    const database = getD1Database();
    await applyD1Migrations(database, "0003_default_space_category.sql");
    await database.prepare(
      "INSERT INTO facilities (id, name, address, total_capacity, version, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)",
    ).bind(facilityId, "Migration fixture", "", 10, now, now).run();
    await database.prepare(
      "INSERT INTO space_categories (id, facility_id, name, code, allocated_slots) VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)",
    ).bind("cat-std", facilityId, "Standard", "STD", 5, "cat-acc", facilityId, "Accessible", "ACC", 3, "cat-vip", facilityId, "VIP", "VIP", 2).run();
    await database.prepare(
      "INSERT INTO business_units (id, facility_id, name, code, priority_level, quota_type, default_quota, is_active, version) VALUES ('unit-migration', ?, 'Unit', 'UNIT', 3, 'dynamic', 0, 1, 1)",
    ).bind(facilityId).run();
    await database.prepare(
      "INSERT INTO parking_areas (id, facility_id, name, code, description, allocated_capacity, business_unit_id, is_active, version, created_at, updated_at) VALUES ('area-migration-a', ?, 'Area A', 'A', '', 6, NULL, 1, 1, ?, ?), ('area-migration-b', ?, 'Area B', 'B', '', 2, NULL, 1, 1, ?, ?)",
    ).bind(facilityId, now, now, facilityId, now, now).run();
    await database.prepare(
      "INSERT INTO parking_sessions (id, facility_id, business_unit_id, space_category_id, parking_area_id, license_plate, entry_time, exit_time, status, duration_minutes, operator_user_id, device_id, version) VALUES ('session-acc', ?, 'unit-migration', 'cat-acc', 'area-migration-a', 'AA11BB', ?, NULL, 'active', NULL, 'operator', 'gate', 1), ('session-std', ?, 'unit-migration', 'cat-std', 'area-migration-a', 'CC22DD', ?, NULL, 'active', NULL, 'operator', 'gate', 1), ('session-vip', ?, 'unit-migration', 'cat-vip', 'area-migration-b', 'EE33FF', ?, NULL, 'active', NULL, 'operator', 'gate', 1)",
    ).bind(facilityId, now, facilityId, now, facilityId, now).run();

    await applyD1Migrations(database);
  });

  it("preserves total and active vehicles while converting legacy capacity to the two supported types", async () => {
    const database = getD1Database();
    const categories = await readRows<{ code: string; allocated_slots: number }>(
      database,
      "SELECT code, allocated_slots FROM space_categories WHERE facility_id = ? ORDER BY code",
      facilityId,
    );
    const capacityByCode = Object.fromEntries(categories.map(({ code, allocated_slots }) => [code, allocated_slots]));

    expect(capacityByCode.STD + capacityByCode.ACC).toBe(10);
    expect(capacityByCode.STD).toBeGreaterThanOrEqual(2);
    expect(capacityByCode.ACC).toBeGreaterThanOrEqual(1);
    expect(capacityByCode.VIP).toBe(0);

    const areas = await readRows<{
      id: string;
      allocated_capacity: number;
      standard_capacity: number;
      accessible_capacity: number;
    }>(database,
    "SELECT id, allocated_capacity, standard_capacity, accessible_capacity FROM parking_areas WHERE facility_id = ? ORDER BY id",
    facilityId);
    expect(areas.reduce((sum, area) => sum + area.allocated_capacity, 0)).toBe(8);
    expect(areas.every((area) => area.standard_capacity + area.accessible_capacity === area.allocated_capacity)).toBe(true);
    expect(areas.reduce((sum, area) => sum + area.standard_capacity, 0)).toBeLessThanOrEqual(capacityByCode.STD);
    expect(areas.reduce((sum, area) => sum + area.accessible_capacity, 0)).toBeLessThanOrEqual(capacityByCode.ACC);
    expect(areas.find(({ id }) => id === "area-migration-a")?.accessible_capacity).toBeGreaterThanOrEqual(1);
    expect(areas.find(({ id }) => id === "area-migration-b")?.standard_capacity).toBeGreaterThanOrEqual(1);

    const sessionCategories = await readRows<{ id: string; space_category_id: string }>(
      database,
      "SELECT id, space_category_id FROM parking_sessions WHERE facility_id = ? ORDER BY id",
      facilityId,
    );
    expect(sessionCategories).toEqual([
      { id: "session-acc", space_category_id: "cat-acc" },
      { id: "session-std", space_category_id: "cat-std" },
      { id: "session-vip", space_category_id: "cat-vip" },
    ]);
  });
});
