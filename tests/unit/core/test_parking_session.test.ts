import { describe, it, expect } from "vitest";
import {
  createParkingSession,
  completeParkingSession,
  validateEntryAttempt,
  normalizeLicensePlate,
  formatLicensePlate,
  formatLicensePlateInput,
  isValidLicensePlate,
  updateActiveParkingSessionPlate,
} from "@core/models/parking-session";
import type { ParkingSession } from "@core/types/schema";

describe("User Story 1: Parking Session Core Domain (TDD)", () => {
  const facilityId = "11111111-1111-1111-1111-111111111111";
  const businessUnitId = "22222222-2222-2222-2222-222222222222";
  const spaceCategoryId = "33333333-3333-3333-3333-333333333333";

  it("should create a valid active parking session with normalized plate", () => {
    const session = createParkingSession({
      facilityId,
      businessUnitId,
      spaceCategoryId,
      licensePlate: "ab-1c-23",
      operatorUserId: "user-op-1",
      deviceId: "gate-north",
    });

    expect(session.id).toBeDefined();
    expect(session.licensePlate).toBe("AB1C23");
    expect(session.status).toBe("active");
    expect(session.exitTime).toBeNull();
    expect(session.durationMinutes).toBeNull();
    expect(session.entryTime).toBeDefined();
  });

  it("should prevent duplicate entry when vehicle is already active in facility", () => {
    const activeSessions: ParkingSession[] = [
      createParkingSession({
        facilityId,
        businessUnitId,
        spaceCategoryId,
        licensePlate: "AB1C23",
        operatorUserId: "user-op-1",
        deviceId: "gate-north",
      }),
    ];

    const validation = validateEntryAttempt("ab-1c-23", facilityId, activeSessions);
    expect(validation.isValid).toBe(false);
    expect(validation.error).toContain("ya se encuentra activa");
  });

  it("should allow entry if vehicle had a previous session that is already completed", () => {
    const completedSession: ParkingSession = {
      id: "44444444-4444-4444-4444-444444444444",
      facilityId,
      businessUnitId,
      spaceCategoryId,
      licensePlate: "AB12CD",
      entryTime: "2026-10-15T10:00:00.000Z",
      exitTime: "2026-10-15T11:00:00.000Z",
      status: "completed",
      durationMinutes: 60,
      operatorUserId: "user-op-1",
      deviceId: "gate-north",
      version: 1,
    };

    const validation = validateEntryAttempt("AB12CD", facilityId, [completedSession]);
    expect(validation.isValid).toBe(true);
  });

  it("should complete a session calculating duration accurately", () => {
    const entryTime = new Date("2026-10-15T14:00:00.000Z").toISOString();
    const exitTime = new Date("2026-10-15T15:45:00.000Z").toISOString();

    const initialSession: ParkingSession = {
      id: "55555555-5555-5555-5555-555555555555",
      facilityId,
      businessUnitId,
      spaceCategoryId,
      licensePlate: "XYZ999",
      entryTime,
      exitTime: null,
      status: "active",
      durationMinutes: null,
      operatorUserId: "user-op-1",
      deviceId: "gate-north",
      version: 1,
    };

    const completed = completeParkingSession(initialSession, exitTime);

    expect(completed.status).toBe("completed");
    expect(completed.exitTime).toBe(exitTime);
    expect(completed.durationMinutes).toBe(105); // 1h 45m = 105 mins
    expect(completed.version).toBe(2);
  });

  it("normalizes every six-character alphanumeric combination and formats it in groups of two", () => {
    expect(normalizeLicensePlate("aa-a1-11")).toBe("AAA111");
    expect(normalizeLicensePlate("11-AA-A1")).toBe("11AAA1");
    expect(normalizeLicensePlate("A1-11-AA")).toBe("A111AA");
    expect(formatLicensePlate("A111AA")).toBe("A1-11-AA");
    expect(formatLicensePlate("bad!")).toBe("BAD!");
  });

  it("formats partial input progressively and validates only six alphanumeric characters", () => {
    expect(formatLicensePlateInput("aa")).toBe("AA");
    expect(formatLicensePlateInput("aa1")).toBe("AA-1");
    expect(formatLicensePlateInput("aa1a")).toBe("AA-1A");
    expect(formatLicensePlateInput("aa-1a-11")).toBe("AA-1A-11");
    expect(isValidLicensePlate("AA-1A-11")).toBe(true);
    expect(isValidLicensePlate("11AA A1")).toBe(false);
    expect(isValidLicensePlate("AA1A1")).toBe(false);
    expect(isValidLicensePlate("AA1A111")).toBe(false);
  });

  it("updates only an active session at its expected version and rejects duplicates", () => {
    const active = createParkingSession({
      facilityId,
      businessUnitId,
      spaceCategoryId,
      licensePlate: "AA-1A-11",
      operatorUserId: "user-op-1",
    });
    const other = createParkingSession({
      facilityId,
      businessUnitId,
      spaceCategoryId,
      licensePlate: "BB-2B-22",
      operatorUserId: "user-op-1",
    });

    const corrected = updateActiveParkingSessionPlate({
      currentSession: active,
      licensePlate: "A1-11-AA",
      existingSessions: [active, other],
      expectedVersion: 1,
    });
    expect(corrected).toMatchObject({
      licensePlate: "A111AA",
      entryTime: active.entryTime,
      businessUnitId: active.businessUnitId,
      parkingAreaId: active.parkingAreaId,
      version: 2,
    });
    expect(() => updateActiveParkingSessionPlate({
      currentSession: active,
      licensePlate: "BB-2B-22",
      existingSessions: [active, other],
      expectedVersion: 1,
    })).toThrow(/ya está activa/i);
    expect(() => updateActiveParkingSessionPlate({
      currentSession: active,
      licensePlate: "A1-11-AA",
      existingSessions: [active],
      expectedVersion: 2,
    })).toThrow(/versión/i);
    expect(() => updateActiveParkingSessionPlate({
      currentSession: { ...active, status: "completed" },
      licensePlate: "A1-11-AA",
      existingSessions: [active],
      expectedVersion: 1,
    })).toThrow(/sesión activa/i);
    expect(() => updateActiveParkingSessionPlate({
      currentSession: active,
      licensePlate: "AA 1A 11",
      existingSessions: [active],
      expectedVersion: 1,
    })).toThrow(/seis caracteres/i);
  });
});
