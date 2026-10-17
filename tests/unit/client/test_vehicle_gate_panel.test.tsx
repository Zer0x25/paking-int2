import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { VehicleGatePanel } from "@client/components/VehicleGatePanel";

describe("VehicleGatePanel", () => {
  it("renders a single operation card with entry and exit modes and the active list", () => {
    const markup = renderToStaticMarkup(
      <VehicleGatePanel
        facilityId="facility-1"
        businessUnits={[]}
        spaceCategories={[]}
        areas={[]}
        operatorUserId="operator-1"
      />
    );
    expect(markup.match(/data-testid="vehicle-operation-card"/g)).toHaveLength(1);
    expect(markup).toContain("Entrada");
    expect(markup).toContain("Salida");
    expect(markup).toContain("Vehículos activos");
    expect(markup).toContain('role="group" aria-label="Tipo de operación"');
    expect(markup).toContain('aria-pressed="true"');
    expect(markup).toContain('aria-pressed="false"');
    expect(markup).not.toContain('role="tablist"');
  });
});
