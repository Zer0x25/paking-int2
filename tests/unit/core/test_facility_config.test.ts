import { describe, it, expect } from "vitest";
import { FacilitySchema, BusinessUnitSchema, SpaceCategorySchema } from "@core/types/schema";

describe("User Story 4: Facility & Business Unit Configuration Validation (TDD)", () => {
  it("should validate a valid facility configuration", () => {
    const validFacility = {
      id: "123e4567-e89b-12d3-a456-426614174000",
      name: "Centro de Convenciones Santiago",
      address: "Av. Kennedy 5000",
      totalCapacity: 350,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const parsed = FacilitySchema.safeParse(validFacility);
    expect(parsed.success).toBe(true);
  });

  it("should reject facility with negative or zero capacity", () => {
    const invalidFacility = {
      id: "123e4567-e89b-12d3-a456-426614174000",
      name: "Parqueadero Cero",
      totalCapacity: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const parsed = FacilitySchema.safeParse(invalidFacility);
    expect(parsed.success).toBe(false);
  });

  it("should validate a custom business unit with priorities", () => {
    const validUnit = {
      id: "223e4567-e89b-12d3-a456-426614174000",
      facilityId: "123e4567-e89b-12d3-a456-426614174000",
      name: "Spa & Wellness",
      code: "SPA",
      priorityLevel: 3,
      quotaType: "dynamic" as const,
      defaultQuota: 10,
      isActive: true,
    };

    const parsed = BusinessUnitSchema.safeParse(validUnit);
    expect(parsed.success).toBe(true);
  });
});
