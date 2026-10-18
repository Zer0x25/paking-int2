import type {
  ParkingArea,
  ParkingSession,
  ParkingAreaMetrics,
  CreateParkingAreaInput,
  SpaceCategory,
} from "../types/schema";
import { BusinessRuleError } from "../errors/business-rule-error";
import { createUuid } from "../utils/uuid";

/**
 * Calcula la reserva flotante (buffer general) de plazas no asignadas a un área específica.
 */
export function calculateFacilityBuffer(
  facilityTotalCapacity: number,
  areas: ParkingArea[]
): number {
  const activeAreas = areas.filter((a) => a.isActive);
  const allocatedSum = activeAreas.reduce((sum, a) => sum + a.allocatedCapacity, 0);
  return Math.max(0, facilityTotalCapacity - allocatedSum);
}

export interface FacilityCategoryCapacity {
  standardCapacity: number;
  accessibleCapacity: number;
}

export function splitFacilityCapacity(totalCapacity: number, accessibleCapacity: number): FacilityCategoryCapacity {
  if (!Number.isInteger(totalCapacity) || totalCapacity <= 0) {
    throw new BusinessRuleError("La capacidad total debe ser mayor a 0 y un número entero");
  }
  if (!Number.isInteger(accessibleCapacity) || accessibleCapacity < 0 || accessibleCapacity > totalCapacity) {
    throw new BusinessRuleError("La capacidad Accesible debe ser un entero entre cero y la capacidad total");
  }
  return { standardCapacity: totalCapacity - accessibleCapacity, accessibleCapacity };
}

function areaAccessibleCapacity(area: ParkingArea): number {
  return area.accessibleCapacity ?? 0;
}

function areaStandardCapacity(area: ParkingArea): number {
  return area.standardCapacity ?? Math.max(0, area.allocatedCapacity - areaAccessibleCapacity(area));
}

export function calculateFacilityTypeBuffer(
  capacity: FacilityCategoryCapacity,
  areas: ParkingArea[],
): FacilityCategoryCapacity {
  const activeAreas = areas.filter((area) => area.isActive);
  return {
    standardCapacity: Math.max(0, capacity.standardCapacity - activeAreas.reduce((sum, area) => sum + areaStandardCapacity(area), 0)),
    accessibleCapacity: Math.max(0, capacity.accessibleCapacity - activeAreas.reduce((sum, area) => sum + areaAccessibleCapacity(area), 0)),
  };
}

export function validateFacilityTypeCapacity(input: {
  totalCapacity: number;
  accessibleCapacity: number;
  areas: ParkingArea[];
  activeSessions: ParkingSession[];
  categories: SpaceCategory[];
}): void {
  const split = splitFacilityCapacity(input.totalCapacity, input.accessibleCapacity);
  const activeSessions = input.activeSessions.filter((session) => session.status === "active");
  const accessibleCategoryIds = new Set(input.categories.filter((category) => category.code === "ACC").map((category) => category.id));
  const activeAccessible = activeSessions.filter((session) => accessibleCategoryIds.has(session.spaceCategoryId)).length;
  const activeStandard = activeSessions.length - activeAccessible;
  if (split.standardCapacity < activeStandard) {
    throw new BusinessRuleError(`La capacidad Estándar (${split.standardCapacity}) no puede ser inferior a la ocupación actual (${activeStandard})`);
  }
  if (split.accessibleCapacity < activeAccessible) {
    throw new BusinessRuleError(`La capacidad Accesible (${split.accessibleCapacity}) no puede ser inferior a la ocupación actual (${activeAccessible})`);
  }

  const activeAreas = input.areas.filter((area) => area.isActive);
  const standardAssigned = activeAreas.reduce((sum, area) => sum + areaStandardCapacity(area), 0);
  const accessibleAssigned = activeAreas.reduce((sum, area) => sum + areaAccessibleCapacity(area), 0);
  if (standardAssigned > split.standardCapacity) {
    throw new BusinessRuleError(`La asignación Estándar de las áreas (${standardAssigned}) supera la capacidad Estándar del recinto (${split.standardCapacity})`);
  }
  if (accessibleAssigned > split.accessibleCapacity) {
    throw new BusinessRuleError(`La asignación Accesible de las áreas (${accessibleAssigned}) supera la capacidad Accesible del recinto (${split.accessibleCapacity})`);
  }
}

/**
 * Valida la capacidad total de la instalación frente a las áreas creadas y la ocupación física actual.
 */
export function validateFacilityCapacity(
  newTotalCapacity: number,
  areas: ParkingArea[],
  currentTotalOccupancy: number = 0
): void {
  if (!Number.isInteger(newTotalCapacity) || newTotalCapacity <= 0) {
    throw new BusinessRuleError("La capacidad total debe ser mayor a 0 y un número entero");
  }

  const activeAreas = areas.filter((a) => a.isActive);
  const allocatedSum = activeAreas.reduce((sum, a) => sum + a.allocatedCapacity, 0);

  if (newTotalCapacity < allocatedSum) {
    throw new BusinessRuleError(
      `La capacidad total no puede ser inferior a la suma de plazas asignadas a las áreas (${allocatedSum})`
    );
  }

  if (newTotalCapacity < currentTotalOccupancy) {
    throw new BusinessRuleError(
      `La capacidad total no puede ser inferior a los vehículos actualmente aparcados en el recinto (${currentTotalOccupancy})`
    );
  }
}

/**
 * Crea una nueva área de estacionamiento validando código único y límite de capacidad contra el buffer flotante.
 */
export function createParkingArea(
  input: CreateParkingAreaInput,
  existingAreas: ParkingArea[],
  facilityTotalCapacity: number | FacilityCategoryCapacity
): ParkingArea {
  const normCode = input.code.trim().toUpperCase();

  const codeExists = existingAreas.some(
    (a) => a.facilityId === input.facilityId && a.code.toUpperCase() === normCode
  );
  if (codeExists) {
    throw new BusinessRuleError(`El código de área "${normCode}" ya existe en esta instalación`);
  }

  const capacity = typeof facilityTotalCapacity === "number"
    ? { standardCapacity: facilityTotalCapacity, accessibleCapacity: 0 }
    : facilityTotalCapacity;
  const standardCapacity = input.standardCapacity ?? input.allocatedCapacity ?? 0;
  const accessibleCapacity = input.accessibleCapacity ?? 0;
  const allocatedCapacity = standardCapacity + accessibleCapacity;
  const buffer = calculateFacilityTypeBuffer(capacity, existingAreas);
  if (standardCapacity > buffer.standardCapacity) {
    throw new BusinessRuleError(`La capacidad Estándar solicitada (${standardCapacity}) supera el buffer disponible Estándar (${buffer.standardCapacity})`);
  }
  if (accessibleCapacity > buffer.accessibleCapacity) {
    throw new BusinessRuleError(`La capacidad Accesible solicitada (${accessibleCapacity}) supera el buffer disponible Accesible (${buffer.accessibleCapacity})`);
  }

  const now = new Date().toISOString();
  return {
    id: createUuid(),
    facilityId: input.facilityId,
    name: input.name.trim(),
    code: normCode,
    description: input.description || "",
    allocatedCapacity,
    standardCapacity,
    accessibleCapacity,
    businessUnitId: input.businessUnitId || null,
    isActive: true,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
}

export interface ReallocateCapacityParams {
  areaId: string;
  newCapacity: number;
  standardCapacity?: number;
  accessibleCapacity?: number;
  areas: ParkingArea[];
  facilityTotalCapacity: number;
  facilityAccessibleCapacity?: number;
  activeOccupancy: number;
  activeStandardOccupancy?: number;
  activeAccessibleOccupancy?: number;
  expectedVersion: number;
}

/**
 * Reajusta dinámicamente en caliente la capacidad de un área.
 * Valida concurrencia optimista, protección contra reducción bajo ocupación activa y no sobreasignación global.
 */
export function reallocateAreaCapacity(params: ReallocateCapacityParams): ParkingArea {
  const {
    areaId,
    newCapacity,
    standardCapacity: requestedStandardCapacity,
    accessibleCapacity: requestedAccessibleCapacity,
    areas,
    facilityTotalCapacity,
    facilityAccessibleCapacity = 0,
    activeOccupancy,
    activeStandardOccupancy,
    activeAccessibleOccupancy,
    expectedVersion,
  } = params;

  if (!Number.isInteger(newCapacity) || newCapacity < 0) {
    throw new BusinessRuleError("La nueva capacidad debe ser un número entero mayor o igual a 0");
  }

  const areaIndex = areas.findIndex((a) => a.id === areaId);
  if (areaIndex === -1) {
    throw new BusinessRuleError(`Área con ID "${areaId}" no encontrada`);
  }

  const targetArea = areas[areaIndex];
  const standardCapacity = requestedStandardCapacity ?? newCapacity;
  const accessibleCapacity = requestedAccessibleCapacity ?? 0;
  const allocatedCapacity = standardCapacity + accessibleCapacity;
  if (!Number.isInteger(standardCapacity) || standardCapacity < 0 || !Number.isInteger(accessibleCapacity) || accessibleCapacity < 0 || allocatedCapacity !== newCapacity) {
    throw new BusinessRuleError("La capacidad total del área debe coincidir con Estándar + Accesible");
  }

  // Control de concurrencia optimista
  if (targetArea.version !== expectedVersion) {
    throw new BusinessRuleError(
      `Conflicto de concurrencia optimista: la versión esperada era ${expectedVersion} pero el área se encuentra en la versión ${targetArea.version}`
    );
  }

  // Protección contra reducción menor a ocupación física actual
  const typedOccupancyProvided = activeStandardOccupancy !== undefined || activeAccessibleOccupancy !== undefined;
  if (typedOccupancyProvided) {
    if (standardCapacity < (activeStandardOccupancy ?? 0)) {
      throw new BusinessRuleError(`No es posible reducir Estándar a ${standardCapacity}: hay ${activeStandardOccupancy} vehículos Estándar actualmente en esta área`);
    }
    if (accessibleCapacity < (activeAccessibleOccupancy ?? 0)) {
      throw new BusinessRuleError(`No es posible reducir Accesible a ${accessibleCapacity}: hay ${activeAccessibleOccupancy} vehículos Accesibles actualmente en esta área`);
    }
  } else if (allocatedCapacity < activeOccupancy) {
    throw new BusinessRuleError(
      `No es posible reducir la capacidad a ${allocatedCapacity}: hay ${activeOccupancy} vehículos actualmente estacionados en esta área`
    );
  }

  // Validar capacidad total del complejo
  const otherAreasAllocated = areas
    .filter((a) => a.id !== areaId && a.isActive)
    .reduce((sum, a) => sum + a.allocatedCapacity, 0);

  if (otherAreasAllocated + allocatedCapacity > facilityTotalCapacity) {
    const maxAllowed = facilityTotalCapacity - otherAreasAllocated;
    throw new BusinessRuleError(
      `La nueva capacidad (${allocatedCapacity}) superaría la capacidad total de la instalación (${facilityTotalCapacity}). Máximo permitido para esta área: ${maxAllowed}`
    );
  }

  const facilityStandardCapacity = facilityTotalCapacity - facilityAccessibleCapacity;
  const otherAreas = areas.filter((area) => area.id !== areaId && area.isActive);
  const otherStandard = otherAreas.reduce((sum, area) => sum + areaStandardCapacity(area), 0);
  const otherAccessible = otherAreas.reduce((sum, area) => sum + areaAccessibleCapacity(area), 0);
  if (otherStandard + standardCapacity > facilityStandardCapacity) {
    throw new BusinessRuleError(`La asignación Estándar (${otherStandard + standardCapacity}) supera el buffer Estándar disponible del recinto (${facilityStandardCapacity})`);
  }
  if (otherAccessible + accessibleCapacity > facilityAccessibleCapacity) {
    throw new BusinessRuleError(`La asignación Accesible (${otherAccessible + accessibleCapacity}) supera el buffer Accesible disponible del recinto (${facilityAccessibleCapacity})`);
  }

  return {
    ...targetArea,
    allocatedCapacity,
    standardCapacity,
    accessibleCapacity,
    version: targetArea.version + 1,
    updatedAt: new Date().toISOString(),
  };
}

export interface UpdateParkingAreaParams {
  areaId: string;
  name: string;
  code: string;
  description: string;
  allocatedCapacity: number;
  standardCapacity?: number;
  accessibleCapacity?: number;
  businessUnitId: string | null;
  areas: ParkingArea[];
  facilityTotalCapacity: number;
  facilityAccessibleCapacity?: number;
  activeOccupancy: number;
  activeStandardOccupancy?: number;
  activeAccessibleOccupancy?: number;
  expectedVersion: number;
}

export function updateParkingArea(params: UpdateParkingAreaParams): ParkingArea {
  const {
    areaId,
    name,
    code,
    description,
    allocatedCapacity,
    standardCapacity: requestedStandardCapacity,
    accessibleCapacity: requestedAccessibleCapacity,
    businessUnitId,
    areas,
    facilityTotalCapacity,
    facilityAccessibleCapacity = 0,
    activeOccupancy,
    activeStandardOccupancy,
    activeAccessibleOccupancy,
    expectedVersion,
  } = params;
  const areaIndex = areas.findIndex((area) => area.id === areaId);
  if (areaIndex === -1) {
    throw new BusinessRuleError(`Área con ID "${areaId}" no encontrada`);
  }

  const targetArea = areas[areaIndex];
  if (!targetArea.isActive) {
    throw new BusinessRuleError("No se puede editar un área inactiva");
  }
  if (targetArea.version !== expectedVersion) {
    throw new BusinessRuleError(
      `Conflicto de concurrencia optimista: la versión esperada era ${expectedVersion} pero el área se encuentra en la versión ${targetArea.version}`
    );
  }

  const normalizedName = name.trim();
  const normalizedCode = code.trim().toUpperCase();
  if (normalizedName.length < 2) {
    throw new BusinessRuleError("El nombre del área debe tener al menos 2 caracteres");
  }
  if (normalizedCode.length < 1 || normalizedCode.length > 10) {
    throw new BusinessRuleError("El código del área debe tener entre 1 y 10 caracteres");
  }
  if (
    areas.some(
      (area) =>
        area.id !== areaId &&
        area.facilityId === targetArea.facilityId &&
        area.code.trim().toUpperCase() === normalizedCode
    )
  ) {
    throw new BusinessRuleError(`El código de área "${normalizedCode}" ya existe en esta instalación`);
  }
  const standardCapacity = requestedStandardCapacity ?? allocatedCapacity;
  const accessibleCapacity = requestedAccessibleCapacity ?? 0;
  const normalizedTotal = standardCapacity + accessibleCapacity;
  if (!Number.isInteger(standardCapacity) || standardCapacity < 0 || !Number.isInteger(accessibleCapacity) || accessibleCapacity < 0 || normalizedTotal !== allocatedCapacity) {
    throw new BusinessRuleError("La nueva capacidad debe ser un número entero mayor o igual a 0");
  }
  const typedOccupancyProvided = activeStandardOccupancy !== undefined || activeAccessibleOccupancy !== undefined;
  if (typedOccupancyProvided) {
    if (standardCapacity < (activeStandardOccupancy ?? 0)) {
      throw new BusinessRuleError(`No es posible reducir Estándar a ${standardCapacity}: hay ${activeStandardOccupancy} vehículos Estándar actualmente estacionados en esta área`);
    }
    if (accessibleCapacity < (activeAccessibleOccupancy ?? 0)) {
      throw new BusinessRuleError(`No es posible reducir Accesible a ${accessibleCapacity}: hay ${activeAccessibleOccupancy} vehículos Accesibles actualmente estacionados en esta área`);
    }
  } else if (normalizedTotal < activeOccupancy) {
    throw new BusinessRuleError(
      `No es posible reducir la capacidad a ${normalizedTotal}: hay ${activeOccupancy} vehículos actualmente estacionados en esta área`
    );
  }

  const otherAreasAllocated = areas
    .filter((area) => area.id !== areaId && area.isActive)
    .reduce((sum, area) => sum + area.allocatedCapacity, 0);
  if (otherAreasAllocated + normalizedTotal > facilityTotalCapacity) {
    const maxAllowed = facilityTotalCapacity - otherAreasAllocated;
    throw new BusinessRuleError(
      `La nueva capacidad (${allocatedCapacity}) superaría la capacidad total de la instalación (${facilityTotalCapacity}). Máximo permitido para esta área: ${maxAllowed}`
    );
  }

  const facilityStandardCapacity = facilityTotalCapacity - facilityAccessibleCapacity;
  const otherAreas = areas.filter((area) => area.id !== areaId && area.isActive);
  const otherStandard = otherAreas.reduce((sum, area) => sum + areaStandardCapacity(area), 0);
  const otherAccessible = otherAreas.reduce((sum, area) => sum + areaAccessibleCapacity(area), 0);
  if (otherStandard + standardCapacity > facilityStandardCapacity) {
    throw new BusinessRuleError(`La asignación Estándar (${otherStandard + standardCapacity}) supera la capacidad Estándar del recinto (${facilityStandardCapacity})`);
  }
  if (otherAccessible + accessibleCapacity > facilityAccessibleCapacity) {
    throw new BusinessRuleError(`La asignación Accesible (${otherAccessible + accessibleCapacity}) supera la capacidad Accesible del recinto (${facilityAccessibleCapacity})`);
  }

  return {
    ...targetArea,
    name: normalizedName,
    code: normalizedCode,
    description: description.trim(),
    allocatedCapacity: normalizedTotal,
    standardCapacity,
    accessibleCapacity,
    businessUnitId: businessUnitId || null,
    version: targetArea.version + 1,
    updatedAt: new Date().toISOString(),
  };
}

export interface DeactivateParkingAreaParams {
  areaId: string;
  areas: ParkingArea[];
  activeOccupancy: number;
  expectedVersion: number;
}

export function deactivateParkingArea(params: DeactivateParkingAreaParams): ParkingArea {
  const { areaId, areas, activeOccupancy, expectedVersion } = params;
  const targetArea = areas.find((area) => area.id === areaId);
  if (!targetArea) {
    throw new BusinessRuleError(`Área con ID "${areaId}" no encontrada`);
  }
  if (targetArea.version !== expectedVersion) {
    throw new BusinessRuleError(
      `Conflicto de concurrencia optimista: la versión esperada era ${expectedVersion} pero el área se encuentra en la versión ${targetArea.version}`
    );
  }
  if (!targetArea.isActive) {
    throw new BusinessRuleError("El área ya se encuentra inactiva");
  }
  if (activeOccupancy > 0) {
    throw new BusinessRuleError(
      `No se puede desactivar el área: hay ${activeOccupancy} vehículo${activeOccupancy === 1 ? "" : "s"} actualmente estacionado${activeOccupancy === 1 ? "" : "s"}`
    );
  }

  return {
    ...targetArea,
    isActive: false,
    version: targetArea.version + 1,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Calcula las métricas de disponibilidad de un área específica a partir de las sesiones activas.
 */
export function calculateAreaAvailability(
  area: ParkingArea,
  sessions: ParkingSession[],
  categories: SpaceCategory[] = [],
): ParkingAreaMetrics {
  const activeSessions = sessions.filter(
    (s) => s.status === "active" && s.parkingAreaId === area.id
  );
  const occupied = activeSessions.length;
  const accessibleCategoryIds = new Set(categories.filter((category) => category.code === "ACC").map((category) => category.id));
  const accessibleOccupied = activeSessions.filter((session) => accessibleCategoryIds.has(session.spaceCategoryId)).length;
  const standardOccupied = occupied - accessibleOccupied;
  const standardCapacity = areaStandardCapacity(area);
  const accessibleCapacity = areaAccessibleCapacity(area);
  const standardAvailable = Math.max(0, standardCapacity - standardOccupied);
  const accessibleAvailable = Math.max(0, accessibleCapacity - accessibleOccupied);
  const available = standardAvailable + accessibleAvailable;
  const occupancyPercentage =
    area.allocatedCapacity > 0
      ? Number(((occupied / area.allocatedCapacity) * 100).toFixed(1))
      : occupied > 0
      ? 100
      : 0;
  const isSaturated = occupied >= area.allocatedCapacity;

  return {
    areaId: area.id,
    name: area.name,
    code: area.code,
    allocatedCapacity: area.allocatedCapacity,
    standardCapacity,
    standardOccupied,
    standardAvailable,
    accessibleCapacity,
    accessibleOccupied,
    accessibleAvailable,
    occupied,
    available,
    occupancyPercentage,
    isSaturated,
    businessUnitId: area.businessUnitId,
  };
}

export interface AdmissionCheckResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Valida si un vehículo con destino a una unidad de negocio puede ser admitido en un área física dada.
 */
export function canAdmitVehicleToArea(
  area: ParkingArea,
  sessions: ParkingSession[],
  targetBusinessUnitId: string,
  requestedSpaceCategory?: "STD" | "ACC",
  categories: SpaceCategory[] = [],
): AdmissionCheckResult {
  if (!area.isActive) {
    return { allowed: false, reason: "El área de estacionamiento está inactiva" };
  }

  // Si el área es exclusiva de otra unidad de negocio
  if (area.businessUnitId && area.businessUnitId !== targetBusinessUnitId) {
    return {
      allowed: false,
      reason: `El área "${area.name}" es exclusiva para otra unidad de negocio`,
    };
  }

  const metrics = calculateAreaAvailability(area, sessions, categories);
  if (requestedSpaceCategory === "STD" && metrics.standardAvailable <= 0) {
    return { allowed: false, reason: `No hay plazas Estándar disponibles en el área "${area.name}"` };
  }
  if (requestedSpaceCategory === "ACC" && metrics.accessibleAvailable <= 0) {
    return { allowed: false, reason: `No hay plazas Accesibles disponibles en el área "${area.name}"` };
  }
  if (metrics.occupied >= area.allocatedCapacity) {
    return {
      allowed: false,
      reason: `Capacidad máxima alcanzada en el área "${area.name}" (${metrics.occupied}/${area.allocatedCapacity})`,
    };
  }

  return { allowed: true };
}
