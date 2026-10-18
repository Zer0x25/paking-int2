import type {
  BusinessUnit,
  EventBooking,
  Facility,
  ParkingArea,
  ParkingSession,
  SpaceCategory,
} from "@core/types/schema";

export interface FacilityRow {
  id: string;
  name: string;
  address: string;
  total_capacity: number;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface BusinessUnitRow {
  id: string;
  facility_id: string;
  name: string;
  code: string;
  priority_level: number;
  quota_type: BusinessUnit["quotaType"];
  default_quota: number;
  is_active: number;
  version: number;
}

export interface ParkingAreaRow {
  id: string;
  facility_id: string;
  name: string;
  code: string;
  description: string;
  allocated_capacity: number;
  standard_capacity: number;
  accessible_capacity: number;
  business_unit_id: string | null;
  is_active: number;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface EventBookingRow {
  id: string;
  facility_id: string;
  business_unit_id: string;
  title: string;
  reserved_slots: number;
  start_time: string;
  end_time: string;
  status: EventBooking["status"];
  version: number;
}

export interface SpaceCategoryRow {
  id: string;
  facility_id: string;
  name: string;
  code: SpaceCategory["code"];
  allocated_slots: number;
}

export interface ParkingSessionRow {
  id: string;
  facility_id: string;
  business_unit_id: string;
  space_category_id: string;
  parking_area_id: string | null;
  license_plate: string;
  entry_time: string;
  exit_time: string | null;
  status: ParkingSession["status"];
  duration_minutes: number | null;
  operator_user_id: string;
  device_id: string;
  version: number;
}

export function facilityFromRow(row: FacilityRow): Facility {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    totalCapacity: Number(row.total_capacity),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function businessUnitFromRow(row: BusinessUnitRow): BusinessUnit {
  return {
    id: row.id,
    facilityId: row.facility_id,
    name: row.name,
    code: row.code,
    priorityLevel: Number(row.priority_level),
    quotaType: row.quota_type,
    defaultQuota: Number(row.default_quota),
    isActive: Boolean(row.is_active),
    version: Number(row.version),
  };
}

export function parkingAreaFromRow(row: ParkingAreaRow): ParkingArea {
  return {
    id: row.id,
    facilityId: row.facility_id,
    name: row.name,
    code: row.code,
    description: row.description,
    allocatedCapacity: Number(row.allocated_capacity),
    standardCapacity: Number(row.standard_capacity),
    accessibleCapacity: Number(row.accessible_capacity),
    businessUnitId: row.business_unit_id,
    isActive: Boolean(row.is_active),
    version: Number(row.version),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function eventBookingFromRow(row: EventBookingRow): EventBooking {
  return {
    id: row.id,
    facilityId: row.facility_id,
    businessUnitId: row.business_unit_id,
    title: row.title,
    reservedSlots: Number(row.reserved_slots),
    startTime: row.start_time,
    endTime: row.end_time,
    status: row.status,
    version: Number(row.version),
  };
}

export function spaceCategoryFromRow(row: SpaceCategoryRow): SpaceCategory {
  return {
    id: row.id,
    facilityId: row.facility_id,
    name: row.name,
    code: row.code,
    allocatedSlots: Number(row.allocated_slots),
  };
}

export function parkingSessionFromRow(row: ParkingSessionRow): ParkingSession {
  return {
    id: row.id,
    facilityId: row.facility_id,
    businessUnitId: row.business_unit_id,
    spaceCategoryId: row.space_category_id,
    parkingAreaId: row.parking_area_id,
    licensePlate: row.license_plate,
    entryTime: row.entry_time,
    exitTime: row.exit_time,
    status: row.status,
    durationMinutes: row.duration_minutes === null ? null : Number(row.duration_minutes),
    operatorUserId: row.operator_user_id,
    deviceId: row.device_id,
    version: Number(row.version),
  };
}
