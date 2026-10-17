import { describe, expect, it } from "vitest";
import {
  CancelEventBookingInputSchema,
  CreateEventBookingInputSchema,
  type EventBooking,
  type UpdateEventBookingInput,
} from "@core/types/schema";
import {
  cancelEventBooking,
  isEventVisible,
  updateEventBooking,
  validateEventBookingCapacity,
} from "@core/rules/eventBookingRules";
import { formatEventRange, fromDateTimeLocal, toDateTimeLocal } from "../../../src/client/utils/event-booking";

const booking = (
  id: string,
  startTime: string,
  endTime: string,
  reservedSlots = 25,
  status: EventBooking["status"] = "scheduled",
): EventBooking => ({
  id,
  facilityId: "fac-default-01",
  businessUnitId: "bu-events-01",
  title: `Evento ${id}`,
  reservedSlots,
  startTime,
  endTime,
  status,
  version: 1,
});

const createInput = {
  title: "Congreso de Tecnología",
  businessUnitId: "bu-events-01",
  reservedSlots: 35,
  startTime: "2030-11-04T21:00:00.000Z",
  endTime: "2030-11-05T05:00:00.000Z",
};

describe("Event booking schemas and lifecycle rules", () => {
  it("accepts a valid future booking that crosses midnight", () => {
    expect(CreateEventBookingInputSchema.safeParse(createInput).success).toBe(true);
  });

  it("round-trips a selected local date and time without shifting the form value", () => {
    const selectedLocalTime = "2030-11-04T21:15";

    expect(toDateTimeLocal(fromDateTimeLocal(selectedLocalTime))).toBe(selectedLocalTime);
  });

  it("returns an empty value for invalid date-time form values and formats a full range", () => {
    expect(toDateTimeLocal("not-a-date")).toBe("");
    expect(fromDateTimeLocal("not-a-date")).toBe("");
    expect(formatEventRange("2030-11-04T21:00:00.000Z", "2030-11-05T05:00:00.000Z")).toContain("2030");
  });

  it("rejects a booking whose end is not after its start", () => {
    expect(
      CreateEventBookingInputSchema.safeParse({
        ...createInput,
        endTime: createInput.startTime,
      }).success,
    ).toBe(false);
  });

  it("requires the current version when cancelling", () => {
    expect(CancelEventBookingInputSchema.safeParse({ status: "cancelled", version: 1 }).success).toBe(true);
    expect(CancelEventBookingInputSchema.safeParse({ status: "cancelled", version: 0 }).success).toBe(false);
  });

  it("permits bookings when simultaneous commitments fit facility capacity", () => {
    const existing = booking("existing", "2030-11-04T20:00:00.000Z", "2030-11-04T23:00:00.000Z", 25);
    const candidate = booking("candidate", "2030-11-04T22:00:00.000Z", "2030-11-05T02:00:00.000Z", 35);

    expect(() => validateEventBookingCapacity(candidate, [existing], 100, 40)).not.toThrow();
  });

  it("rejects simultaneous reservations that exceed capacity after guaranteed quotas", () => {
    const existing = booking("existing", "2030-11-04T20:00:00.000Z", "2030-11-04T23:00:00.000Z", 25);
    const candidate = booking("candidate", "2030-11-04T22:00:00.000Z", "2030-11-05T02:00:00.000Z", 36);

    expect(() => validateEventBookingCapacity(candidate, [existing], 100, 40)).toThrow(/capacidad/i);
  });

  it("does not combine reservations whose time ranges only touch", () => {
    const existing = booking("existing", "2030-11-04T20:00:00.000Z", "2030-11-04T23:00:00.000Z", 25);
    const candidate = booking("candidate", "2030-11-04T23:00:00.000Z", "2030-11-05T02:00:00.000Z", 60);

    expect(() => validateEventBookingCapacity(candidate, [existing], 100, 40)).not.toThrow();
  });

  it("checks capacity at a later overlapping reservation start", () => {
    const existing = booking("later", "2030-11-04T21:00:00.000Z", "2030-11-04T23:00:00.000Z", 25);
    const candidate = booking("candidate", "2030-11-04T20:00:00.000Z", "2030-11-05T02:00:00.000Z", 35);

    expect(() => validateEventBookingCapacity(candidate, [existing], 100, 40)).not.toThrow();
    expect(() => validateEventBookingCapacity(candidate, [existing], 90, 40)).toThrow(/capacidad/i);
  });

  it("ignores cancelled bookings when checking capacity", () => {
    const cancelled = booking("cancelled", "2030-11-04T20:00:00.000Z", "2030-11-04T23:00:00.000Z", 80, "cancelled");
    const candidate = booking("candidate", cancelled.startTime, cancelled.endTime, 60);

    expect(() => validateEventBookingCapacity(candidate, [cancelled], 100, 40)).not.toThrow();
    expect(() => validateEventBookingCapacity({ ...candidate, status: "cancelled" }, [], 1, 100)).not.toThrow();
  });

  it("updates a booking only at the expected version", () => {
    const current = booking("edit-me", "2030-11-04T20:00:00.000Z", "2030-11-04T23:00:00.000Z");
    const updates: UpdateEventBookingInput = {
      ...createInput,
      title: "Congreso Editado",
      version: 1,
    };
    const updated = updateEventBooking({
      current,
      updates,
      events: [current],
      facilityCapacity: 100,
      guaranteedQuota: 40,
    });

    expect(updated.title).toBe("Congreso Editado");
    expect(updated.version).toBe(2);
    expect(() => updateEventBooking({
      current: updated,
      updates,
      events: [updated],
      facilityCapacity: 100,
      guaranteedQuota: 40,
    })).toThrow(/versión/i);
  });

  it("does not edit closed bookings", () => {
    const updates: UpdateEventBookingInput = { ...createInput, version: 1 };
    for (const status of ["cancelled", "completed"] as const) {
      const current = booking(`closed-${status}`, createInput.startTime, createInput.endTime, 25, status);
      expect(() => updateEventBooking({
        current,
        updates,
        events: [current],
        facilityCapacity: 100,
        guaranteedQuota: 40,
      })).toThrow(/cerrada/i);
    }
  });

  it("cancels logically and releases the booking from future capacity checks", () => {
    const current = booking("cancel-me", "2030-11-04T20:00:00.000Z", "2030-11-04T23:00:00.000Z", 50);
    const cancelled = cancelEventBooking(current, 1);

    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.version).toBe(2);
    expect(() => validateEventBookingCapacity(
      booking("new", current.startTime, current.endTime, 60),
      [cancelled],
      100,
      40,
    )).not.toThrow();
  });

  it("rejects stale and already closed cancellation requests", () => {
    const current = booking("cancel-check", "2030-11-04T20:00:00.000Z", "2030-11-04T23:00:00.000Z");
    expect(() => cancelEventBooking(current, 2)).toThrow(/versión/i);
    expect(() => cancelEventBooking({ ...current, status: "cancelled" }, 1)).toThrow(/cerrada/i);
    expect(() => cancelEventBooking({ ...current, status: "completed" }, 1)).toThrow(/cerrada/i);
  });

  it("keeps an ended booking through the full next local calendar day", () => {
    const end = new Date(2030, 10, 17, 20, 0, 0);
    const graceEnd = new Date(2030, 10, 18, 23, 59, 59, 999);
    const nextDay = new Date(2030, 10, 19, 0, 0, 0);
    const ended = booking("grace", "2030-11-17T10:00:00.000Z", end.toISOString());

    expect(isEventVisible(ended, graceEnd)).toBe(true);
    expect(isEventVisible(ended, nextDay)).toBe(false);
    expect(isEventVisible({ ...ended, status: "cancelled" }, graceEnd)).toBe(false);
    expect(isEventVisible({ ...ended, status: "completed" }, graceEnd)).toBe(false);
    expect(isEventVisible({ ...ended, endTime: "invalid" }, graceEnd)).toBe(false);
  });
});
