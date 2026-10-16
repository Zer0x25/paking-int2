import { Hono } from "hono";
import {
  FacilitySchema,
  CreateFacilityInputSchema,
  UpdateFacilityInputSchema,
  CreateParkingAreaInputSchema,
  UpdateParkingAreaCapacityInputSchema,
  type ParkingArea,
} from "@core/types/schema";
import {
  calculateFacilityBuffer,
  validateFacilityCapacity,
  createParkingArea,
  reallocateAreaCapacity,
  calculateAreaAvailability,
} from "@core/rules/areaAllocationRules";
import {
  defaultFacility,
  defaultBusinessUnits,
  defaultEvents,
} from "../services/allocation-service";
import { mockSessionsRepo } from "./parking";

export const facilityRoutes = new Hono();

// Memory store of facilities
export const facilitiesStore = [defaultFacility];
export const businessUnitsStore = [...defaultBusinessUnits];

// Memory store of parking areas
export const parkingAreasStore: ParkingArea[] = [
  {
    id: "area-default-01",
    facilityId: defaultFacility.id,
    name: "Subsuelo Techado (Nivel -1)",
    code: "SUB-1",
    description: "Estacionamiento techado principal",
    allocatedCapacity: 50,
    businessUnitId: null, // Compartido
    isActive: true,
    version: 1,
    createdAt: "2026-10-15T00:00:00.000Z",
    updatedAt: "2026-10-15T00:00:00.000Z",
  },
  {
    id: "area-default-02",
    facilityId: defaultFacility.id,
    name: "Sector Preferencial Hotel",
    code: "HOTEL-P1",
    description: "Acceso directo a lobby hotel",
    allocatedCapacity: 30,
    businessUnitId: "bu-hotel-01", // Exclusivo Hotel
    isActive: true,
    version: 1,
    createdAt: "2026-10-15T00:00:00.000Z",
    updatedAt: "2026-10-15T00:00:00.000Z",
  },
];

// GET /api/facilities
facilityRoutes.get("/", (c) => {
  return c.json({ facilities: facilitiesStore });
});

// POST /api/facilities
facilityRoutes.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = FacilitySchema.safeParse({
    ...body,
    id: body.id || crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  if (!parsed.success) {
    return c.json({ error: "Datos de instalación inválidos", details: parsed.error.format() }, 400);
  }

  facilitiesStore.push(parsed.data);
  return c.json({ facility: parsed.data }, 201);
});

// PUT /api/facilities/:id
facilityRoutes.put("/:id", async (c) => {
  const facilityId = c.req.param("id");
  const facility = facilitiesStore.find((f) => f.id === facilityId);
  if (!facility) {
    return c.json({ error: `Instalación "${facilityId}" no encontrada` }, 404);
  }

  const body = await c.req.json();
  const parsed = UpdateFacilityInputSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Datos de actualización inválidos", details: parsed.error.format() }, 400);
  }

  const { name, address, totalCapacity } = parsed.data;

  if (totalCapacity !== undefined) {
    const existingAreas = parkingAreasStore.filter((a) => a.facilityId === facilityId);
    const activeSessionsCount = mockSessionsRepo.filter(
      (s) => s.facilityId === facilityId && s.status === "active"
    ).length;

    try {
      validateFacilityCapacity(totalCapacity, existingAreas, activeSessionsCount);
    } catch (err: any) {
      return c.json({ error: err.message }, 409);
    }
    facility.totalCapacity = totalCapacity;
  }

  if (name !== undefined) facility.name = name;
  if (address !== undefined) facility.address = address;
  facility.updatedAt = new Date().toISOString();

  return c.json({ facility }, 200);
});

// GET /api/facilities/:id/areas
facilityRoutes.get("/:id/areas", (c) => {
  const facilityId = c.req.param("id");
  const facility = facilitiesStore.find((f) => f.id === facilityId) || defaultFacility;
  const areas = parkingAreasStore.filter((a) => a.facilityId === facility.id && a.isActive);

  const allocatedSum = areas.reduce((sum, a) => sum + a.allocatedCapacity, 0);
  const floatingBuffer = calculateFacilityBuffer(facility.totalCapacity, areas);

  const areasWithMetrics = areas.map((area) => {
    const metrics = calculateAreaAvailability(area, mockSessionsRepo);
    return {
      ...area,
      activeOccupancy: metrics.occupied,
      availableSlots: metrics.available,
      occupancyPercentage: metrics.occupancyPercentage,
      isSaturated: metrics.isSaturated,
    };
  });

  return c.json({
    facilityId: facility.id,
    totalCapacity: facility.totalCapacity,
    allocatedCapacitySum: allocatedSum,
    floatingBuffer,
    areas: areasWithMetrics,
  });
});

// POST /api/facilities/:id/areas
facilityRoutes.post("/:id/areas", async (c) => {
  const facilityId = c.req.param("id");
  const facility = facilitiesStore.find((f) => f.id === facilityId) || defaultFacility;
  const body = await c.req.json();

  const parsed = CreateParkingAreaInputSchema.safeParse({
    ...body,
    facilityId,
  });

  if (!parsed.success) {
    return c.json({ error: "Datos de área inválidos", details: parsed.error.format() }, 400);
  }

  const existingAreas = parkingAreasStore.filter((a) => a.facilityId === facility.id);

  try {
    const newArea = createParkingArea(parsed.data, existingAreas, facility.totalCapacity);
    parkingAreasStore.push(newArea);
    return c.json({ area: newArea }, 201);
  } catch (err: any) {
    return c.json({ error: err.message }, 409);
  }
});

// PATCH /api/facilities/:id/areas/:areaId/capacity
facilityRoutes.patch("/:id/areas/:areaId/capacity", async (c) => {
  const facilityId = c.req.param("id");
  const areaId = c.req.param("areaId");
  const facility = facilitiesStore.find((f) => f.id === facilityId) || defaultFacility;

  const body = await c.req.json();
  const parsed = UpdateParkingAreaCapacityInputSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Datos de capacidad inválidos", details: parsed.error.format() }, 400);
  }

  const existingAreas = parkingAreasStore.filter((a) => a.facilityId === facility.id);
  const targetArea = existingAreas.find((a) => a.id === areaId);
  if (!targetArea) {
    return c.json({ error: `Área con ID "${areaId}" no encontrada` }, 404);
  }

  const activeSessions = mockSessionsRepo.filter(
    (s) => s.status === "active" && s.parkingAreaId === areaId
  );

  try {
    const updatedArea = reallocateAreaCapacity({
      areaId,
      newCapacity: parsed.data.allocatedCapacity,
      areas: existingAreas,
      facilityTotalCapacity: facility.totalCapacity,
      activeOccupancy: activeSessions.length,
      expectedVersion: parsed.data.version,
    });

    const index = parkingAreasStore.findIndex((a) => a.id === areaId);
    if (index !== -1) {
      parkingAreasStore[index] = updatedArea;
    }

    return c.json({ area: updatedArea }, 200);
  } catch (err: any) {
    return c.json({ error: err.message }, 409);
  }
});

// GET /api/facilities/:id/catalogs
facilityRoutes.get("/:id/catalogs", (c) => {
  const facilityId = c.req.param("id");
  const facility = facilitiesStore.find((f) => f.id === facilityId) || defaultFacility;
  const units = businessUnitsStore.filter((u) => u.facilityId === facility.id || u.facilityId === defaultFacility.id);
  const areas = parkingAreasStore.filter((a) => a.facilityId === facility.id && a.isActive);

  const categories = [
    { id: "cat-std", facilityId: facility.id, name: "General / Estándar", code: "STD", allocatedSlots: 80 },
    { id: "cat-acc", facilityId: facility.id, name: "Accesible (PMR)", code: "ACC", allocatedSlots: 10 },
    { id: "cat-vip", facilityId: facility.id, name: "VIP / Reservado", code: "VIP", allocatedSlots: 10 },
  ];

  return c.json({
    facility,
    categories,
    businessUnits: units,
    areas,
    events: defaultEvents,
  });
});
