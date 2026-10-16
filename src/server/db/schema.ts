import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const facilities = sqliteTable("facilities", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address").default(""),
  totalCapacity: integer("total_capacity").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const spaceCategories = sqliteTable("space_categories", {
  id: text("id").primaryKey(),
  facilityId: text("facility_id")
    .notNull()
    .references(() => facilities.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  code: text("code").notNull(),
  allocatedSlots: integer("allocated_slots").notNull(),
});

export const businessUnits = sqliteTable("business_units", {
  id: text("id").primaryKey(),
  facilityId: text("facility_id")
    .notNull()
    .references(() => facilities.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  code: text("code").notNull(),
  priorityLevel: integer("priority_level").notNull(),
  quotaType: text("quota_type").notNull(),
  defaultQuota: integer("default_quota").notNull().default(0),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
});

export const eventBookings = sqliteTable("event_bookings", {
  id: text("id").primaryKey(),
  facilityId: text("facility_id")
    .notNull()
    .references(() => facilities.id, { onDelete: "cascade" }),
  businessUnitId: text("business_unit_id")
    .notNull()
    .references(() => businessUnits.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  reservedSlots: integer("reserved_slots").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  status: text("status").notNull().default("scheduled"),
});

export const parkingSessions = sqliteTable("parking_sessions", {
  id: text("id").primaryKey(),
  facilityId: text("facility_id")
    .notNull()
    .references(() => facilities.id, { onDelete: "cascade" }),
  businessUnitId: text("business_unit_id")
    .notNull()
    .references(() => businessUnits.id),
  spaceCategoryId: text("space_category_id")
    .notNull()
    .references(() => spaceCategories.id),
  licensePlate: text("license_plate").notNull(),
  entryTime: text("entry_time").notNull(),
  exitTime: text("exit_time"),
  status: text("status").notNull().default("active"),
  durationMinutes: integer("duration_minutes"),
  operatorUserId: text("operator_user_id").notNull(),
  deviceId: text("device_id").notNull(),
  version: integer("version").notNull().default(1),
});

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  fullName: text("full_name").notNull(),
  role: text("role").notNull(),
  facilityId: text("facility_id").references(() => facilities.id),
  createdAt: text("created_at").notNull(),
});

export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  detailsJson: text("details_json").notNull(),
  createdAt: text("created_at").notNull(),
});
