// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { User } from "@core/types/schema";
import { App } from "@client/App";
import { LoginView } from "@client/components/LoginView";

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
  FacilityConfigView: ({ facility }: { facility: { name: string } }) => <div data-testid="facility-config">{facility.name}</div>,
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

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json" },
});

function installAppFetch() {
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === "/api/auth/login") return jsonResponse({ token: "signed-token", user: adminUser });
    if (url.endsWith("/catalogs")) return jsonResponse({
      facility: { id: "facility-admin", name: "Persisted facility", address: "", totalCapacity: 80,
        createdAt: "2026-10-17T12:00:00.000Z", updatedAt: "2026-10-17T12:00:00.000Z" },
      businessUnits: [], categories: [], areas: [], events: [],
    });
    if (url.endsWith("/dashboard")) return jsonResponse({ facilityId: "facility-admin", totalCapacity: 80 });
    return jsonResponse({});
  }));
}

function fillLoginForm() {
  fireEvent.change(screen.getByLabelText("Usuario"), { target: { value: "admin-local" } });
  fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "local-password" } });
}

beforeEach(() => {
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

    await waitFor(() => expect(onLoginSuccess).toHaveBeenCalledWith(adminUser, "signed-token"));
    expect(localStorage.getItem("auth_token")).toBe("signed-token");
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
  it("logs in, switches views, loads D1 data, and clears local identity on logout", async () => {
    render(<App />);
    fillLoginForm();
    fireEvent.click(screen.getByRole("button", { name: "Ingresar" }));

    expect((await screen.findByTestId("gate-panel")).textContent).toContain("facility-admin");
    expect(screen.getByRole("button", { name: /Configuración/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Dashboard/ }));
    await waitFor(() => expect(screen.getByTestId("operational-dashboard").textContent).toContain("80"));
    fireEvent.click(screen.getByRole("button", { name: /Configuración/ }));
    await waitFor(() => expect(screen.getByTestId("facility-config").textContent).toContain("Persisted facility"));

    fireEvent.click(screen.getByRole("button", { name: "Salir" }));
    expect(await screen.findByLabelText("Usuario")).toBeTruthy();
    expect(localStorage.getItem("auth_user")).toBeNull();
    expect(localStorage.getItem("auth_token")).toBeNull();
  });

  it("hides configuration from an operator while keeping gate and dashboard available", async () => {
    localStorage.setItem("auth_user", JSON.stringify(operatorUser));
    render(<App />);

    expect((await screen.findByTestId("gate-panel")).textContent).toContain("facility-admin");
    expect(screen.queryByRole("button", { name: /Configuración/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Dashboard/ }));
    expect(await screen.findByTestId("operational-dashboard")).toBeTruthy();
  });

  it("keeps the signed-in shell usable when catalog and dashboard requests fail", async () => {
    localStorage.setItem("auth_user", JSON.stringify(adminUser));
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    render(<App />);

    expect((await screen.findByTestId("gate-panel")).textContent).toContain("facility-admin");
    fireEvent.click(screen.getByRole("button", { name: /Dashboard/ }));
    await waitFor(() => expect(screen.getByTestId("operational-dashboard").textContent).toContain("empty"));
  });
});
