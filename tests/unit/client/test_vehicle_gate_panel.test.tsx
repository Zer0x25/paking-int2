// @vitest-environment jsdom
import React from "react";
import { act, cleanup, render } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VehicleGatePanel } from "@client/components/VehicleGatePanel";

vi.mock("@client/db/indexed-db", () => ({
  enqueueOutboxMutation: vi.fn(),
  deleteLocalSession: vi.fn(),
  getActiveSessions: vi.fn(async () => []),
  getLocalSessionByPlate: vi.fn(async () => undefined),
  getPendingOutboxMutations: vi.fn(async () => []),
  saveLocalSession: vi.fn(),
}));

beforeEach(() => {
  localStorage.setItem("auth_token", "session-token");
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ sessions: [] }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })));
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

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

  it("loads active sessions on activation without starting a polling timer", async () => {
    const intervalSpy = vi.spyOn(window, "setInterval");
    const fetchMock = vi.mocked(fetch);
    render(
      <VehicleGatePanel
        facilityId="facility-1"
        businessUnits={[]}
        spaceCategories={[]}
        areas={[]}
        operatorUserId="operator-1"
      />,
    );

    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(intervalSpy).not.toHaveBeenCalled();
  });
});
