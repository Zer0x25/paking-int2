import { ParkingSessionSchema, type ParkingSession } from "../types/schema";

export interface CreateSessionInput {
  id?: string;
  facilityId: string;
  businessUnitId: string;
  spaceCategoryId: string;
  licensePlate: string;
  operatorUserId: string;
  deviceId?: string;
  entryTime?: string;
}

export function normalizeLicensePlate(plate: string): string {
  return plate.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function validateEntryAttempt(
  plate: string,
  facilityId: string,
  existingSessions: ParkingSession[]
): { isValid: boolean; error?: string } {
  const normPlate = normalizeLicensePlate(plate);
  if (!normPlate || normPlate.length < 3) {
    return { isValid: false, error: "La placa patente debe tener al menos 3 caracteres alfanuméricos" };
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

export function createParkingSession(input: CreateSessionInput): ParkingSession {
  const normPlate = normalizeLicensePlate(input.licensePlate);
  const now = input.entryTime || new Date().toISOString();
  const id = input.id || crypto.randomUUID();

  const rawSession: ParkingSession = {
    id,
    facilityId: input.facilityId,
    businessUnitId: input.businessUnitId,
    spaceCategoryId: input.spaceCategoryId,
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
