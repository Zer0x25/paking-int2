import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { VehicleGatePanel } from "@client/components/VehicleGatePanel";

describe("VehicleGatePanel", () => {
  it("starts with the plate action and keeps the active vehicle list", () => {
    const markup = renderToStaticMarkup(
      <VehicleGatePanel
        facilityId="facility-1"
        businessUnits={[]}
        spaceCategories={[]}
        areas={[]}
        operatorUserId="operator-1"
      />
    );
    const operationCard = markup.match(
      /<section\b(?=[^>]*data-testid="vehicle-operation-card")[^>]*>([\s\S]*?)<\/section>/
    )?.[1];

    expect(markup.match(/data-testid="vehicle-operation-card"/g)).toHaveLength(1);
    expect(operationCard).toBeDefined();
    expect(operationCard).toContain("Patente");
    expect(operationCard).not.toContain("Entrada");
    expect(operationCard).not.toContain("Salida");
    expect(operationCard).not.toMatch(/<select\b/);
    const operationButtons = [...operationCard!.matchAll(/<button\b[\s\S]*?<\/button>/g)];
    expect(operationButtons).toHaveLength(1);
    expect(operationButtons[0][0]).toContain("Registrar");
    expect(markup).toContain("Vehículos activos");
  });
});
