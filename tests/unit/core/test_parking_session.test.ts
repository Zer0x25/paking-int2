import { describe, it, expect } from "vitest";
import {
  createParkingSession,
  completeParkingSession,
  validateEntryAttempt,
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
      licensePlate: "ab-123 cd",
      operatorUserId: "user-op-1",
      deviceId: "gate-north",
    });

    expect(session.id).toBeDefined();
    expect(session.licensePlate).toBe("AB123CD");
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
        licensePlate: "AB123CD",
        operatorUserId: "user-op-1",
        deviceId: "gate-north",
      }),
    ];

    const validation = validateEntryAttempt("ab-123-cd", facilityId, activeSessions);
    expect(validation.isValid).toBe(false);
    expect(validation.error).toContain("ya se encuentra activa");
  });

  it("should allow entry if vehicle had a previous session that is already completed", () => {
    const completedSession: ParkingSession = {
      id: "44444444-4444-4444-4444-444444444444",
      facilityId,
      businessUnitId,
      spaceCategoryId,
      licensePlate: "AB123CD",
      entryTime: "2026-10-15T10:00:00.000Z",
      exitTime: "2026-10-15T11:00:00.000Z",
      status: "completed",
      durationMinutes: 60,
      operatorUserId: "user-op-1",
      deviceId: "gate-north",
      version: 1,
    };

    const validation = validateEntryAttempt("AB123CD", facilityId, [completedSession]);
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
});
