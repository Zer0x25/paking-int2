import { describe, expect, it } from "vitest";
import {
  BusinessUnitSchema,
  CreateBusinessUnitInputSchema,
  type BusinessUnit,
} from "@core/types/schema";
import {
  createBusinessUnit,
  deactivateBusinessUnit,
  updateBusinessUnit,
} from "@core/rules/businessUnitRules";

const activeUnit: BusinessUnit = {
  id: "bu-spa-01",
  facilityId: "fac-01",
  name: "Spa",
  code: "SPA",
  priorityLevel: 3,
  quotaType: "dynamic",
  defaultQuota: 0,
  isActive: true,
  version: 1,
};

describe("Business unit lifecycle rules", () => {
  it("validates the four editable fields and rejects invalid quotas", () => {
    expect(CreateBusinessUnitInputSchema.safeParse({
      name: " Spa ", code: " spa ", quotaType: "dynamic", defaultQuota: 0,
    }).success).toBe(true);
    expect(CreateBusinessUnitInputSchema.safeParse({
      name: " ", code: "SPA", quotaType: "dynamic", defaultQuota: 0,
    }).success).toBe(false);
    expect(CreateBusinessUnitInputSchema.safeParse({
      name: "Spa", code: "SPA", quotaType: "dynamic", defaultQuota: -1,
    }).success).toBe(false);
    expect(BusinessUnitSchema.parse(activeUnit).version).toBe(1);
  });

  it("creates a normalized unit with priority derived from its quota type", () => {
    const created = createBusinessUnit(
      { name: " Spa & Club ", code: " spa ", quotaType: "contractual", defaultQuota: 8 },
      "fac-01",
      [],
      "bu-new-01",
    );

    expect(created).toMatchObject({
      id: "bu-new-01",
      facilityId: "fac-01",
      name: "Spa & Club",
      code: "SPA",
      quotaType: "contractual",
      priorityLevel: 2,
      defaultQuota: 8,
      isActive: true,
      version: 1,
    });
  });

  it("prevents reusing a code held by an inactive historical unit", () => {
    const retired = { ...activeUnit, isActive: false };

    expect(() => createBusinessUnit(
      { name: "Spa Nueva", code: "spa", quotaType: "dynamic", defaultQuota: 0 },
      "fac-01",
      [retired],
      "bu-new-02",
    )).toThrow(/código/i);
  });

  it("edits all fields, recalculates priority and increments the version", () => {
    const updated = updateBusinessUnit({
      current: activeUnit,
      updates: {
        name: "Club",
        code: "CLUB",
        quotaType: "guaranteed",
        defaultQuota: 12,
        version: 1,
      },
      businessUnits: [activeUnit],
    });

    expect(updated).toMatchObject({
      name: "Club",
      code: "CLUB",
      quotaType: "guaranteed",
      defaultQuota: 12,
      priorityLevel: 1,
      version: 2,
    });
  });

  it("rejects stale edits and duplicate codes without changing the current unit", () => {
    const other = { ...activeUnit, id: "bu-other-01", code: "GYM" };
    const updates = { name: "Spa", code: "GYM", quotaType: "dynamic" as const, defaultQuota: 0, version: 1 };

    expect(() => updateBusinessUnit({ current: activeUnit, updates, businessUnits: [activeUnit, other] })).toThrow(/código/i);
    expect(() => updateBusinessUnit({
      current: activeUnit,
      updates: { ...updates, code: "SPA", version: 2 },
      businessUnits: [activeUnit],
    })).toThrow(/versión/i);
    expect(activeUnit).toMatchObject({ name: "Spa", code: "SPA", version: 1 });
  });

  it("retires an unreferenced unit logically and increments the version", () => {
    const retired = deactivateBusinessUnit(activeUnit, 1, []);

    expect(retired).toMatchObject({ id: activeUnit.id, isActive: false, version: 2 });
    expect(activeUnit.isActive).toBe(true);
  });

  it("rejects stale, repeated and dependency-blocked retirement", () => {
    expect(() => deactivateBusinessUnit(activeUnit, 2, [])).toThrow(/versión/i);
    expect(() => deactivateBusinessUnit({ ...activeUnit, isActive: false }, 1, [])).toThrow(/inactiva/i);
    expect(() => deactivateBusinessUnit(activeUnit, 1, ["1 área exclusiva activa"])).toThrow(/área exclusiva/i);
  });
});
