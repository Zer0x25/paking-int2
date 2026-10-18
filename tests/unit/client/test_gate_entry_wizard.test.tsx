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
    standardCapacity: 40,
    accessibleCapacity: 0,
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
    allocatedCapacity: 5,
    standardCapacity: 0,
    accessibleCapacity: 5,
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
let activeSessionsResponse: Promise<Response> | null = null;
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

const renderGate = async ({ waitForSessions = true }: { waitForSessions?: boolean } = {}) => {
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
  if (waitForSessions) await waitFor(() => expect(screen.queryByText(/cargando vehículos activos/i)).toBeNull());
  return view;
};

const enterPlate = (plate: string) => {
  fireEvent.change(screen.getByRole("combobox", { name: /patente/i }), {
    target: { value: plate },
  });
};

const continueEntry = () => fireEvent.click(screen.getByRole("button", { name: /^registrar entrada$/i }));

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
  activeSessionsResponse = null;
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
        if (activeSessionsResponse) return activeSessionsResponse;
        const sessions = activeSessions.filter((session) => session.status === "active");
        return jsonResponse({ sessions, count: sessions.length });
      }
      if (writeFailure) return writeFailure();

      const payload = body ? (JSON.parse(body) as Record<string, unknown>) : {};
      const sessionExitMatch = url.pathname.match(/\/parking-sessions\/([^/]+)\/exit$/);
      if (sessionExitMatch) {
        const session = activeSessions.find((candidate) => candidate.id === decodeURIComponent(sessionExitMatch[1]));
        if (!session) return jsonResponse({ message: "No hay una sesión activa" }, 404);
        const completed: GateSession = {
          ...session,
          status: "completed",
          exitTime: "2026-10-17T10:15:00.000Z",
          durationMinutes: 15,
          version: session.version + 1,
        };
        activeSessions = activeSessions.map((candidate) => candidate.id === session.id ? completed : candidate);
        return jsonResponse({ session: completed });
      }
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

describe("flujo inteligente de garita", () => {
  it("starts with only the plate field and no generic movement selector", async () => {
    await renderGate();

    expect(screen.getByRole("combobox", { name: /patente/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^registrar$/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^entrada$/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^salida$/i })).toBeNull();
    expect(screen.queryByLabelText(/unidad|tipo de espacio|área|sector/i)).toBeNull();
  });

  it("keeps an incomplete plate on the first step without enabling a movement", async () => {
    await renderGate();

    enterPlate("ABC");

    expect(screen.getByRole("combobox", { name: /patente/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^registrar entrada$/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^registrar salida$/i })).toBeNull();
  });

  it("shows only Registrar entrada for a complete valid plate without an active session", async () => {
    await renderGate();

    enterPlate("AA1A11");

    expect(screen.getByRole("button", { name: /^registrar entrada$/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^registrar salida$/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^entrada$/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^salida$/i })).toBeNull();
  });

  it("shows the active session exit and records it only after explicit confirmation", async () => {
    activeSessions = [makeSession({ licensePlate: "AA1A11" })];
    await renderGate();
    enterPlate("aa-1a-11");

    expect(screen.getByRole("button", { name: /^registrar salida$/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^registrar entrada$/i })).toBeNull();
    expect(screen.getByText(/vehículo dentro del recinto/i)).toBeTruthy();
    expect((screen.getByRole("combobox", { name: /patente/i }) as HTMLInputElement).value).toBe("AA-1A-11");
    expect(activeSessions[0].status).toBe("active");

    fireEvent.click(screen.getByRole("button", { name: /^registrar salida$/i }));

    await waitFor(() => {
      expect(fetchCalls.some((call) => call.method === "POST" && call.url.endsWith("/gate-session-1/exit"))).toBe(true);
      expect(screen.queryByRole("button", { name: /^registrar entrada$/i })).toBeNull();
      expect((screen.getByRole("combobox", { name: /patente/i }) as HTMLInputElement).value).toBe("");
    });
    expect(activeSessions[0].status).toBe("completed");
  });

  it("does not show a movement decision until the initial active-session list is loaded", async () => {
    let resolveSessions!: (response: Response) => void;
    activeSessionsResponse = new Promise<Response>((resolve) => { resolveSessions = resolve; });
    await renderGate({ waitForSessions: false });
    enterPlate("AA1A11");

    expect(screen.getByText(/consultando vehículos activos/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^registrar entrada$/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^registrar salida$/i })).toBeNull();

    await act(async () => resolveSessions(jsonResponse({ sessions: [], count: 0 })));
    expect(await screen.findByRole("button", { name: /^registrar entrada$/i })).toBeTruthy();
  });

  it("shows at most five current-facility active sessions for a normalized prefix without querying per key", async () => {
    activeSessions = [
      makeSession({ licensePlate: "AA1A11" }),
      makeSession({ licensePlate: "AA2A11" }),
      makeSession({ licensePlate: "AA3A11" }),
      makeSession({ licensePlate: "AA4A11" }),
      makeSession({ licensePlate: "AA5A11" }),
      makeSession({ licensePlate: "AA6A11" }),
      makeSession({ licensePlate: "AA7A11", facilityId: "facility-other" }),
      makeSession({ licensePlate: "AA8A11", status: "completed" }),
    ];
    await renderGate();
    const requestsBeforeTyping = fetchCalls.length;
    const input = screen.getByRole("combobox", { name: /patente/i });

    fireEvent.change(input, { target: { value: "a" } });
    fireEvent.change(input, { target: { value: "aa" } });

    expect(screen.getAllByRole("option")).toHaveLength(5);
    expect(screen.getByRole("option", { name: /AA-1A-11.*Hotel.*Estándar.*flotante/i })).toBeTruthy();
    expect(screen.queryByRole("option", { name: /AA-7A-11/i })).toBeNull();
    expect(screen.queryByRole("option", { name: /AA-8A-11/i })).toBeNull();
    expect(fetchCalls).toHaveLength(requestsBeforeTyping);
  });

  it("lets the operator select suggestions with keyboard and requires an explicit exit action", async () => {
    activeSessions = [makeSession({ licensePlate: "AA1A11", parkingAreaId: "area-basement" })];
    await renderGate();
    const input = screen.getByRole("combobox", { name: /patente/i });
    fireEvent.change(input, { target: { value: "AA" } });

    expect(screen.getByRole("listbox", { name: /vehículos activos/i })).toBeTruthy();
    expect(screen.getByRole("option", { name: /AA-1A-11.*Hotel.*Estándar.*Subsuelo/i })).toBeTruthy();
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect((input as HTMLInputElement).getAttribute("aria-activedescendant")).toBeTruthy();
    fireEvent.keyDown(input, { key: "Enter" });

    expect((input as HTMLInputElement).value).toBe("AA-1A-11");
    expect(screen.getByRole("button", { name: /^registrar salida$/i })).toBeTruthy();
    expect(activeSessions[0].status).toBe("active");
    expect(fetchCalls.some((call) => call.method === "POST")).toBe(false);
  });

  it("closes the suggestions with Escape and still allows an unmatched entry", async () => {
    activeSessions = [makeSession({ licensePlate: "AA1A11" })];
    await renderGate();
    const input = screen.getByRole("combobox", { name: /patente/i });
    fireEvent.change(input, { target: { value: "AA" } });
    expect(screen.getByRole("listbox")).toBeTruthy();

    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
    fireEvent.change(input, { target: { value: "BB2B22" } });
    expect(screen.getByRole("button", { name: /^registrar entrada$/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^registrar salida$/i })).toBeNull();
  });

  it("waits for explicit confirmation and submits the selected entry destination", async () => {
    await renderGate();
    enterPlate("AA1A11");
    continueEntry();

    expect(screen.getByRole("button", { name: /confirmar entrada/i })).toBeTruthy();
    expect(hasRequestValue("unit-events")).toBe(false);
    selectEntryDestination();
    expect(screen.getByText(/Disponibles en el área: 5 Accesibles/i)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /confirmar entrada/i }));

    await waitFor(() => {
      expect(hasRequestValue("unit-events")).toBe(true);
      expect(hasRequestValue("space-accessible")).toBe(true);
      expect(hasRequestValue("area-terrace")).toBe(true);
      expect(hasRequestValue("AA-1A-11") || hasRequestValue("AA1A11")).toBe(true);
    });
  });

  it("offers an alternative area with Accessible capacity and lets the operator select it", async () => {
    await renderGate();
    enterPlate("AA1A11");
    continueEntry();
    fireEvent.change(screen.getByLabelText(/unidad/i), { target: { value: "unit-events" } });
    fireEvent.change(screen.getByLabelText(/tipo de espacio/i), { target: { value: "space-accessible" } });
    fireEvent.change(screen.getByLabelText(/área|sector/i), { target: { value: "area-basement" } });
    writeFailure = () => {
      writeFailure = null;
      return jsonResponse({ error: "El área no tiene plazas Accesibles disponibles.", suggestedParkingAreaId: "area-terrace" }, 409);
    };

    fireEvent.click(screen.getByRole("button", { name: /confirmar entrada/i }));
    fireEvent.click(await screen.findByRole("button", { name: /usar área Terraza/i }));

    expect((screen.getByLabelText(/área|sector/i) as HTMLSelectElement).value).toBe("area-terrace");
    fireEvent.click(screen.getByRole("button", { name: /confirmar entrada/i }));
    await waitFor(() => expect(hasRequestValue("area-terrace")).toBe(true));
  });

  it("requires explicit confirmation before using Standard after Accessible capacity is exhausted", async () => {
    await renderGate();
    enterPlate("AA1A11");
    continueEntry();
    selectEntryDestination();
    writeFailure = () => {
      writeFailure = null;
      return jsonResponse({
        error: "La capacidad Accesible está agotada en el recinto; puede elegir una plaza Estándar disponible.",
        allowStandardFallback: true,
      }, 409);
    };

    fireEvent.click(screen.getByRole("button", { name: /confirmar entrada/i }));
    fireEvent.click(await screen.findByRole("button", { name: /usar una plaza estándar/i }));
    expect(screen.getByRole("alert").textContent).toMatch(/plaza Estándar/i);
    fireEvent.click(screen.getByRole("button", { name: /confirmar entrada estándar/i }));

    await waitFor(() => expect(activeSessions).toHaveLength(1));
    expect(activeSessions[0].spaceCategoryId).toBe("space-standard");
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
    continueEntry();
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
    continueEntry();
    selectEntryDestination();

    fireEvent.click(screen.getByRole("button", { name: /confirmar entrada/i }));

    await waitFor(() => {
      const plateInput = screen.getByRole("combobox", { name: /patente/i }) as HTMLInputElement;
      expect(plateInput.value).toBe("");
      expect(screen.queryByRole("button", { name: /^registrar entrada$/i })).toBeNull();
      expect(screen.queryByRole("button", { name: /^registrar salida$/i })).toBeNull();
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
    continueEntry();
    selectEntryDestination();

    fireEvent.click(screen.getByRole("button", { name: /confirmar entrada/i }));

    await waitFor(() => expect(screen.getByText(/paso 1 de 2/i)).toBeTruthy());
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
    continueEntry();
    selectEntryDestination();

    fireEvent.click(screen.getByRole("button", { name: /^volver$/i }));
    const plateInput = screen.getByRole("combobox", { name: /patente/i }) as HTMLInputElement;
    expect(plateInput.value.replace(/-/g, "")).toBe("AA1A11");

    fireEvent.change(plateInput, { target: { value: "BB2B22" } });
    continueEntry();

    expect((screen.getByLabelText(/unidad/i) as HTMLSelectElement).value).toBe("unit-events");
    expect((screen.getByLabelText(/tipo de espacio/i) as HTMLSelectElement).value).toBe("space-accessible");
    expect((screen.getByLabelText(/área|sector/i) as HTMLSelectElement).value).toBe("area-terrace");
    expect(screen.getByText("BB-2B-22")).toBeTruthy();
  });

  it("retains the entry step and chosen values after a registration failure", async () => {
    await renderGate();
    enterPlate("AA1A11");
    continueEntry();
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
