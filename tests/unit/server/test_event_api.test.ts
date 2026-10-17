import { describe, expect, it } from "vitest";
import { cancelEventBooking, isEventVisible, updateEventBooking, validateEventBookingCapacity } from "@core/rules/eventBookingRules";
import type { EventBooking } from "@core/types/schema";

const event = (id: string, reservedSlots: number, startTime = "2030-11-04T21:00:00.000Z", endTime = "2030-11-05T05:00:00.000Z"): EventBooking => ({
  id, facilityId: "fac-1", businessUnitId: "events", title: `Event ${id}`, reservedSlots, startTime, endTime, status: "scheduled", version: 1,
});
const updates = { title: "Conference changed", businessUnitId: "events", reservedSlots: 20, startTime: "2030-11-04T21:00:00.000Z", endTime: "2030-11-05T05:00:00.000Z", version: 1 };

describe("Event booking domain rules", () => {
  it("checks capacity only across overlapping active reservations", () => {
    const first = event("e1", 30);
    const second = event("e2", 31);
    const separate = event("e3", 40, "2030-11-06T21:00:00.000Z", "2030-11-07T05:00:00.000Z");
    expect(() => validateEventBookingCapacity(first, [], 100, 40)).not.toThrow();
    expect(() => validateEventBookingCapacity(second, [first], 100, 40)).toThrow(/compromisos simultáneos/i);
    expect(() => validateEventBookingCapacity(separate, [first], 100, 40)).not.toThrow();
  });

  it("updates with version and capacity validation, then cancels while retaining history", () => {
    const current = event("e1", 15);
    const updated = updateEventBooking({ current, updates, events: [current], facilityCapacity: 100, guaranteedQuota: 40 });
    expect(updated).toMatchObject({ title: "Conference changed", reservedSlots: 20, version: 2 });
    expect(() => updateEventBooking({ current, updates: { ...updates, version: 9 }, events: [current], facilityCapacity: 100, guaranteedQuota: 40 })).toThrow(/versión/i);
    const cancelled = cancelEventBooking(updated, 2);
    expect(cancelled).toMatchObject({ status: "cancelled", version: 3 });
    expect(() => cancelEventBooking(cancelled, 3)).toThrow(/cerrada/i);
  });

  it("keeps an event visible until the end of the day after its end date", () => {
    const booking = event("e1", 1, "2026-10-17T08:00:00.000Z", "2026-10-17T18:00:00.000Z");
    expect(isEventVisible(booking, new Date("2026-10-18T23:59:59.999Z"))).toBe(true);
    expect(isEventVisible(booking, new Date("2026-10-19T03:00:00.000Z"))).toBe(false);
    expect(isEventVisible({ ...booking, status: "cancelled" }, new Date("2026-10-17T12:00:00.000Z"))).toBe(false);
  });
});
