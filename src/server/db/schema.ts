import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const facilities = sqliteTable("facilities", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address").notNull().default(""),
  totalCapacity: integer("total_capacity").notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  version: integer("version").notNull().default(1),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  check("facilities_capacity_positive", sql`${table.totalCapacity} > 0`),
  check("facilities_active_boolean", sql`${table.isActive} IN (0, 1)`),
  check("facilities_version_positive", sql`${table.version} > 0`),
]);

export const spaceCategories = sqliteTable("space_categories", {
  id: text("id").primaryKey(),
  facilityId: text("facility_id")
    .notNull()
    .references(() => facilities.id),
  name: text("name").notNull(),
  code: text("code").notNull(),
  allocatedSlots: integer("allocated_slots").notNull(),
}, (table) => [
  uniqueIndex("uq_space_categories_facility_code").on(table.facilityId, table.code),
  uniqueIndex("uq_space_categories_facility_id").on(table.facilityId, table.id),
  check("space_categories_code_valid", sql`${table.code} IN ('STD', 'ACC', 'VIP', 'OTHER')`),
  check("space_categories_allocated_slots_nonnegative", sql`${table.allocatedSlots} >= 0`),
]);

export const businessUnits = sqliteTable("business_units", {
  id: text("id").primaryKey(),
  facilityId: text("facility_id")
    .notNull()
    .references(() => facilities.id),
  name: text("name").notNull(),
  code: text("code").notNull(),
  priorityLevel: integer("priority_level").notNull(),
  quotaType: text("quota_type").notNull(),
  defaultQuota: integer("default_quota").notNull().default(0),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  version: integer("version").notNull().default(1),
}, (table) => [
  uniqueIndex("uq_business_units_facility_code").on(table.facilityId, table.code),
  uniqueIndex("uq_business_units_facility_id").on(table.facilityId, table.id),
  index("idx_units_facility_active").on(table.facilityId, table.isActive),
  check("business_units_quota_type_valid", sql`${table.quotaType} IN ('guaranteed', 'contractual', 'dynamic')`),
  check("business_units_priority_level_range", sql`${table.priorityLevel} BETWEEN 1 AND 5`),
  check("business_units_active_boolean", sql`${table.isActive} IN (0, 1)`),
  check("business_units_version_positive", sql`${table.version} > 0`),
  check("business_units_default_quota_nonnegative", sql`${table.defaultQuota} >= 0`),
]);

export const eventBookings = sqliteTable("event_bookings", {
  id: text("id").primaryKey(),
  facilityId: text("facility_id")
    .notNull()
    .references(() => facilities.id),
  businessUnitId: text("business_unit_id").notNull(),
  title: text("title").notNull(),
  reservedSlots: integer("reserved_slots").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  status: text("status").notNull().default("scheduled"),
  version: integer("version").notNull().default(1),
}, (table) => [
  foreignKey({ columns: [table.facilityId, table.businessUnitId], foreignColumns: [businessUnits.facilityId, businessUnits.id] }).onDelete("cascade"),
  uniqueIndex("uq_event_bookings_facility_id").on(table.facilityId, table.id),
  index("idx_events_facility_window_status").on(table.facilityId, table.startTime, table.endTime, table.status),
  check("event_bookings_reserved_slots_positive", sql`${table.reservedSlots} > 0`),
  check("event_bookings_time_order", sql`${table.endTime} > ${table.startTime}`),
  check("event_bookings_status_valid", sql`${table.status} IN ('scheduled', 'active', 'completed', 'cancelled')`),
  check("event_bookings_version_positive", sql`${table.version} > 0`),
]);

export const parkingAreas = sqliteTable("parking_areas", {
  id: text("id").primaryKey(),
  facilityId: text("facility_id")
    .notNull()
    .references(() => facilities.id),
  name: text("name").notNull(),
  code: text("code").notNull(),
  description: text("description").notNull().default(""),
  allocatedCapacity: integer("allocated_capacity").notNull().default(0),
  businessUnitId: text("business_unit_id"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  version: integer("version").notNull().default(1),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  foreignKey({ columns: [table.facilityId, table.businessUnitId], foreignColumns: [businessUnits.facilityId, businessUnits.id] }),
  uniqueIndex("uq_parking_areas_facility_code").on(table.facilityId, table.code),
  uniqueIndex("uq_parking_areas_facility_id").on(table.facilityId, table.id),
  index("idx_areas_facility_active").on(table.facilityId, table.isActive),
  check("parking_areas_name_length", sql`length(${table.name}) >= 2`),
  check("parking_areas_code_length", sql`length(${table.code}) BETWEEN 1 AND 10`),
  check("parking_areas_version_positive", sql`${table.version} > 0`),
  check("parking_areas_active_boolean", sql`${table.isActive} IN (0, 1)`),
  check("parking_areas_capacity_nonnegative", sql`${table.allocatedCapacity} >= 0`),
]);

export const parkingSessions = sqliteTable("parking_sessions", {
  id: text("id").primaryKey(),
  facilityId: text("facility_id")
    .notNull()
    .references(() => facilities.id),
  businessUnitId: text("business_unit_id").notNull(),
  spaceCategoryId: text("space_category_id").notNull(),
  parkingAreaId: text("parking_area_id"),
  licensePlate: text("license_plate").notNull(),
  entryTime: text("entry_time").notNull(),
  exitTime: text("exit_time"),
  status: text("status").notNull().default("active"),
  durationMinutes: integer("duration_minutes"),
  operatorUserId: text("operator_user_id").notNull(),
  deviceId: text("device_id").notNull(),
  version: integer("version").notNull().default(1),
}, (table) => [
  foreignKey({ columns: [table.facilityId, table.businessUnitId], foreignColumns: [businessUnits.facilityId, businessUnits.id] }),
  foreignKey({ columns: [table.facilityId, table.spaceCategoryId], foreignColumns: [spaceCategories.facilityId, spaceCategories.id] }),
  foreignKey({ columns: [table.facilityId, table.parkingAreaId], foreignColumns: [parkingAreas.facilityId, parkingAreas.id] }),
  index("idx_sessions_facility_status_entry").on(table.facilityId, table.status, table.entryTime),
  uniqueIndex("uq_active_facility_plate").on(table.facilityId, table.licensePlate).where(sql`${table.status} = 'active'`),
  check("parking_sessions_plate_format", sql`length(${table.licensePlate}) = 6 AND ${table.licensePlate} = upper(${table.licensePlate})`),
  check("parking_sessions_status_valid", sql`${table.status} IN ('active', 'completed')`),
  check("parking_sessions_version_positive", sql`${table.version} > 0`),
  check("parking_sessions_duration_nonnegative", sql`${table.durationMinutes} IS NULL OR ${table.durationMinutes} >= 0`),
]);

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull(),
  fullName: text("full_name").notNull(),
  role: text("role").notNull(),
  facilityId: text("facility_id").references(() => facilities.id),
  createdAt: text("created_at").notNull(),
}, (table) => [
  uniqueIndex("uq_users_username_nocase").on(sql`${table.username} COLLATE NOCASE`),
  check("users_role_valid", sql`${table.role} IN ('admin', 'operator')`),
]);

export const syncMutations = sqliteTable("sync_mutations", {
  id: text("id").notNull(),
  facilityId: text("facility_id")
    .notNull()
    .references(() => facilities.id),
  mutationType: text("mutation_type").notNull(),
  payloadFingerprint: text("payload_fingerprint").notNull(),
  resultJson: text("result_json").notNull(),
  processedAt: text("processed_at").notNull(),
}, (table) => [
  primaryKey({ columns: [table.facilityId, table.id] }),
]);

export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  facilityId: text("facility_id").notNull().references(() => facilities.id),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  detailsJson: text("details_json").notNull(),
  mutationId: text("mutation_id"),
  createdAt: text("created_at").notNull(),
}, (table) => [
  index("idx_audit_facility_entity_created").on(table.facilityId, table.entityType, table.entityId, table.createdAt),
  foreignKey({ columns: [table.facilityId, table.mutationId], foreignColumns: [syncMutations.facilityId, syncMutations.id] }),
]);
