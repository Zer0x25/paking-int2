import { describe, expect, it } from "vitest";
import { createBusinessUnit, deactivateBusinessUnit, updateBusinessUnit } from "@core/rules/businessUnitRules";
import { checkAllocationAvailability } from "@server/services/allocation-service";
import type { BusinessUnit, Facility } from "@core/types/schema";

const facility: Facility = { id: "fac-1", name: "Facility", address: "", totalCapacity: 100, createdAt: "2026-10-17T00:00:00.000Z", updatedAt: "2026-10-17T00:00:00.000Z" };
const hotel: BusinessUnit = { id: "hotel", facilityId: facility.id, name: "Hotel", code: "HOTEL", priorityLevel: 1, quotaType: "guaranteed", defaultQuota: 40, isActive: true, version: 1 };

describe("Business unit domain rules", () => {
  it("creates units with normalized codes and derived quota priority", () => {
    const created = createBusinessUnit({ name: "Spa & Club", code: " spa ", quotaType: "contractual", defaultQuota: 10 }, facility.id, [hotel], "spa-1");
    expect(created).toMatchObject({ id: "spa-1", name: "Spa & Club", code: "SPA", quotaType: "contractual", priorityLevel: 2, version: 1, isActive: true });
    expect(() => createBusinessUnit({ name: "Duplicate", code: "hotel", quotaType: "dynamic", defaultQuota: 0 }, facility.id, [hotel], "duplicate")).toThrow(/ya está asignado/i);
  });

  it("updates editable fields with optimistic version checks and rejects inactive history", () => {
    const updated = updateBusinessUnit({
      current: hotel,
      updates: { name: "Hotel Norte", code: " htl-n ", quotaType: "dynamic", defaultQuota: 0, version: 1 },
      businessUnits: [hotel],
    });
    expect(updated).toMatchObject({ name: "Hotel Norte", code: "HTL-N", quotaType: "dynamic", priorityLevel: 3, version: 2 });
    expect(() => updateBusinessUnit({ current: hotel, updates: { name: "Old", code: "OLD", quotaType: "dynamic", defaultQuota: 0, version: 2 }, businessUnits: [hotel] })).toThrow(/versión/i);
    expect(() => updateBusinessUnit({ current: { ...hotel, isActive: false }, updates: { name: "Old", code: "OLD", quotaType: "dynamic", defaultQuota: 0, version: 1 }, businessUnits: [{ ...hotel, isActive: false }] })).toThrow(/inactiva/i);
  });

  it("retires unused units but protects dependencies and stale versions", () => {
    expect(deactivateBusinessUnit(hotel, 1, [])).toMatchObject({ isActive: false, version: 2 });
    expect(() => deactivateBusinessUnit(hotel, 1, ["2 sesiones activas", "1 área exclusiva activa"])).toThrow(/sesiones activas, 1 área/i);
    expect(() => deactivateBusinessUnit(hotel, 9, [])).toThrow(/versión/i);
  });

  it("checks admission from one facility snapshot and rejects foreign or inactive units", () => {
    const snapshot = { facility, businessUnits: [hotel], events: [], activeSessions: [], areas: [] };
    expect(checkAllocationAvailability(snapshot, hotel.id).allowed).toBe(true);
    expect(checkAllocationAvailability(snapshot, "missing")).toMatchObject({ allowed: false });
    expect(checkAllocationAvailability({ ...snapshot, businessUnits: [{ ...hotel, isActive: false }] }, hotel.id)).toMatchObject({ allowed: false });
    expect(checkAllocationAvailability({ ...snapshot, facility: { ...facility, id: "other" } }, hotel.id)).toMatchObject({ allowed: false });
  });
});
