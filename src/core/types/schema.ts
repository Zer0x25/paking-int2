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

export const UpdateParkingAreaInputSchema = z.object({
  name: z.string().trim().min(2, "El nombre del área debe tener al menos 2 caracteres"),
  code: z.string().trim().min(1).max(10).transform((value) => value.toUpperCase()),
  description: z.string().trim().default(""),
  allocatedCapacity: z.number().int().nonnegative(),
  businessUnitId: z.string().nullable().default(null),
  version: z.number().int().positive(),
});
export type UpdateParkingAreaInput = z.infer<typeof UpdateParkingAreaInputSchema>;

export const DeactivateParkingAreaInputSchema = z.object({
  isActive: z.literal(false),
  version: z.number().int().positive(),
});
export type DeactivateParkingAreaInput = z.infer<typeof DeactivateParkingAreaInputSchema>;

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
  version: z.number().int().positive().default(1),
});
export type BusinessUnit = z.infer<typeof BusinessUnitSchema>;

const BusinessUnitEditableFieldsSchema = z.object({
  name: z.string().trim().min(1, "El nombre de la unidad es obligatorio").max(80),
  code: z.string().trim().min(1, "El código es obligatorio").max(10).transform((value) => value.toUpperCase()),
  quotaType: QuotaTypeEnum,
  defaultQuota: z.number().int().nonnegative("Los cupos base deben ser un entero no negativo"),
});

export const CreateBusinessUnitInputSchema = BusinessUnitEditableFieldsSchema;
export type CreateBusinessUnitInput = z.infer<typeof CreateBusinessUnitInputSchema>;

export const UpdateBusinessUnitInputSchema = BusinessUnitEditableFieldsSchema.extend({
  version: z.number().int().positive(),
});
export type UpdateBusinessUnitInput = z.infer<typeof UpdateBusinessUnitInputSchema>;

export const DeactivateBusinessUnitInputSchema = z.object({
  isActive: z.literal(false),
  version: z.number().int().positive(),
});
export type DeactivateBusinessUnitInput = z.infer<typeof DeactivateBusinessUnitInputSchema>;

// --- Event Booking ---
export const EventStatusEnum = z.enum(["scheduled", "active", "completed", "cancelled"]);
export type EventStatus = z.infer<typeof EventStatusEnum>;

const EventBookingFieldsSchema = z.object({
  id: z.string().min(1),
  facilityId: z.string().min(1),
  businessUnitId: z.string().min(1),
  title: z.string().trim().min(2).max(120),
  reservedSlots: z.number().int().positive(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  status: EventStatusEnum.default("scheduled"),
  version: z.number().int().positive().default(1),
});

const EventBookingTimeRange = {
  message: "La fecha y hora de término debe ser posterior al inicio",
  path: ["endTime"] as ["endTime"],
};

export const EventBookingSchema = EventBookingFieldsSchema.refine(
  (event) => Date.parse(event.endTime) > Date.parse(event.startTime),
  EventBookingTimeRange,
);
export type EventBooking = z.infer<typeof EventBookingSchema>;

export const CreateEventBookingInputSchema = z.object({
  title: EventBookingFieldsSchema.shape.title,
  businessUnitId: EventBookingFieldsSchema.shape.businessUnitId,
  reservedSlots: EventBookingFieldsSchema.shape.reservedSlots,
  startTime: EventBookingFieldsSchema.shape.startTime,
  endTime: EventBookingFieldsSchema.shape.endTime,
}).refine(
  (event) => Date.parse(event.endTime) > Date.parse(event.startTime),
  EventBookingTimeRange,
);
export type CreateEventBookingInput = z.infer<typeof CreateEventBookingInputSchema>;

export const UpdateEventBookingInputSchema = CreateEventBookingInputSchema.innerType().extend({
  version: z.number().int().positive(),
}).refine(
  (event) => Date.parse(event.endTime) > Date.parse(event.startTime),
  EventBookingTimeRange,
);
export type UpdateEventBookingInput = z.infer<typeof UpdateEventBookingInputSchema>;

export const CancelEventBookingInputSchema = z.object({
  status: z.literal("cancelled"),
  version: z.number().int().positive(),
});
export type CancelEventBookingInput = z.infer<typeof CancelEventBookingInputSchema>;

// --- Parking Session ---
export const SessionStatusEnum = z.enum(["active", "completed"]);
export type SessionStatus = z.infer<typeof SessionStatusEnum>;

export const LicensePlateInputSchema = z
  .string()
  .regex(/^(?:[A-Z0-9]{6}|[A-Z0-9]{2}-[A-Z0-9]{2}-[A-Z0-9]{2})$/i, "La patente debe tener formato XX-XX-XX")
  .transform((value) => value.toUpperCase().replace(/-/g, ""));

export const ParkingSessionSchema = z.object({
  id: z.string().min(1),
  facilityId: z.string().min(1),
  businessUnitId: z.string().min(1),
  spaceCategoryId: z.string().min(1),
  parkingAreaId: z.string().nullable().optional(),
  licensePlate: LicensePlateInputSchema,
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
  facilityId: z.string().min(1),
  action: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  detailsJson: z.string(),
  createdAt: z.string().datetime(),
});
export type AuditLog = z.infer<typeof AuditLogSchema>;

// --- Offline Outbox Sync Mutation ---
export const MutationTypeEnum = z.enum(["VEHICLE_ENTRY", "VEHICLE_EXIT", "VEHICLE_PLATE_UPDATE"]);
export type MutationType = z.infer<typeof MutationTypeEnum>;

const SyncMutationBaseSchema = {
  id: z.string().min(1),
  clientTimestamp: z.string().datetime(),
  deviceId: z.string(),
  status: z.enum(["pending", "syncing", "synced", "failed"]).default("pending"),
  retryCount: z.number().int().default(0),
};

export const SyncMutationSchema = z.discriminatedUnion("type", [
  z.object({
    ...SyncMutationBaseSchema,
    type: z.literal("VEHICLE_ENTRY"),
    payload: z.object({
      facilityId: z.string().min(1).optional(),
      businessUnitId: z.string().min(1),
      spaceCategoryId: z.string().min(1),
      parkingAreaId: z.string().min(1).nullable().optional(),
      licensePlate: LicensePlateInputSchema,
      entryTime: z.string().datetime().optional(),
      operatorUserId: z.string().min(1).optional(),
    }).strict(),
  }).strict(),
  z.object({
    ...SyncMutationBaseSchema,
    type: z.literal("VEHICLE_EXIT"),
    payload: z.object({
      facilityId: z.string().min(1).optional(),
      sessionId: z.string().min(1).optional(),
      licensePlate: LicensePlateInputSchema.optional(),
      exitTime: z.string().datetime().optional(),
      expectedVersion: z.number().int().positive().optional(),
      operatorUserId: z.string().min(1).optional(),
    }).strict().refine((payload) => Boolean(payload.sessionId || payload.licensePlate), {
      message: "La salida debe incluir sessionId o licensePlate",
    }),
  }).strict(),
  z.object({
    ...SyncMutationBaseSchema,
    type: z.literal("VEHICLE_PLATE_UPDATE"),
    payload: z.object({
      facilityId: z.string().min(1).optional(),
      sessionId: z.string().min(1),
      licensePlate: LicensePlateInputSchema,
      expectedVersion: z.number().int().positive(),
      operatorUserId: z.string().min(1).optional(),
    }).strict(),
  }).strict(),
]);
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
