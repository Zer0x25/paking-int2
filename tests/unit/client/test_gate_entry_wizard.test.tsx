// @vitest-environment jsdom
import React from "react";
import "fake-indexeddb/auto";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BusinessUnit, SpaceCategory } from "@core/types/schema";
import { VehicleGatePanel } from "@client/components/VehicleGatePanel";
import { getActiveSessions, getPendingOutboxMutations } from "@client/db/indexed-db";

const businessUnits: BusinessUnit[] = [
  {
    id: "unit-hotel",
    facilityId: "facility-1",
    name: "Hotel",
    code: "HOTEL",
    priorityLevel: 1,
    quotaType: "guaranteed",
    defaultQuota: 20,
    isActive: true,
    version: 1,
  },
  {
    id: "unit-events",
    facilityId: "facility-1",
    name: "Eventos",
    code: "EVENTOS",
    priorityLevel: 2,
    quotaType: "contractual",
    defaultQuota: 0,
    isActive: true,
    version: 1,
  },
];

const spaceCategories: SpaceCategory[] = [
  { id: "space-standard", facilityId: "facility-1", name: "Estándar", code: "STD", allocatedSlots: 40 },
  { id: "space-accessible", facilityId: "facility-1", name: "Accesible", code: "ACC", allocatedSlots: 5 },
];

const areas = [
  {
    id: "area-basement",
    facilityId: "facility-1",
    name: "Subsuelo",
    code: "SUB",
    description: "Nivel -1",
    allocatedCapacity: 40,
    businessUnitId: null,
    isActive: true,
    version: 1,
    createdAt: "2026-10-17T00:00:00.000Z",
    updatedAt: "2026-10-17T00:00:00.000Z",
  },
  {
    id: "area-terrace",
    facilityId: "facility-1",
    name: "Terraza",
    code: "TER",
    description: "Nivel 2",
    allocatedCapacity: 20,
    businessUnitId: null,
    isActive: true,
    version: 1,
    createdAt: "2026-10-17T00:00:00.000Z",
    updatedAt: "2026-10-17T00:00:00.000Z",
  },
];

type RecordedFetch = {
  url: string;
  method: string;
  body: string;
};

type GateSession = {
  id: string;
  facilityId: string;
  businessUnitId: string;
  spaceCategoryId: string;
  parkingAreaId: string | null;
  licensePlate: string;
  entryTime: string;
  exitTime: string | null;
  status: "active" | "completed";
  durationMinutes: number | null;
  operatorUserId: string;
  deviceId: string;
  version: number;
};

let fetchCalls: RecordedFetch[] = [];
let activeSessions: GateSession[] = [];
let writeFailure: (() => Response) | null = null;
let nextSessionId = 1;

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const makeSession = (overrides: Partial<GateSession> = {}): GateSession => ({
  id: `gate-session-${nextSessionId++}`,
  facilityId: "facility-1",
  businessUnitId: "unit-hotel",
  spaceCategoryId: "space-standard",
  parkingAreaId: null,
  licensePlate: "AA1A11",
  entryTime: "2026-10-17T10:00:00.000Z",
  exitTime: null,
  status: "active",
  durationMinutes: null,
  operatorUserId: "operator-1",
  deviceId: "gate-1",
  version: 1,
  ...overrides,
});

const normalizePlate = (plate: string) => plate.replace(/-/g, "").toUpperCase();

const renderGate = async () => {
  let view!: ReturnType<typeof render>;
  await act(async () => {
    view = render(
      <VehicleGatePanel
        facilityId="facility-1"
        businessUnits={businessUnits}
        spaceCategories={spaceCategories}
        areas={areas}
        operatorUserId="operator-1"
      />
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return view;
};

const enterPlate = (plate: string) => {
  fireEvent.change(screen.getByRole("textbox", { name: /patente/i }), {
    target: { value: plate },
  });
  fireEvent.click(screen.getByRole("button", { name: /^registrar$/i }));
};

const selectEntryDestination = () => {
  fireEvent.change(screen.getByLabelText(/unidad/i), {
    target: { value: "unit-events" },
  });
  fireEvent.change(screen.getByLabelText(/tipo de espacio/i), {
    target: { value: "space-accessible" },
  });
  fireEvent.change(screen.getByLabelText(/área|sector/i), {
    target: { value: "area-terrace" },
  });
};

const hasRequestValue = (value: string) =>
  fetchCalls.some(({ url, body }) => `${url} ${body}`.includes(value));

beforeEach(() => {
  fetchCalls = [];
  activeSessions = [];
  writeFailure = null;
  nextSessionId = 1;
  localStorage.setItem("auth_token", "test-auth-token");
  vi.stubGlobal(
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : undefined;
      const method = (init?.method ?? request?.method ?? "GET").toUpperCase();
      const requestBody = init?.body ?? (request ? await request.clone().text() : "");
      const body = typeof requestBody === "string" ? requestBody : String(requestBody ?? "");
      const requestUrl = request?.url ?? String(input);
      const url = new URL(requestUrl, "http://localhost");
      fetchCalls.push({
        url: requestUrl,
        method,
        body,
      });

      if (method === "GET") {
        const sessions = activeSessions.filter((session) => session.status === "active");
        return jsonResponse({ sessions, count: sessions.length });
      }
      if (writeFailure) return writeFailure();

      const payload = body ? (JSON.parse(body) as Record<string, unknown>) : {};
      if (url.pathname.endsWith("/parking-sessions/entry")) {
        const session = makeSession({
          businessUnitId: String(payload.businessUnitId ?? "unit-hotel"),
          spaceCategoryId: String(payload.spaceCategoryId ?? "space-standard"),
          parkingAreaId: payload.parkingAreaId ? String(payload.parkingAreaId) : null,
          licensePlate: normalizePlate(String(payload.licensePlate ?? "AA1A11")),
          entryTime: String(payload.entryTime ?? "2026-10-17T10:00:00.000Z"),
        });
        activeSessions = [...activeSessions, session];
        return jsonResponse(
          {
            session,
            ticket: {
              ticketNumber: `TCK-${session.id}`,
              licensePlate: session.licensePlate,
              entryTime: session.entryTime,
            },
          },
          201
        );
      }
      if (url.pathname.endsWith("/parking-sessions/exit")) {
        const plate = String(payload.licensePlate ?? "");
        const session = activeSessions.find(
          (candidate) => candidate.id === payload.sessionId || normalizePlate(candidate.licensePlate) === normalizePlate(plate)
        );
        if (!session) return jsonResponse({ message: "No hay una sesión activa" }, 404);

        const completed: GateSession = {
          ...session,
          status: "completed",
          exitTime: String(payload.exitTime ?? "2026-10-17T10:15:00.000Z"),
          durationMinutes: 15,
          version: session.version + 1,
        };
        activeSessions = activeSessions.map((candidate) => candidate.id === session.id ? completed : candidate);
        return jsonResponse({ session: completed });
      }
      return jsonResponse({});
    }
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("flujo guiado de garita", () => {
  it("starts with only the plate field and Registrar as the operation action", async () => {
    await renderGate();

    expect(screen.getByRole("textbox", { name: /patente/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^registrar$/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^entrada$/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^salida$/i })).toBeNull();
    expect(screen.queryByLabelText(/unidad|tipo de espacio|área|sector/i)).toBeNull();
  });

  it("keeps an invalid plate on the first step and announces the format error", async () => {
    await renderGate();

    enterPlate("ABC");

    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByRole("textbox", { name: /patente/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^registrar$/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^entrada$/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^salida$/i })).toBeNull();
  });

  it("reveals Entrada and Salida after registering a valid plate", async () => {
    await renderGate();

    enterPlate("AA1A11");

    expect(screen.getByRole("button", { name: /^entrada$/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^salida$/i })).toBeTruthy();
    expect(screen.getByText("AA-1A-11")).toBeTruthy();
  });

  it("uses the retained plate when the operator chooses Salida", async () => {
    activeSessions = [makeSession({ licensePlate: "AA1A11" })];
    await renderGate();
    enterPlate("AA1A11");

    fireEvent.click(screen.getByRole("button", { name: /^salida$/i }));

    await waitFor(() => {
      expect(hasRequestValue("AA-1A-11") || hasRequestValue("AA1A11")).toBe(true);
      expect(screen.queryByRole("button", { name: /^entrada$/i })).toBeNull();
      expect((screen.getByRole("textbox", { name: /patente/i }) as HTMLInputElement).value).toBe("");
    });
    expect(activeSessions[0].status).toBe("completed");
  });

  it("waits for explicit confirmation and submits the selected entry destination", async () => {
    await renderGate();
    enterPlate("AA1A11");
    fireEvent.click(screen.getByRole("button", { name: /^entrada$/i }));

    expect(screen.getByRole("button", { name: /confirmar entrada/i })).toBeTruthy();
    expect(hasRequestValue("unit-events")).toBe(false);
    selectEntryDestination();

    fireEvent.click(screen.getByRole("button", { name: /confirmar entrada/i }));

    await waitFor(() => {
      expect(hasRequestValue("unit-events")).toBe(true);
      expect(hasRequestValue("space-accessible")).toBe(true);
      expect(hasRequestValue("area-terrace")).toBe(true);
      expect(hasRequestValue("AA-1A-11") || hasRequestValue("AA1A11")).toBe(true);
    });
  });

  it("registers entry in browsers with getRandomValues but without randomUUID", async () => {
    const getRandomValues = vi.fn((bytes: Uint8Array) => {
      bytes.forEach((_, index) => {
        bytes[index] = index;
      });
      return bytes;
    });
    vi.stubGlobal("crypto", { getRandomValues } as unknown as Crypto);

    await renderGate();
    enterPlate("AA1A11");
    fireEvent.click(screen.getByRole("button", { name: /^entrada$/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirmar entrada/i }));

    await waitFor(() => {
      const request = fetchCalls.find((call) => call.url.includes("/parking-sessions/entry"));
      expect(request).toBeDefined();
      const payload = JSON.parse(request!.body) as { id: string };
      expect(payload.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });
    expect(getRandomValues).toHaveBeenCalledOnce();
  });

  it("returns to the plate step after a successful confirmed entry", async () => {
    await renderGate();
    enterPlate("AA1A11");
    fireEvent.click(screen.getByRole("button", { name: /^entrada$/i }));
    selectEntryDestination();

    fireEvent.click(screen.getByRole("button", { name: /confirmar entrada/i }));

    await waitFor(() => {
      const plateInput = screen.getByRole("textbox", { name: /patente/i }) as HTMLInputElement;
      expect(plateInput.value).toBe("");
      expect(screen.getByRole("button", { name: /^registrar$/i })).toBeTruthy();
      expect(screen.queryByRole("button", { name: /^entrada$/i })).toBeNull();
      expect(screen.queryByRole("button", { name: /^salida$/i })).toBeNull();
    });
    expect(activeSessions).toHaveLength(1);
    expect(activeSessions[0]).toMatchObject({
      businessUnitId: "unit-events",
      spaceCategoryId: "space-accessible",
      parkingAreaId: "area-terrace",
      licensePlate: "AA1A11",
      status: "active",
    });
  });

  it("queues a confirmed entry offline and resets the wizard after saving locally", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    await renderGate();
    enterPlate("ZX9Z88");
    fireEvent.click(screen.getByRole("button", { name: /^entrada$/i }));
    selectEntryDestination();

    fireEvent.click(screen.getByRole("button", { name: /confirmar entrada/i }));

    await waitFor(() => expect(screen.getByText(/paso 1 de 3 · patente/i)).toBeTruthy());
    expect(screen.queryByRole("alert")).toBeNull();
    const savedSession = (await getActiveSessions("facility-1")).find((session) => session.licensePlate === "ZX9Z88");
    const queuedEntry = (await getPendingOutboxMutations()).find(
      (mutation) => mutation.type === "VEHICLE_ENTRY" && mutation.payload.licensePlate === "ZX9Z88"
    );
    expect(savedSession).toMatchObject({
      businessUnitId: "unit-events",
      spaceCategoryId: "space-accessible",
      parkingAreaId: "area-terrace",
      licensePlate: "ZX9Z88",
      status: "active",
    });
    expect(queuedEntry?.payload).toMatchObject({
      businessUnitId: "unit-events",
      spaceCategoryId: "space-accessible",
      parkingAreaId: "area-terrace",
      licensePlate: "ZX9Z88",
    });
    expect(screen.getByText(/INGRESO GUARDADO OFFLINE/i)).toBeTruthy();
  });

  it("preserves the plate and chosen destination when moving back and correcting the plate", async () => {
    await renderGate();
    enterPlate("AA1A11");
    fireEvent.click(screen.getByRole("button", { name: /^entrada$/i }));
    selectEntryDestination();

    fireEvent.click(screen.getByRole("button", { name: /^volver$/i }));
    expect(screen.getByText("AA-1A-11")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /volver a corregir patente/i }));

    const plateInput = screen.getByRole("textbox", { name: /patente/i }) as HTMLInputElement;
    expect(plateInput.value.replace(/-/g, "")).toBe("AA1A11");

    fireEvent.change(plateInput, { target: { value: "BB2B22" } });
    fireEvent.click(screen.getByRole("button", { name: /^registrar$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^entrada$/i }));

    expect((screen.getByLabelText(/unidad/i) as HTMLSelectElement).value).toBe("unit-events");
    expect((screen.getByLabelText(/tipo de espacio/i) as HTMLSelectElement).value).toBe("space-accessible");
    expect((screen.getByLabelText(/área|sector/i) as HTMLSelectElement).value).toBe("area-terrace");
    expect(screen.getByText("BB-2B-22")).toBeTruthy();
  });

  it("retains the entry step and chosen values after a registration failure", async () => {
    await renderGate();
    enterPlate("AA1A11");
    fireEvent.click(screen.getByRole("button", { name: /^entrada$/i }));
    selectEntryDestination();
    writeFailure = () => jsonResponse({ message: "No se pudo registrar" }, 503);

    fireEvent.click(screen.getByRole("button", { name: /confirmar entrada/i }));

    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/no se pudo registrar/i));
    expect(screen.getByRole("button", { name: /confirmar entrada/i })).toBeTruthy();
    expect(screen.getByText("AA-1A-11")).toBeTruthy();
    expect((screen.getByLabelText(/unidad/i) as HTMLSelectElement).value).toBe("unit-events");
    expect((screen.getByLabelText(/tipo de espacio/i) as HTMLSelectElement).value).toBe("space-accessible");
    expect((screen.getByLabelText(/área|sector/i) as HTMLSelectElement).value).toBe("area-terrace");
  });
});
