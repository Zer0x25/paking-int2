import type {
  ParkingArea,
  ParkingSession,
  ParkingAreaMetrics,
  CreateParkingAreaInput,
} from "../types/schema";

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

/**
 * Valida la capacidad total de la instalación frente a las áreas creadas y la ocupación física actual.
 */
export function validateFacilityCapacity(
  newTotalCapacity: number,
  areas: ParkingArea[],
  currentTotalOccupancy: number = 0
): void {
  if (!Number.isInteger(newTotalCapacity) || newTotalCapacity <= 0) {
    throw new Error("La capacidad total debe ser mayor a 0 y un número entero");
  }

  const activeAreas = areas.filter((a) => a.isActive);
  const allocatedSum = activeAreas.reduce((sum, a) => sum + a.allocatedCapacity, 0);

  if (newTotalCapacity < allocatedSum) {
    throw new Error(
      `La capacidad total no puede ser inferior a la suma de plazas asignadas a las áreas (${allocatedSum})`
    );
  }

  if (newTotalCapacity < currentTotalOccupancy) {
    throw new Error(
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
  facilityTotalCapacity: number
): ParkingArea {
  const normCode = input.code.trim().toUpperCase();

  const codeExists = existingAreas.some(
    (a) => a.facilityId === input.facilityId && a.code.toUpperCase() === normCode
  );
  if (codeExists) {
    throw new Error(`El código de área "${normCode}" ya existe en esta instalación`);
  }

  const availableBuffer = calculateFacilityBuffer(facilityTotalCapacity, existingAreas);
  if (input.allocatedCapacity > availableBuffer) {
    throw new Error(
      `La capacidad solicitada (${input.allocatedCapacity}) supera el buffer disponible de la instalación (${availableBuffer})`
    );
  }

  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    facilityId: input.facilityId,
    name: input.name.trim(),
    code: normCode,
    description: input.description || "",
    allocatedCapacity: input.allocatedCapacity,
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
  areas: ParkingArea[];
  facilityTotalCapacity: number;
  activeOccupancy: number;
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
    areas,
    facilityTotalCapacity,
    activeOccupancy,
    expectedVersion,
  } = params;

  if (!Number.isInteger(newCapacity) || newCapacity < 0) {
    throw new Error("La nueva capacidad debe ser un número entero mayor o igual a 0");
  }

  const areaIndex = areas.findIndex((a) => a.id === areaId);
  if (areaIndex === -1) {
    throw new Error(`Área con ID "${areaId}" no encontrada`);
  }

  const targetArea = areas[areaIndex];

  // Control de concurrencia optimista
  if (targetArea.version !== expectedVersion) {
    throw new Error(
      `Conflicto de concurrencia optimista: la versión esperada era ${expectedVersion} pero el área se encuentra en la versión ${targetArea.version}`
    );
  }

  // Protección contra reducción menor a ocupación física actual
  if (newCapacity < activeOccupancy) {
    throw new Error(
      `No es posible reducir la capacidad a ${newCapacity}: hay ${activeOccupancy} vehículos actualmente estacionados en esta área`
    );
  }

  // Validar capacidad total del complejo
  const otherAreasAllocated = areas
    .filter((a) => a.id !== areaId && a.isActive)
    .reduce((sum, a) => sum + a.allocatedCapacity, 0);

  if (otherAreasAllocated + newCapacity > facilityTotalCapacity) {
    const maxAllowed = facilityTotalCapacity - otherAreasAllocated;
    throw new Error(
      `La nueva capacidad (${newCapacity}) superaría la capacidad total de la instalación (${facilityTotalCapacity}). Máximo permitido para esta área: ${maxAllowed}`
    );
  }

  return {
    ...targetArea,
    allocatedCapacity: newCapacity,
    version: targetArea.version + 1,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Calcula las métricas de disponibilidad de un área específica a partir de las sesiones activas.
 */
export function calculateAreaAvailability(
  area: ParkingArea,
  sessions: ParkingSession[]
): ParkingAreaMetrics {
  const activeSessions = sessions.filter(
    (s) => s.status === "active" && s.parkingAreaId === area.id
  );
  const occupied = activeSessions.length;
  const available = Math.max(0, area.allocatedCapacity - occupied);
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
  targetBusinessUnitId: string
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

  const metrics = calculateAreaAvailability(area, sessions);
  if (metrics.occupied >= area.allocatedCapacity) {
    return {
      allowed: false,
      reason: `Capacidad máxima alcanzada en el área "${area.name}" (${metrics.occupied}/${area.allocatedCapacity})`,
    };
  }

  return { allowed: true };
}
