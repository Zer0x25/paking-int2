// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { User } from "@core/types/schema";
import { App } from "@client/App";
import { LoginView } from "@client/components/LoginView";
import { cacheCatalogData, getCachedCatalogData } from "@client/db/indexed-db";

vi.mock("@client/db/indexed-db", () => ({
  cacheCatalogData: vi.fn(async () => undefined),
  getCachedCatalogData: vi.fn(async () => null),
  getLocalAreas: vi.fn(async () => []),
  saveLocalArea: vi.fn(async () => undefined),
}));

vi.mock("@client/components/ThemeSelector", () => ({
  ThemeSelector: () => <button type="button" aria-label="Cambiar tema">Tema</button>,
}));
vi.mock("@client/components/SyncStatusBar", () => ({
  SyncStatusBar: () => <div data-testid="sync-status" />,
}));
vi.mock("@client/components/VehicleGatePanel", () => ({
  VehicleGatePanel: ({ facilityId }: { facilityId: string }) => <div data-testid="gate-panel">{facilityId}</div>,
}));
vi.mock("@client/components/OperationalDashboard", () => ({
  OperationalDashboard: ({ metrics, loading }: { metrics: { totalCapacity?: number } | null; loading: boolean }) => (
    <div data-testid="operational-dashboard">{loading ? "loading" : metrics?.totalCapacity ?? "empty"}</div>
  ),
}));
vi.mock("@client/components/FacilityConfigView", () => ({
  FacilityConfigView: ({ facility, onFacilityCreated }: {
    facility: { id: string; name: string } | null;
    onFacilityCreated?: (facility: { id: string; name: string; address: string; totalCapacity: number; createdAt: string; updatedAt: string }, token: string) => void;
  }) => facility
    ? <div data-testid="facility-config">{facility.name}</div>
    : <div data-testid="facility-setup">
      Crear recinto inicial
      <button type="button" onClick={() => onFacilityCreated?.({
        id: "new-facility", name: "New facility", address: "", totalCapacity: 80,
        createdAt: "2026-10-18T12:00:00.000Z", updatedAt: "2026-10-18T12:00:00.000Z",
      }, signedToken())}>Completar alta de prueba</button>
    </div>,
}));

const adminUser: User = {
  id: "local-admin",
  username: "admin-local",
  fullName: "Administrador local",
  role: "admin",
  facilityId: "facility-admin",
  createdAt: "2026-10-17T12:00:00.000Z",
};

const operatorUser: User = {
  ...adminUser,
  id: "local-operator",
  username: "operator-local",
  fullName: "Operador local",
  role: "operator",
};

const unassignedAdminUser: User = {
  ...adminUser,
  id: "local-admin-unassigned",
  facilityId: null,
};

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json" },
});

function installAppFetch() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === "/api/auth/login") return jsonResponse({ token: signedToken(), user: adminUser });
    if (url.endsWith("/catalogs")) return jsonResponse({
      facility: { id: "facility-admin", name: "Persisted facility", address: "", totalCapacity: 80,
        createdAt: "2026-10-17T12:00:00.000Z", updatedAt: "2026-10-17T12:00:00.000Z" },
      businessUnits: [], categories: [], areas: [], events: [],
    });
    if (url.endsWith("/dashboard")) return jsonResponse({
      facilityId: "facility-admin",
      totalCapacity: 80,
      totalOccupied: 1,
      totalAvailable: 79,
      occupancyPercentage: 1.25,
      alertLevel: "normal",
      units: [],
      areas: [],
      floatingBuffer: 0,
      timestamp: "2026-10-17T12:00:00.000Z",
    });
    return jsonResponse({});
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function signedToken(exp = Math.floor(Date.now() / 1000) + 3600): string {
  const payload = btoa(JSON.stringify({ exp })).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `header.${payload}.signature`;
}

function fillLoginForm() {
  fireEvent.change(screen.getByLabelText("Usuario"), { target: { value: "admin-local" } });
  fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "local-password" } });
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  installAppFetch();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("local login view", () => {
  it("shows blank local credentials and no demo sign-in shortcut", () => {
    const onLoginSuccess = vi.fn();
    render(<LoginView onLoginSuccess={onLoginSuccess} />);

    expect((screen.getByLabelText("Usuario") as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText("Contraseña") as HTMLInputElement).value).toBe("");
    expect(screen.queryByRole("button", { name: /admin|operador|demo/i })).toBeNull();
  });

  it("reports rejected credentials returned by the Worker", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: "Usuario o contraseña incorrectos" }, 401)));
    const onLoginSuccess = vi.fn();
    render(<LoginView onLoginSuccess={onLoginSuccess} />);
    fillLoginForm();
    fireEvent.click(screen.getByRole("button", { name: "Ingresar" }));

    expect((await screen.findByRole("alert")).textContent).toContain("Usuario o contraseña incorrectos");
    expect(onLoginSuccess).not.toHaveBeenCalled();
    expect(localStorage.getItem("auth_token")).toBeNull();
  });

  it("persists a successful local session and reports a connection failure", async () => {
    const onLoginSuccess = vi.fn();
    render(<LoginView onLoginSuccess={onLoginSuccess} />);
    fillLoginForm();
    fireEvent.click(screen.getByRole("button", { name: "Ingresar" }));

    await waitFor(() => expect(onLoginSuccess).toHaveBeenCalledWith(adminUser, expect.any(String)));
    expect(localStorage.getItem("auth_token")).toBeTruthy();
    expect(JSON.parse(localStorage.getItem("auth_user") ?? "null")).toEqual(adminUser);

    cleanup();
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    render(<LoginView onLoginSuccess={vi.fn()} />);
    fillLoginForm();
    fireEvent.click(screen.getByRole("button", { name: "Ingresar" }));
    expect((await screen.findByRole("alert")).textContent).toContain("No se pudo conectar al servidor de autenticación");
  });
});

describe("app authentication and role navigation", () => {
  it("does not read private data before login", async () => {
    const fetchMock = installAppFetch();
    render(<App />);
    expect(await screen.findByLabelText("Usuario")).toBeTruthy();
    expect(fetchMock.mock.calls.map(([input]) => String(input)).filter((path) => path.startsWith("/api/"))).toEqual([]);
  });

  it("routes an authenticated admin without a facility to initial setup and hides operations", async () => {
    localStorage.setItem("auth_user", JSON.stringify(unassignedAdminUser));
    localStorage.setItem("auth_token", signedToken());
    const fetchMock = installAppFetch();
    render(<App />);

    expect(await screen.findByTestId("facility-setup")).toBeTruthy();
    expect(screen.queryByTestId("gate-panel")).toBeNull();
    expect(screen.queryByRole("button", { name: /Dashboard/ })).toBeNull();
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes("/catalogs"))).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Completar alta de prueba" }));
    expect(await screen.findByTestId("gate-panel")).toBeTruthy();
    expect(JSON.parse(localStorage.getItem("auth_user") ?? "null").facilityId).toBe("new-facility");
    expect(localStorage.getItem("auth_token")).toBeTruthy();
  });

  it("loads only each active view, does not poll, and clears identity on logout", async () => {
    const fetchMock = installAppFetch();
    render(<App />);
    fillLoginForm();
    fireEvent.click(screen.getByRole("button", { name: "Ingresar" }));

    expect((await screen.findByTestId("gate-panel")).textContent).toContain("facility-admin");
    expect(screen.getByRole("button", { name: /Configuración/ })).toBeTruthy();
    await waitFor(() => expect(fetchMock.mock.calls.some(([input]) => String(input).endsWith("/catalogs"))).toBe(true));
    await waitFor(() => expect(cacheCatalogData).toHaveBeenCalledWith("catalogs:facility-admin", expect.any(Object)));
    expect(fetchMock.mock.calls.some(([input]) => String(input).endsWith("/dashboard"))).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: /Dashboard/ }));
    await waitFor(() => expect(screen.getByTestId("operational-dashboard").textContent).toContain("80"));
    expect(fetchMock.mock.calls.some(([input]) => String(input).endsWith("/dashboard"))).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /Configuración/ }));
    await waitFor(() => expect(screen.getByTestId("facility-config").textContent).toContain("Persisted facility"));
    expect(fetchMock.mock.calls.filter(([input]) => String(input).endsWith("/catalogs"))).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Salir" }));
    expect(await screen.findByLabelText("Usuario")).toBeTruthy();
    expect(localStorage.getItem("auth_user")).toBeNull();
    expect(localStorage.getItem("auth_token")).toBeNull();
  });

  it("hides configuration from an operator while keeping gate and dashboard available", async () => {
    localStorage.setItem("auth_user", JSON.stringify(operatorUser));
    localStorage.setItem("auth_token", signedToken());
    render(<App />);

    expect((await screen.findByTestId("gate-panel")).textContent).toContain("facility-admin");
    expect(screen.queryByRole("button", { name: /Configuración/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Dashboard/ }));
    expect(await screen.findByTestId("operational-dashboard")).toBeTruthy();
  });

  it("keeps the signed-in shell usable when catalog and dashboard requests fail", async () => {
    localStorage.setItem("auth_user", JSON.stringify(adminUser));
    localStorage.setItem("auth_token", signedToken());
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    render(<App />);

    expect((await screen.findByTestId("gate-panel")).textContent).toContain("facility-admin");
    fireEvent.click(screen.getByRole("button", { name: /Dashboard/ }));
    await waitFor(() => expect(screen.getByTestId("operational-dashboard").textContent).toContain("empty"));
  });

  it("returns to login and clears private state after an authenticated request returns 401", async () => {
    localStorage.setItem("auth_user", JSON.stringify(adminUser));
    localStorage.setItem("auth_token", signedToken());
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: "Token inválido o expirado" }, 401)));
    render(<App />);

    expect(await screen.findByLabelText("Usuario")).toBeTruthy();
    expect(localStorage.getItem("auth_user")).toBeNull();
    expect(localStorage.getItem("auth_token")).toBeNull();
  });

  it("loads offline catalog snapshots only from the authenticated facility key", async () => {
    localStorage.setItem("auth_user", JSON.stringify(adminUser));
    localStorage.setItem("auth_token", signedToken());
    vi.mocked(getCachedCatalogData).mockResolvedValue({
      facility: { id: "facility-admin", name: "Offline facility", address: "", totalCapacity: 80,
        createdAt: "2026-10-17T12:00:00.000Z", updatedAt: "2026-10-17T12:00:00.000Z" },
      businessUnits: [], categories: [], areas: [], events: [],
    });
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    render(<App />);

    expect(await screen.findByText("Offline facility")).toBeTruthy();
    expect(getCachedCatalogData).toHaveBeenCalledWith("catalogs:facility-admin");
  });

  it("does not load private snapshots with an expired session", async () => {
    localStorage.setItem("auth_user", JSON.stringify(adminUser));
    localStorage.setItem("auth_token", signedToken(Math.floor(Date.now() / 1000) - 1));
    const fetchMock = installAppFetch();
    render(<App />);

    expect(await screen.findByLabelText("Usuario")).toBeTruthy();
    expect(fetchMock.mock.calls.filter(([input]) => String(input).startsWith("/api/"))).toHaveLength(0);
    expect(getCachedCatalogData).not.toHaveBeenCalled();
  });
});
