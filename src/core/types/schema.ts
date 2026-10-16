import { z } from "zod";

// --- Facility ---
export const FacilitySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(2, "El nombre de la instalación debe tener al menos 2 caracteres"),
  address: z.string().optional().default(""),
  totalCapacity: z.number().int().positive("La capacidad total debe ser mayor a 0"),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Facility = z.infer<typeof FacilitySchema>;

export const CreateFacilityInputSchema = z.object({
  name: z.string().min(2, "El nombre de la instalación debe tener al menos 2 caracteres"),
  address: z.string().optional().default(""),
  totalCapacity: z.number().int().positive("La capacidad total debe ser mayor a 0"),
});
export type CreateFacilityInput = z.infer<typeof CreateFacilityInputSchema>;

export const UpdateFacilityInputSchema = z.object({
  name: z.string().min(2).optional(),
  address: z.string().optional(),
  totalCapacity: z.number().int().positive().optional(),
});
export type UpdateFacilityInput = z.infer<typeof UpdateFacilityInputSchema>;

// --- Parking Area ---
export const ParkingAreaSchema = z.object({
  id: z.string().min(1),
  facilityId: z.string().min(1),
  name: z.string().min(2, "El nombre del área debe tener al menos 2 caracteres"),
  code: z.string().min(1).max(10).toUpperCase(),
  description: z.string().optional().default(""),
  allocatedCapacity: z.number().int().nonnegative("La capacidad asignada no puede ser negativa"),
  businessUnitId: z.string().nullable().default(null),
  isActive: z.boolean().default(true),
  version: z.number().int().default(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ParkingArea = z.infer<typeof ParkingAreaSchema>;

export const CreateParkingAreaInputSchema = z.object({
  facilityId: z.string().min(1),
  name: z.string().min(2, "El nombre del área debe tener al menos 2 caracteres"),
  code: z.string().min(1).max(10).toUpperCase(),
  description: z.string().optional().default(""),
  allocatedCapacity: z.number().int().nonnegative("La capacidad debe ser mayor o igual a 0"),
  businessUnitId: z.string().nullable().optional().default(null),
});
export type CreateParkingAreaInput = z.input<typeof CreateParkingAreaInputSchema>;

export const UpdateParkingAreaCapacityInputSchema = z.object({
  allocatedCapacity: z.number().int().nonnegative(),
  version: z.number().int().positive(),
});
export type UpdateParkingAreaCapacityInput = z.infer<typeof UpdateParkingAreaCapacityInputSchema>;

export const ParkingAreaMetricsSchema = z.object({
  areaId: z.string().min(1),
  name: z.string(),
  code: z.string(),
  allocatedCapacity: z.number().int().nonnegative(),
  occupied: z.number().int().nonnegative(),
  available: z.number().int().nonnegative(),
  occupancyPercentage: z.number().min(0).max(100),
  isSaturated: z.boolean(),
  businessUnitId: z.string().nullable(),
});
export type ParkingAreaMetrics = z.infer<typeof ParkingAreaMetricsSchema>;

// --- Space Category ---
export const SpaceCategorySchema = z.object({
  id: z.string().min(1),
  facilityId: z.string().min(1),
  name: z.string().min(1),
  code: z.enum(["STD", "ACC", "VIP", "OTHER"]),
  allocatedSlots: z.number().int().nonnegative(),
});
export type SpaceCategory = z.infer<typeof SpaceCategorySchema>;

// --- Business Unit ---
export const QuotaTypeEnum = z.enum(["guaranteed", "contractual", "dynamic"]);
export type QuotaType = z.infer<typeof QuotaTypeEnum>;

export const BusinessUnitSchema = z.object({
  id: z.string().min(1),
  facilityId: z.string().min(1),
  name: z.string().min(1),
  code: z.string().min(1).toUpperCase(),
  priorityLevel: z.number().int().min(1).max(5), // 1: Máxima (Hotel), 2: Contractual (Eventos), 3: Rotativa Comercial
  quotaType: QuotaTypeEnum,
  defaultQuota: z.number().int().nonnegative().default(0),
  isActive: z.boolean().default(true),
});
export type BusinessUnit = z.infer<typeof BusinessUnitSchema>;

// --- Event Booking ---
export const EventStatusEnum = z.enum(["scheduled", "active", "completed", "cancelled"]);
export type EventStatus = z.infer<typeof EventStatusEnum>;

export const EventBookingSchema = z.object({
  id: z.string().min(1),
  facilityId: z.string().min(1),
  businessUnitId: z.string().min(1),
  title: z.string().min(1),
  reservedSlots: z.number().int().positive(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  status: EventStatusEnum.default("scheduled"),
});
export type EventBooking = z.infer<typeof EventBookingSchema>;

// --- Parking Session ---
export const SessionStatusEnum = z.enum(["active", "completed"]);
export type SessionStatus = z.infer<typeof SessionStatusEnum>;

export const ParkingSessionSchema = z.object({
  id: z.string().min(1),
  facilityId: z.string().min(1),
  businessUnitId: z.string().min(1),
  spaceCategoryId: z.string().min(1),
  parkingAreaId: z.string().nullable().optional(),
  licensePlate: z
    .string()
    .min(3, "Patente muy corta")
    .max(12, "Patente muy larga")
    .transform((val) => val.toUpperCase().replace(/[^A-Z0-9]/g, "")),
  entryTime: z.string().datetime(),
  exitTime: z.string().datetime().nullable().default(null),
  status: SessionStatusEnum.default("active"),
  durationMinutes: z.number().int().nonnegative().nullable().default(null),
  operatorUserId: z.string(),
  deviceId: z.string().default("default-gate"),
  version: z.number().int().default(1),
});
export type ParkingSession = z.infer<typeof ParkingSessionSchema>;

// --- User & RBAC ---
export const UserRoleEnum = z.enum(["admin", "operator"]);
export type UserRole = z.infer<typeof UserRoleEnum>;

export const UserSchema = z.object({
  id: z.string().min(1),
  username: z.string().min(3),
  passwordHash: z.string(),
  fullName: z.string().min(1),
  role: UserRoleEnum,
  facilityId: z.string().min(1).optional().nullable(),
  createdAt: z.string().datetime(),
});
export type User = z.infer<typeof UserSchema>;

// --- Audit Log ---
export const AuditLogSchema = z.object({
  id: z.string().min(1),
  userId: z.string(),
  action: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  detailsJson: z.string(),
  createdAt: z.string().datetime(),
});
export type AuditLog = z.infer<typeof AuditLogSchema>;

// --- Offline Outbox Sync Mutation ---
export const MutationTypeEnum = z.enum(["VEHICLE_ENTRY", "VEHICLE_EXIT"]);
export type MutationType = z.infer<typeof MutationTypeEnum>;

export const SyncMutationSchema = z.object({
  id: z.string().min(1),
  type: MutationTypeEnum,
  payload: z.record(z.any()),
  clientTimestamp: z.string().datetime(),
  deviceId: z.string(),
  status: z.enum(["pending", "syncing", "synced", "failed"]).default("pending"),
  retryCount: z.number().int().default(0),
});
export type SyncMutation = z.infer<typeof SyncMutationSchema>;

// --- Dashboard & Occupancy Metrics ---
export const AlertLevelEnum = z.enum(["normal", "warning", "critical"]);
export type AlertLevel = z.infer<typeof AlertLevelEnum>;

export const BusinessUnitMetricsSchema = z.object({
  businessUnitId: z.string().min(1),
  name: z.string(),
  code: z.string(),
  priorityLevel: z.number().int(),
  quotaType: QuotaTypeEnum,
  occupied: z.number().int().nonnegative(),
  allocatedQuota: z.number().int().nonnegative(),
  isSaturated: z.boolean(),
});
export type BusinessUnitMetrics = z.infer<typeof BusinessUnitMetricsSchema>;

export const DashboardMetricsSchema = z.object({
  facilityId: z.string().min(1),
  totalCapacity: z.number().int().nonnegative(),
  totalOccupied: z.number().int().nonnegative(),
  totalAvailable: z.number().int().nonnegative(),
  occupancyPercentage: z.number().min(0).max(100),
  alertLevel: AlertLevelEnum,
  units: z.array(BusinessUnitMetricsSchema),
  areas: z.array(ParkingAreaMetricsSchema).default([]),
  floatingBuffer: z.number().int().nonnegative().default(0),
  timestamp: z.string().datetime(),
});
export type DashboardMetrics = z.infer<typeof DashboardMetricsSchema>;
