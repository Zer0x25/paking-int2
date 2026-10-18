import type {
  Facility,
  BusinessUnit,
  ParkingSession,
  ParkingArea,
  DashboardMetrics,
  AlertLevel,
  SpaceCategory,
} from "../types/schema";
import {
  calculateFacilityBuffer,
  calculateAreaAvailability,
} from "./areaAllocationRules";

export interface DashboardInput {
  facility: Facility;
  businessUnits: BusinessUnit[];
  activeSessions: ParkingSession[];
  areas?: ParkingArea[];
  spaceCategories?: SpaceCategory[];
  timestamp?: string;
}

export function computeDashboardMetrics(input: DashboardInput): DashboardMetrics {
  const { facility, businessUnits } = input;
  const activeSessions = input.activeSessions.filter((s) => s.status === "active");
  const totalOccupied = activeSessions.length;
  const totalCapacity = facility.totalCapacity;
  const totalAvailable = Math.max(0, totalCapacity - totalOccupied);
  const categories = input.spaceCategories ?? [];
  const accessibleCategoryIds = new Set(categories.filter((category) => category.code === "ACC").map((category) => category.id));
  const accessibleCapacity = categories.find((category) => category.code === "ACC")?.allocatedSlots ?? 0;
  const standardCapacity = categories.find((category) => category.code === "STD")?.allocatedSlots ?? (totalCapacity - accessibleCapacity);
  const accessibleOccupied = activeSessions.filter((session) => accessibleCategoryIds.has(session.spaceCategoryId)).length;
  const standardOccupied = totalOccupied - accessibleOccupied;
  const standardAvailable = Math.max(0, standardCapacity - standardOccupied);
  const accessibleAvailable = Math.max(0, accessibleCapacity - accessibleOccupied);

  const occupancyPercentage =
    totalCapacity > 0 ? Math.min(100, Math.round((totalOccupied / totalCapacity) * 100)) : 0;

  let alertLevel: AlertLevel = "normal";
  if (occupancyPercentage >= 100) {
    alertLevel = "critical";
  } else if (occupancyPercentage >= 90) {
    alertLevel = "warning";
  }

  const units = businessUnits.map((bu) => {
    const occupied = activeSessions.filter((s) => s.businessUnitId === bu.id).length;
    const isSaturated = bu.defaultQuota > 0 && occupied >= bu.defaultQuota;

    return {
      businessUnitId: bu.id,
      name: bu.name,
      code: bu.code,
      priorityLevel: bu.priorityLevel,
      quotaType: bu.quotaType,
      occupied,
      allocatedQuota: bu.defaultQuota,
      isSaturated,
    };
  });

  const areasList = input.areas || [];
  const floatingBuffer = calculateFacilityBuffer(totalCapacity, areasList);
  const areasMetrics = areasList.map((a) => calculateAreaAvailability(a, activeSessions, categories));

  return {
    facilityId: facility.id,
    totalCapacity,
    totalOccupied,
    totalAvailable,
    standardCapacity,
    standardOccupied,
    standardAvailable,
    accessibleCapacity,
    accessibleOccupied,
    accessibleAvailable,
    occupancyPercentage,
    alertLevel,
    units,
    areas: areasMetrics,
    floatingBuffer,
    timestamp: input.timestamp || new Date().toISOString(),
  };
}
