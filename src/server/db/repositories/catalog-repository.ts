import type {
  BusinessUnit,
  CreateFacilityInput,
  EventBooking,
  Facility,
  ParkingArea,
  UpdateFacilityInput,
  ParkingSession,
  SpaceCategory,
} from "@core/types/schema";
import { createDrizzleDatabase, requireD1 } from "../client";
import { sql } from "drizzle-orm";
import { facilities } from "../schema";
import type { AppD1Database, AppEnvironment } from "../../types/app-environment";
import { createAuditStatement } from "./audit-repository";
import {
  commitFacilityMutation,
  insertWhenFacilityVersionMatches,
  PersistenceConflictError,
  updateWhenFacilityVersionMatches,
} from "./write-transaction";
import {
  businessUnitFromRow,
  eventBookingFromRow,
  facilityFromRow,
  parkingAreaFromRow,
  parkingSessionFromRow,
  spaceCategoryFromRow,
  type BusinessUnitRow,
  type EventBookingRow,
  type FacilityRow,
  type ParkingAreaRow,
  type ParkingSessionRow,
  type SpaceCategoryRow,
} from "./row-mappers";

type Bindings = AppEnvironment["Bindings"];
type Actor = { userId: string };

export interface FacilityCatalogSnapshot {
  facility: Facility;
  facilityVersion: number;
  categories: SpaceCategory[];
  businessUnits: BusinessUnit[];
  areas: ParkingArea[];
  events: EventBooking[];
}

export interface FacilitySnapshot extends FacilityCatalogSnapshot {
  activeSessions: ParkingSession[];
}

function resultRows<T>(result: unknown): T[] {
  const rows = (result as { results?: T[] } | undefined)?.results;
  return rows ?? [];
}

export async function listFacilities(bindings: Bindings, facilityId: string): Promise<Facility[]> {
  const rows = await createDrizzleDatabase(bindings).select().from(facilities)
    .where(sql`${facilities.id} = ${facilityId} AND ${facilities.isActive} = 1`);
  return rows.map((row) => facilityFromRow({
    id: row.id,
    name: row.name,
    address: row.address,
    total_capacity: row.totalCapacity,
    version: row.version,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  }));
}

function facilityCatalogStatements(database: AppD1Database, facilityId: string) {
  return [
    database.prepare("SELECT id, name, address, total_capacity, version, created_at, updated_at FROM facilities WHERE id = ? AND is_active = 1 LIMIT 1").bind(facilityId),
    database.prepare("SELECT id, facility_id, name, code, allocated_slots FROM space_categories WHERE facility_id = ? ORDER BY code").bind(facilityId),
    database.prepare("SELECT id, facility_id, name, code, priority_level, quota_type, default_quota, is_active, version FROM business_units WHERE facility_id = ? ORDER BY priority_level, name").bind(facilityId),
    database.prepare("SELECT id, facility_id, name, code, description, allocated_capacity, business_unit_id, is_active, version, created_at, updated_at FROM parking_areas WHERE facility_id = ? ORDER BY name").bind(facilityId),
    database.prepare("SELECT id, facility_id, business_unit_id, title, reserved_slots, start_time, end_time, status, version FROM event_bookings WHERE facility_id = ? ORDER BY start_time").bind(facilityId),
  ];
}

function mapFacilityCatalogs(results: unknown): FacilityCatalogSnapshot | null {
  const resultList = results as unknown[];
  const [facilityRow] = resultRows<FacilityRow>(resultList[0]);
  if (!facilityRow) return null;
  return {
    facility: facilityFromRow(facilityRow),
    facilityVersion: Number(facilityRow.version),
    categories: resultRows<SpaceCategoryRow>(resultList[1]).map(spaceCategoryFromRow),
    businessUnits: resultRows<BusinessUnitRow>(resultList[2]).map(businessUnitFromRow),
    areas: resultRows<ParkingAreaRow>(resultList[3]).map(parkingAreaFromRow),
    events: resultRows<EventBookingRow>(resultList[4]).map(eventBookingFromRow),
  };
}

export async function loadFacilityCatalogs(bindings: Bindings, facilityId: string): Promise<FacilityCatalogSnapshot | null> {
  const database = requireD1(bindings);
  const results = await database.batch(facilityCatalogStatements(database, facilityId));
  return mapFacilityCatalogs(results);
}

export async function loadFacilitySnapshot(bindings: Bindings, facilityId: string): Promise<FacilitySnapshot | null> {
  const database = requireD1(bindings);
  const results = await database.batch([
    ...facilityCatalogStatements(database, facilityId),
    database.prepare("SELECT id, facility_id, business_unit_id, space_category_id, parking_area_id, license_plate, entry_time, exit_time, status, duration_minutes, operator_user_id, device_id, version FROM parking_sessions WHERE facility_id = ? AND status = 'active' ORDER BY entry_time DESC").bind(facilityId),
  ]);
  const catalogs = mapFacilityCatalogs(results.slice(0, 5));
  if (!catalogs) return null;
  return {
    ...catalogs,
    activeSessions: resultRows<ParkingSessionRow>(results[5]).map(parkingSessionFromRow),
  };
}

function rowChanges(result: unknown): number {
  return (result as { meta?: { changes?: number } } | undefined)?.meta?.changes ?? 0;
}

export async function createFacilityRecord(
  bindings: Bindings,
  input: CreateFacilityInput & { id: string; createdAt: string; updatedAt: string },
  actor: Actor,
): Promise<Facility> {
  const database = requireD1(bindings);
  const facility: Facility = input;
  const auditId = crypto.randomUUID();
  const categoryId = crypto.randomUUID();
  const auditDetails = JSON.stringify({ facility });
  const results = await database.batch([
    database.prepare(
      "INSERT INTO facilities (id, name, address, total_capacity, version, created_at, updated_at) SELECT ?, ?, ?, ?, 1, ?, ? WHERE EXISTS (SELECT 1 FROM users WHERE id = ? AND role = 'admin' AND facility_id IS NULL)",
    ).bind(input.id, input.name, input.address, input.totalCapacity, input.createdAt, input.updatedAt, actor.userId),
    database.prepare(
      "UPDATE users SET facility_id = ? WHERE id = ? AND role = 'admin' AND facility_id IS NULL AND EXISTS (SELECT 1 FROM facilities WHERE id = ? AND is_active = 1)",
    ).bind(input.id, actor.userId, input.id),
    database.prepare("DELETE FROM facilities WHERE id = ? AND changes() = 0").bind(input.id),
    database.prepare(
      "INSERT INTO space_categories (id, facility_id, name, code, allocated_slots) SELECT ?, ?, 'General / Estándar', 'STD', total_capacity FROM facilities WHERE id = ? AND is_active = 1 AND EXISTS (SELECT 1 FROM users WHERE id = ? AND facility_id = ?)",
    ).bind(categoryId, input.id, input.id, actor.userId, input.id),
    database.prepare(
      "INSERT INTO audit_logs (id, user_id, facility_id, action, entity_type, entity_id, details_json, mutation_id, created_at) SELECT ?, ?, ?, 'created', 'facility', ?, ?, NULL, ? WHERE EXISTS (SELECT 1 FROM facilities WHERE id = ? AND is_active = 1) AND EXISTS (SELECT 1 FROM users WHERE id = ? AND facility_id = ?) AND EXISTS (SELECT 1 FROM space_categories WHERE facility_id = ? AND code = 'STD')",
    ).bind(auditId, actor.userId, input.id, input.id, auditDetails, input.createdAt, input.id, actor.userId, input.id, input.id),
  ]);
  const changes = results.map(rowChanges);
  if (results.length !== 5 || changes[0] !== 1 || changes[1] !== 1 || changes[2] !== 0 || changes[3] !== 1 || changes[4] !== 1) {
    throw new PersistenceConflictError("La identidad ya tiene un recinto asignado o el alta se procesó en otra solicitud");
  }
  return facility;
}

export async function updateFacilityRecord(
  bindings: Bindings,
  input: {
    facilityId: string;
    expectedVersion: number;
    updates: UpdateFacilityInput;
    current: Facility;
    actor: Actor;
    activeSessions: ParkingSession[];
    areas: ParkingArea[];
  },
): Promise<Facility> {
  const database = requireD1(bindings);
  const updated: Facility = {
    ...input.current,
    ...input.updates,
    address: input.updates.address ?? input.current.address,
    updatedAt: new Date().toISOString(),
  };
  const nextVersion = input.expectedVersion + 1;
  await commitFacilityMutation(database, {
    facilityId: input.facilityId,
    expectedFacilityVersion: input.expectedVersion,
    updatedAt: updated.updatedAt,
    statements: [
      updateWhenFacilityVersionMatches(
        database,
        "facilities",
        ["name = ?", "address = ?", "total_capacity = ?", "updated_at = ?"],
        [updated.name, updated.address, updated.totalCapacity, updated.updatedAt],
        "id = ? AND version = ?",
        [input.facilityId, nextVersion],
        input.facilityId,
        nextVersion,
      ),
      createAuditStatement(database, {
        userId: input.actor.userId,
        facilityId: input.facilityId,
        action: "updated",
        entityType: "facility",
        entityId: input.facilityId,
        details: { before: input.current, after: updated },
        createdAt: updated.updatedAt,
      }, nextVersion),
    ],
  });
  return updated;
}

export async function deactivateFacilityRecord(
  bindings: Bindings,
  input: { facilityId: string; expectedVersion: number; actor: Actor; updatedAt: string },
): Promise<void> {
  const database = requireD1(bindings);
  const nextVersion = input.expectedVersion + 1;
  await commitFacilityMutation(database, {
    facilityId: input.facilityId,
    expectedFacilityVersion: input.expectedVersion,
    updatedAt: input.updatedAt,
    preconditionSql: "NOT EXISTS (SELECT 1 FROM parking_sessions WHERE facility_id = ? AND status = 'active')",
    preconditionValues: [input.facilityId],
    statements: [
      updateWhenFacilityVersionMatches(
        database,
        "facilities",
        ["is_active = 0"],
        [],
        "id = ? AND version = ? AND is_active = 1",
        [input.facilityId, nextVersion],
        input.facilityId,
        nextVersion,
      ),
      createAuditStatement(database, {
        userId: input.actor.userId,
        facilityId: input.facilityId,
        action: "deactivated",
        entityType: "facility",
        entityId: input.facilityId,
        details: { isActive: false },
        createdAt: input.updatedAt,
      }, nextVersion),
    ],
  });
}

export async function isFacilityActive(bindings: Bindings, facilityId: string): Promise<boolean> {
  return Boolean(await requireD1(bindings).prepare(
    "SELECT id FROM facilities WHERE id = ? AND is_active = 1 LIMIT 1",
  ).bind(facilityId).first<{ id: string }>());
}

export async function createAreaRecord(
  bindings: Bindings,
  input: { area: ParkingArea; facilityVersion: number; actor: Actor },
): Promise<void> {
  const database = requireD1(bindings);
  const { area, facilityVersion, actor } = input;
  const nextVersion = facilityVersion + 1;
  await commitFacilityMutation(database, {
    facilityId: area.facilityId,
    expectedFacilityVersion: facilityVersion,
    updatedAt: area.updatedAt,
    statements: [
      insertWhenFacilityVersionMatches(database, "parking_areas",
        ["id", "facility_id", "name", "code", "description", "allocated_capacity", "business_unit_id", "is_active", "version", "created_at", "updated_at"],
        [area.id, area.facilityId, area.name, area.code, area.description, area.allocatedCapacity, area.businessUnitId, 1, area.version, area.createdAt, area.updatedAt], area.facilityId, nextVersion),
      createAuditStatement(database, { userId: actor.userId, facilityId: area.facilityId, action: "created", entityType: "parking_area", entityId: area.id, details: { area }, createdAt: area.createdAt }, nextVersion),
    ],
  });
}

export async function updateAreaRecord(
  bindings: Bindings,
  input: { area: ParkingArea; expectedVersion: number; facilityVersion: number; actor: Actor; before: ParkingArea },
): Promise<void> {
  const database = requireD1(bindings);
  const { area, expectedVersion, facilityVersion, actor, before } = input;
  const nextVersion = facilityVersion + 1;
  await commitFacilityMutation(database, {
    facilityId: area.facilityId,
    expectedFacilityVersion: facilityVersion,
    updatedAt: area.updatedAt,
    preconditionSql: "EXISTS (SELECT 1 FROM parking_areas WHERE id = ? AND facility_id = ? AND version = ?)",
    preconditionValues: [area.id, area.facilityId, expectedVersion],
    statements: [
      updateWhenFacilityVersionMatches(database, "parking_areas",
        ["name = ?", "code = ?", "description = ?", "allocated_capacity = ?", "business_unit_id = ?", "is_active = ?", "version = ?", "updated_at = ?"],
        [area.name, area.code, area.description, area.allocatedCapacity, area.businessUnitId, area.isActive ? 1 : 0, area.version, area.updatedAt],
        "id = ? AND facility_id = ? AND version = ?", [area.id, area.facilityId, expectedVersion], area.facilityId, nextVersion),
      createAuditStatement(database, { userId: actor.userId, facilityId: area.facilityId, action: area.isActive === before.isActive ? "updated" : "deactivated", entityType: "parking_area", entityId: area.id, details: { before, after: area }, createdAt: area.updatedAt }, nextVersion),
    ],
  });
}

export async function createBusinessUnitRecord(
  bindings: Bindings,
  input: { unit: BusinessUnit; facilityVersion: number; actor: Actor },
): Promise<void> {
  const database = requireD1(bindings);
  const { unit, facilityVersion, actor } = input;
  const nextVersion = facilityVersion + 1;
  await commitFacilityMutation(database, {
    facilityId: unit.facilityId,
    expectedFacilityVersion: facilityVersion,
    updatedAt: new Date().toISOString(),
    statements: [
      insertWhenFacilityVersionMatches(database, "business_units",
        ["id", "facility_id", "name", "code", "priority_level", "quota_type", "default_quota", "is_active", "version"],
        [unit.id, unit.facilityId, unit.name, unit.code, unit.priorityLevel, unit.quotaType, unit.defaultQuota, 1, unit.version], unit.facilityId, nextVersion),
      createAuditStatement(database, { userId: actor.userId, facilityId: unit.facilityId, action: "created", entityType: "business_unit", entityId: unit.id, details: { after: unit } }, nextVersion),
    ],
  });
}

export async function updateBusinessUnitRecord(
  bindings: Bindings,
  input: { unit: BusinessUnit; current: BusinessUnit; expectedVersion: number; facilityVersion: number; actor: Actor },
): Promise<void> {
  const database = requireD1(bindings);
  const { unit, current, expectedVersion, facilityVersion, actor } = input;
  const nextVersion = facilityVersion + 1;
  await commitFacilityMutation(database, {
    facilityId: unit.facilityId,
    expectedFacilityVersion: facilityVersion,
    updatedAt: new Date().toISOString(),
    preconditionSql: "EXISTS (SELECT 1 FROM business_units WHERE id = ? AND facility_id = ? AND version = ?)",
    preconditionValues: [unit.id, unit.facilityId, expectedVersion],
    statements: [
      updateWhenFacilityVersionMatches(database, "business_units",
        ["name = ?", "code = ?", "priority_level = ?", "quota_type = ?", "default_quota = ?", "is_active = ?", "version = ?"],
        [unit.name, unit.code, unit.priorityLevel, unit.quotaType, unit.defaultQuota, unit.isActive ? 1 : 0, unit.version],
        "id = ? AND facility_id = ? AND version = ?", [unit.id, unit.facilityId, expectedVersion], unit.facilityId, nextVersion),
      createAuditStatement(database, { userId: actor.userId, facilityId: unit.facilityId, action: unit.isActive === current.isActive ? "updated" : "deactivated", entityType: "business_unit", entityId: unit.id, details: { before: current, after: unit } }, nextVersion),
    ],
  });
}

export async function createEventRecord(
  bindings: Bindings,
  input: { event: EventBooking; facilityVersion: number; actor: Actor },
): Promise<void> {
  const database = requireD1(bindings);
  const { event, facilityVersion, actor } = input;
  const nextVersion = facilityVersion + 1;
  await commitFacilityMutation(database, {
    facilityId: event.facilityId,
    expectedFacilityVersion: facilityVersion,
    updatedAt: new Date().toISOString(),
    statements: [
      insertWhenFacilityVersionMatches(database, "event_bookings",
        ["id", "facility_id", "business_unit_id", "title", "reserved_slots", "start_time", "end_time", "status", "version"],
        [event.id, event.facilityId, event.businessUnitId, event.title, event.reservedSlots, event.startTime, event.endTime, event.status, event.version], event.facilityId, nextVersion),
      createAuditStatement(database, { userId: actor.userId, facilityId: event.facilityId, action: "created", entityType: "event_booking", entityId: event.id, details: { after: event } }, nextVersion),
    ],
  });
}

export async function updateEventRecord(
  bindings: Bindings,
  input: { event: EventBooking; current: EventBooking; expectedVersion: number; facilityVersion: number; actor: Actor },
): Promise<void> {
  const database = requireD1(bindings);
  const { event, current, expectedVersion, facilityVersion, actor } = input;
  const nextVersion = facilityVersion + 1;
  await commitFacilityMutation(database, {
    facilityId: event.facilityId,
    expectedFacilityVersion: facilityVersion,
    updatedAt: new Date().toISOString(),
    preconditionSql: "EXISTS (SELECT 1 FROM event_bookings WHERE id = ? AND facility_id = ? AND version = ?)",
    preconditionValues: [event.id, event.facilityId, expectedVersion],
    statements: [
      updateWhenFacilityVersionMatches(database, "event_bookings",
        ["business_unit_id = ?", "title = ?", "reserved_slots = ?", "start_time = ?", "end_time = ?", "status = ?", "version = ?"],
        [event.businessUnitId, event.title, event.reservedSlots, event.startTime, event.endTime, event.status, event.version],
        "id = ? AND facility_id = ? AND version = ?", [event.id, event.facilityId, expectedVersion], event.facilityId, nextVersion),
      createAuditStatement(database, { userId: actor.userId, facilityId: event.facilityId, action: event.status === current.status ? "updated" : "cancelled", entityType: "event_booking", entityId: event.id, details: { before: current, after: event } }, nextVersion),
    ],
  });
}
