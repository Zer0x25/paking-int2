import { describe, expect, it } from "vitest";
import {
  completeParkingSession,
  createParkingSession,
  formatLicensePlate,
  isValidLicensePlate,
  updateActiveParkingSessionPlate,
  validateEntryAttempt,
} from "@core/models/parking-session";

describe("Parking session domain operations", () => {
  const create = (id: string, plate: string) => createParkingSession({
    id, facilityId: "fac-1", businessUnitId: "bu-1", spaceCategoryId: "cat-1", licensePlate: plate,
    operatorUserId: "operator-1", entryTime: "2026-10-17T09:00:00.000Z",
  });

  it("normalizes accepted alphanumeric plates into the stored six-character form", () => {
    expect(create("s1", "a1-11-aa").licensePlate).toBe("A111AA");
    expect(formatLicensePlate("A111AA")).toBe("A1-11-AA");
    expect(isValidLicensePlate("11-AA-A1")).toBe(true);
    expect(isValidLicensePlate("A-111-AA")).toBe(false);
    expect(validateEntryAttempt("AA1A11", "fac-1", [])).toMatchObject({ isValid: true });
  });

  it("rejects duplicate active plates and supports versioned correction while active", () => {
    const active = create("s1", "AA1A11");
    const second = create("s2", "BB2B22");
    expect(validateEntryAttempt("AA-1A-11", "fac-1", [active])).toMatchObject({ isValid: false });
    const corrected = updateActiveParkingSessionPlate({ currentSession: active, licensePlate: "A1-11-AA", existingSessions: [active, second], expectedVersion: 1 });
    expect(corrected).toMatchObject({ licensePlate: "A111AA", version: 2, status: "active" });
    expect(() => updateActiveParkingSessionPlate({ currentSession: active, licensePlate: "BB2B22", existingSessions: [active, second], expectedVersion: 1 })).toThrow(/ya está activa/i);
    expect(() => updateActiveParkingSessionPlate({ currentSession: active, licensePlate: "A111AA", existingSessions: [active], expectedVersion: 2 })).toThrow(/versión/i);
  });

  it("closes sessions with a calculated duration and blocks plate changes after exit", () => {
    const active = create("s1", "AA1A11");
    const completed = completeParkingSession(active, "2026-10-17T10:30:00.000Z");
    expect(completed).toMatchObject({ status: "completed", durationMinutes: 90, version: 2, exitTime: "2026-10-17T10:30:00.000Z" });
    expect(() => updateActiveParkingSessionPlate({ currentSession: completed, licensePlate: "BB2B22", existingSessions: [completed], expectedVersion: 2 })).toThrow(/sesión activa/i);
  });
});
