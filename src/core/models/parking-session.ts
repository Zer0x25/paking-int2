import { LicensePlateInputSchema, ParkingSessionSchema, type ParkingSession } from "../types/schema";
import { createUuid } from "../utils/uuid";

export interface CreateSessionInput {
  id?: string;
  facilityId: string;
  businessUnitId: string;
  spaceCategoryId: string;
  parkingAreaId?: string | null;
  licensePlate: string;
  operatorUserId: string;
  deviceId?: string;
  entryTime?: string;
}

export function normalizeLicensePlate(plate: string): string {
  return plate.toUpperCase().replace(/-/g, "");
}

export function isValidLicensePlate(plate: string): boolean {
  return LicensePlateInputSchema.safeParse(plate).success;
}

export function formatLicensePlate(plate: string): string {
  const normalized = normalizeLicensePlate(plate);
  if (!/^[A-Z0-9]{6}$/.test(normalized)) return plate.toUpperCase();
  return `${normalized.slice(0, 2)}-${normalized.slice(2, 4)}-${normalized.slice(4, 6)}`;
}

export function formatLicensePlateInput(plate: string): string {
  const normalized = plate.toUpperCase().replace(/-/g, "");
  if (normalized.length <= 2) return normalized;
  if (normalized.length <= 4) return `${normalized.slice(0, 2)}-${normalized.slice(2)}`;
  return `${normalized.slice(0, 2)}-${normalized.slice(2, 4)}-${normalized.slice(4)}`;
}

export function validateEntryAttempt(
  plate: string,
  facilityId: string,
  existingSessions: ParkingSession[]
): { isValid: boolean; error?: string } {
  const normPlate = normalizeLicensePlate(plate);
  if (!isValidLicensePlate(plate)) {
    return { isValid: false, error: "La patente debe tener seis caracteres alfanuméricos (XX-XX-XX)" };
  }

  const activeVehicle = existingSessions.find(
    (s) => s.facilityId === facilityId && s.status === "active" && s.licensePlate === normPlate
  );

  if (activeVehicle) {
    return {
      isValid: false,
      error: `El vehículo con patente ${normPlate} ya se encuentra activa dentro del recinto`,
    };
  }

  return { isValid: true };
}

export interface UpdateActiveParkingSessionPlateInput {
  currentSession: ParkingSession;
  licensePlate: string;
  existingSessions: ParkingSession[];
  expectedVersion: number;
}

export function updateActiveParkingSessionPlate({
  currentSession,
  licensePlate,
  existingSessions,
  expectedVersion,
}: UpdateActiveParkingSessionPlateInput): ParkingSession {
  if (currentSession.status !== "active") {
    throw new Error("Solo se puede corregir la patente de una sesión activa");
  }
  if (currentSession.version !== expectedVersion) {
    throw new Error("La versión de la sesión cambió desde que se cargó; actualice la lista e inténtelo nuevamente");
  }
  if (!isValidLicensePlate(licensePlate)) {
    throw new Error("La patente debe tener seis caracteres alfanuméricos (XX-XX-XX)");
  }

  const normalized = normalizeLicensePlate(licensePlate);
  const duplicate = existingSessions.some(
    (session) =>
      session.id !== currentSession.id &&
      session.facilityId === currentSession.facilityId &&
      session.status === "active" &&
      normalizeLicensePlate(session.licensePlate) === normalized
  );
  if (duplicate) {
    throw new Error(`La patente ${formatLicensePlate(normalized)} ya está activa en esta instalación`);
  }

  return ParkingSessionSchema.parse({
    ...currentSession,
    licensePlate: normalized,
    version: currentSession.version + 1,
  });
}

export function createParkingSession(input: CreateSessionInput): ParkingSession {
  const normPlate = normalizeLicensePlate(input.licensePlate);
  const now = input.entryTime || new Date().toISOString();
  const id = input.id || createUuid();

  const rawSession: ParkingSession = {
    id,
    facilityId: input.facilityId,
    businessUnitId: input.businessUnitId,
    spaceCategoryId: input.spaceCategoryId,
    parkingAreaId: input.parkingAreaId || null,
    licensePlate: normPlate,
    entryTime: now,
    exitTime: null,
    status: "active",
    durationMinutes: null,
    operatorUserId: input.operatorUserId,
    deviceId: input.deviceId || "default-gate",
    version: 1,
  };

  return ParkingSessionSchema.parse(rawSession);
}

export function completeParkingSession(
  session: ParkingSession,
  exitTime = new Date().toISOString()
): ParkingSession {
  const entryDate = new Date(session.entryTime);
  const exitDate = new Date(exitTime);
  const diffMs = exitDate.getTime() - entryDate.getTime();
  const durationMinutes = Math.max(0, Math.round(diffMs / (1000 * 60)));

  return ParkingSessionSchema.parse({
    ...session,
    exitTime,
    status: "completed",
    durationMinutes,
    version: session.version + 1,
  });
}
