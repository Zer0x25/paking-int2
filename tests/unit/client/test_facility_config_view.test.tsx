// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Facility, SpaceCategory } from "@core/types/schema";
import { FacilityConfigView } from "@client/components/FacilityConfigView";
import { apiFetch } from "@client/api/client";

vi.mock("@client/components/BusinessUnitManager", () => ({ BusinessUnitManager: () => null }));
vi.mock("@client/components/EventBookingsManager", () => ({ EventBookingsManager: () => null }));
vi.mock("@client/api/client", () => ({ apiFetch: vi.fn() }));

const facility: Facility = {
  id: "facility-1",
  name: "Recinto de prueba",
  address: "Calle 1",
  totalCapacity: 80,
  createdAt: "2026-10-18T12:00:00.000Z",
  updatedAt: "2026-10-18T12:00:00.000Z",
};

const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json" },
});

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("FacilityConfigView facility lifecycle", () => {
  it("creates the first facility and returns the updated session", async () => {
    vi.mocked(apiFetch).mockResolvedValue(response({ facility, token: "assigned-token" }));
    const onFacilityCreated = vi.fn();
    render(<FacilityConfigView facility={null} businessUnits={[]} events={[]} onFacilityCreated={onFacilityCreated} />);

    fireEvent.change(screen.getByLabelText("Nombre del recinto"), { target: { value: "Recinto de prueba" } });
    fireEvent.change(screen.getByLabelText("Dirección"), { target: { value: "Calle 1" } });
    fireEvent.change(screen.getByLabelText("Capacidad total"), { target: { value: "80" } });
    fireEvent.change(screen.getByLabelText("Plazas Accesibles"), { target: { value: "2" } });
    expect(screen.getByText(/78 plazas Estándar/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Crear recinto" }));

    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith("/api/facilities", expect.objectContaining({ method: "POST" })));
    const createBody = JSON.parse(vi.mocked(apiFetch).mock.calls[0][1]?.body as string) as { accessibleCapacity: number };
    expect(createBody.accessibleCapacity).toBe(2);
    await waitFor(() => expect(onFacilityCreated).toHaveBeenCalledWith(facility, "assigned-token"));
  });

  it("creates a parking area with separate Standard and Accessible allocations", async () => {
    const categories: SpaceCategory[] = [
      { id: "cat-std", facilityId: facility.id, name: "Estándar", code: "STD", allocatedSlots: 73 },
      { id: "cat-acc", facilityId: facility.id, name: "Accesible", code: "ACC", allocatedSlots: 7 },
    ];
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(response({ areas: [] }))
      .mockResolvedValueOnce(response({ area: { id: "area-new", name: "Norte", standardCapacity: 20, accessibleCapacity: 1, allocatedCapacity: 21 } }))
      .mockResolvedValueOnce(response({ areas: [] }));
    render(<FacilityConfigView facility={facility} businessUnits={[]} events={[]} spaceCategories={categories} />);

    fireEvent.change(screen.getByLabelText("Nombre del Área"), { target: { value: "Norte" } });
    fireEvent.change(screen.getByLabelText("Código Único"), { target: { value: "NORTE" } });
    fireEvent.change(screen.getByLabelText("Plazas Estándar del área"), { target: { value: "20" } });
    fireEvent.change(screen.getByLabelText("Plazas Accesibles del área"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear Área" }));

    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith(`/api/facilities/${facility.id}/areas`, expect.objectContaining({ method: "POST" })));
    const createCall = vi.mocked(apiFetch).mock.calls.find(([url, options]) => String(url).endsWith("/areas") && options?.method === "POST");
    expect(JSON.parse(createCall?.[1]?.body as string)).toMatchObject({ standardCapacity: 20, accessibleCapacity: 1 });
  });

  it("edits the facility and confirms logical deactivation", async () => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(response({ areas: [] }))
      .mockResolvedValueOnce(response({ facility: { ...facility, name: "Recinto actualizado" } }))
      .mockResolvedValueOnce(response({ facilityId: facility.id, status: "inactive" }));
    const onFacilityDeactivated = vi.fn();
    render(<FacilityConfigView facility={facility} businessUnits={[]} events={[]} onFacilityDeactivated={onFacilityDeactivated} />);

    fireEvent.change(screen.getByLabelText("Nombre del Recinto / Complejo"), { target: { value: "Recinto actualizado" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar Parámetros" }));
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith(`/api/facilities/${facility.id}`, expect.objectContaining({ method: "PUT" })));

    fireEvent.click(screen.getByRole("button", { name: "Eliminar recinto" }));
    expect(screen.getByRole("alertdialog").textContent).toContain("históric");
    fireEvent.click(screen.getByRole("button", { name: "Confirmar eliminación" }));
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith(`/api/facilities/${facility.id}/status`, expect.objectContaining({ method: "PATCH" })));
    await waitFor(() => expect(onFacilityDeactivated).toHaveBeenCalledOnce());
  });
});
