import { Hono } from "hono";
import type { TokenPayload } from "../middleware/auth";
import {
  FacilitySchema,
  CreateFacilityInputSchema,
  UpdateFacilityInputSchema,
  CreateParkingAreaInputSchema,
  UpdateParkingAreaCapacityInputSchema,
  UpdateParkingAreaInputSchema,
  DeactivateParkingAreaInputSchema,
  CreateBusinessUnitInputSchema,
  UpdateBusinessUnitInputSchema,
  DeactivateBusinessUnitInputSchema,
  CreateEventBookingInputSchema,
  UpdateEventBookingInputSchema,
  CancelEventBookingInputSchema,
  type EventBooking,
  type Facility,
  type ParkingArea,
  type BusinessUnit,
} from "@core/types/schema";
import {
  calculateFacilityBuffer,
  validateFacilityCapacity,
  createParkingArea,
  reallocateAreaCapacity,
  updateParkingArea,
  deactivateParkingArea,
  calculateAreaAvailability,
} from "@core/rules/areaAllocationRules";
import {
  cancelEventBooking,
  updateEventBooking,
  isEventVisible,
  validateEventBookingCapacity,
} from "@core/rules/eventBookingRules";
import {
  createBusinessUnit,
  updateBusinessUnit,
  deactivateBusinessUnit,
} from "@core/rules/businessUnitRules";
import {
  defaultFacility,
  businessUnitsStore,
  businessUnitAuditStore,
  eventBookingsStore,
  eventBookingAuditStore,
} from "../services/allocation-service";
import { mockSessionsRepo } from "./parking";
import { authMiddleware } from "../middleware/auth";

export const facilityRoutes = new Hono<{ Variables: { user: TokenPayload } }>();
export { businessUnitsStore };

// Memory store of facilities
export const facilitiesStore = [defaultFacility];

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
  const facilityId = c.req.param("id") as string;
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

function recordBusinessUnitMutation(
  userId: string,
  unit: BusinessUnit,
  action: "created" | "updated" | "deactivated",
  before: BusinessUnit | null,
): void {
  businessUnitAuditStore.push({
    id: crypto.randomUUID(),
    facilityId: unit.facilityId,
    businessUnitId: unit.id,
    userId,
    action,
    before,
    after: unit,
    createdAt: new Date().toISOString(),
  });
}

// GET /api/facilities/:id/business-units (management inventory, includes inactive history)
facilityRoutes.get("/:id/business-units", authMiddleware("admin"), (c) => {
  const facilityId = c.req.param("id") as string;
  if (!facilitiesStore.some((facility) => facility.id === facilityId)) {
    return c.json({ error: `Instalación "${facilityId}" no encontrada` }, 404);
  }

  const units = businessUnitsStore
    .filter((unit) => unit.facilityId === facilityId)
    .sort((left, right) => Number(right.isActive) - Number(left.isActive) || left.name.localeCompare(right.name));
  return c.json({ businessUnits: units });
});

// POST /api/facilities/:id/business-units
facilityRoutes.post("/:id/business-units", authMiddleware("admin"), async (c) => {
  const facilityId = c.req.param("id") as string;
  const facility = facilitiesStore.find((item) => item.id === facilityId);
  if (!facility) {
    return c.json({ error: `Instalación "${facilityId}" no encontrada` }, 404);
  }

  const body = await c.req.json();
  const parsed = CreateBusinessUnitInputSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Datos de unidad de negocio inválidos", details: parsed.error.format() }, 400);
  }

  try {
    const unit = createBusinessUnit(
      parsed.data,
      facilityId,
      businessUnitsStore,
      crypto.randomUUID(),
    );
    validateBusinessUnitCapacity(facility, [...businessUnitsStore, unit]);
    businessUnitsStore.push(unit);
    recordBusinessUnitMutation(c.get("user").userId, unit, "created", null);
    return c.json({ businessUnit: unit }, 201);
  } catch (error: unknown) {
    return c.json({ error: error instanceof Error ? error.message : "No se pudo crear la unidad" }, 409);
  }
});

// PUT /api/facilities/:id/business-units/:businessUnitId
facilityRoutes.put("/:id/business-units/:businessUnitId", authMiddleware("admin"), async (c) => {
  const facilityId = c.req.param("id") as string;
  const businessUnitId = c.req.param("businessUnitId");
  const facility = facilitiesStore.find((item) => item.id === facilityId);
  if (!facility) return c.json({ error: `Instalación "${facilityId}" no encontrada` }, 404);

  const currentIndex = businessUnitsStore.findIndex(
    (unit) => unit.id === businessUnitId && unit.facilityId === facilityId,
  );
  if (currentIndex < 0) return c.json({ error: `Unidad "${businessUnitId}" no encontrada` }, 404);

  const body = await c.req.json();
  const parsed = UpdateBusinessUnitInputSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Datos de actualización de unidad inválidos", details: parsed.error.format() }, 400);
  }

  const current = businessUnitsStore[currentIndex];
  try {
    const updated = updateBusinessUnit({ current, updates: parsed.data, businessUnits: businessUnitsStore });
    const visibleUnitEvents = eventBookingsStore.filter(
      (event) => event.facilityId === facilityId && event.businessUnitId === current.id && isEventVisible(event, new Date()),
    );
    if (visibleUnitEvents.length > 0 && updated.quotaType !== "contractual") {
      throw new Error("No se puede cambiar el tipo de cuota mientras la unidad tenga reservas vigentes");
    }

    const nextUnits = businessUnitsStore.map((unit, index) => index === currentIndex ? updated : unit);
    validateBusinessUnitCapacity(facility, nextUnits);

    businessUnitsStore[currentIndex] = updated;
    recordBusinessUnitMutation(c.get("user").userId, updated, "updated", current);
    return c.json({ businessUnit: updated }, 200);
  } catch (error: unknown) {
    return c.json({ error: error instanceof Error ? error.message : "No se pudo actualizar la unidad" }, 409);
  }
});

// PATCH /api/facilities/:id/business-units/:businessUnitId/status
facilityRoutes.patch("/:id/business-units/:businessUnitId/status", authMiddleware("admin"), async (c) => {
  const facilityId = c.req.param("id") as string;
  const businessUnitId = c.req.param("businessUnitId");
  if (!facilitiesStore.some((facility) => facility.id === facilityId)) {
    return c.json({ error: `Instalación "${facilityId}" no encontrada` }, 404);
  }
  const currentIndex = businessUnitsStore.findIndex(
    (unit) => unit.id === businessUnitId && unit.facilityId === facilityId,
  );
  if (currentIndex < 0) return c.json({ error: `Unidad "${businessUnitId}" no encontrada` }, 404);

  const body = await c.req.json();
  const parsed = DeactivateBusinessUnitInputSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Datos de retiro de unidad inválidos", details: parsed.error.format() }, 400);
  }

  const current = businessUnitsStore[currentIndex];
  const activeSessions = mockSessionsRepo.filter(
    (session) => session.facilityId === facilityId && session.businessUnitId === current.id && session.status === "active",
  ).length;
  const exclusiveAreas = parkingAreasStore.filter(
    (area) => area.facilityId === facilityId && area.businessUnitId === current.id && area.isActive,
  ).length;
  const visibleBookings = eventBookingsStore.filter(
    (event) => event.facilityId === facilityId && event.businessUnitId === current.id && isEventVisible(event, new Date()),
  ).length;
  const dependencies = [
    activeSessions ? `${activeSessions} sesión activa${activeSessions === 1 ? "" : "s"}` : null,
    exclusiveAreas ? `${exclusiveAreas} área${exclusiveAreas === 1 ? "" : "s"} exclusiva${exclusiveAreas === 1 ? "" : "s"} activa${exclusiveAreas === 1 ? "" : "s"}` : null,
    visibleBookings ? `${visibleBookings} reserva${visibleBookings === 1 ? "" : "s"} vigente${visibleBookings === 1 ? "" : "s"}` : null,
  ].filter((dependency): dependency is string => dependency !== null);

  try {
    const retired = deactivateBusinessUnit(current, parsed.data.version, dependencies);
    businessUnitsStore[currentIndex] = retired;
    recordBusinessUnitMutation(c.get("user").userId, retired, "deactivated", current);
    return c.json({ businessUnit: retired }, 200);
  } catch (error: unknown) {
    return c.json({ error: error instanceof Error ? error.message : "No se pudo retirar la unidad" }, 409);
  }
});

// GET /api/facilities/:id/areas
facilityRoutes.get("/:id/areas", (c) => {
  const facilityId = c.req.param("id");
  const facility = facilitiesStore.find((f) => f.id === facilityId) || defaultFacility;
  const areas = parkingAreasStore.filter((a) => a.facilityId === facility.id);
  const activeAreas = areas.filter((area) => area.isActive);

  const allocatedSum = activeAreas.reduce((sum, a) => sum + a.allocatedCapacity, 0);
  const floatingBuffer = calculateFacilityBuffer(facility.totalCapacity, activeAreas);

  const areasWithMetrics = areas.map((area) => {
    const metrics = calculateAreaAvailability(area, mockSessionsRepo);
    return {
      ...area,
      activeOccupancy: metrics.occupied,
      availableSlots: area.isActive ? metrics.available : 0,
      occupancyPercentage: area.isActive ? metrics.occupancyPercentage : 0,
      isSaturated: area.isActive && metrics.isSaturated,
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

// PUT /api/facilities/:id/areas/:areaId
facilityRoutes.put("/:id/areas/:areaId", async (c) => {
  const facilityId = c.req.param("id");
  const areaId = c.req.param("areaId");
  const facility = facilitiesStore.find((item) => item.id === facilityId);
  if (!facility) {
    return c.json({ error: `Instalación "${facilityId}" no encontrada` }, 404);
  }

  const body = await c.req.json();
  const parsed = UpdateParkingAreaInputSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Datos de actualización de área inválidos", details: parsed.error.format() }, 400);
  }

  const existingAreas = parkingAreasStore.filter((area) => area.facilityId === facilityId);
  if (!existingAreas.some((area) => area.id === areaId)) {
    return c.json({ error: `Área con ID "${areaId}" no encontrada` }, 404);
  }
  const activeOccupancy = mockSessionsRepo.filter(
    (session) => session.status === "active" && session.parkingAreaId === areaId
  ).length;

  try {
    const updatedArea = updateParkingArea({
      areaId,
      ...parsed.data,
      areas: existingAreas,
      facilityTotalCapacity: facility.totalCapacity,
      activeOccupancy,
      expectedVersion: parsed.data.version,
    });
    const index = parkingAreasStore.findIndex((area) => area.id === areaId);
    parkingAreasStore[index] = updatedArea;
    return c.json({ area: updatedArea }, 200);
  } catch (err: unknown) {
    return c.json({ error: err instanceof Error ? err.message : "No se pudo actualizar el área" }, 409);
  }
});

// PATCH /api/facilities/:id/areas/:areaId/status
facilityRoutes.patch("/:id/areas/:areaId/status", async (c) => {
  const facilityId = c.req.param("id");
  const areaId = c.req.param("areaId");
  const facility = facilitiesStore.find((item) => item.id === facilityId);
  if (!facility) {
    return c.json({ error: `Instalación "${facilityId}" no encontrada` }, 404);
  }

  const body = await c.req.json();
  const parsed = DeactivateParkingAreaInputSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Datos de estado de área inválidos", details: parsed.error.format() }, 400);
  }

  const existingAreas = parkingAreasStore.filter((area) => area.facilityId === facilityId);
  if (!existingAreas.some((area) => area.id === areaId)) {
    return c.json({ error: `Área con ID "${areaId}" no encontrada` }, 404);
  }
  const activeOccupancy = mockSessionsRepo.filter(
    (session) => session.status === "active" && session.parkingAreaId === areaId
  ).length;

  try {
    const updatedArea = deactivateParkingArea({
      areaId,
      areas: existingAreas,
      activeOccupancy,
      expectedVersion: parsed.data.version,
    });
    const index = parkingAreasStore.findIndex((area) => area.id === areaId);
    parkingAreasStore[index] = updatedArea;
    return c.json({ area: updatedArea }, 200);
  } catch (err: unknown) {
    return c.json({ error: err instanceof Error ? err.message : "No se pudo desactivar el área" }, 409);
  }
});

function getGuaranteedQuota(facilityId: string, units: BusinessUnit[] = businessUnitsStore): number {
  return units
    .filter((unit) => unit.facilityId === facilityId && unit.isActive && unit.quotaType === "guaranteed")
    .reduce((total, unit) => total + unit.defaultQuota, 0);
}

function validateBusinessUnitCapacity(facility: Facility, units: BusinessUnit[]): void {
  const guaranteedQuota = getGuaranteedQuota(facility.id, units);
  if (guaranteedQuota > facility.totalCapacity) {
    throw new Error(
      `La suma de cuotas garantizadas (${guaranteedQuota}) supera el aforo de la instalación (${facility.totalCapacity})`,
    );
  }

  const visibleEvents = eventBookingsStore.filter(
    (event) => event.facilityId === facility.id && isEventVisible(event, new Date()),
  );
  for (const event of visibleEvents) {
    validateEventBookingCapacity(event, visibleEvents, facility.totalCapacity, guaranteedQuota);
  }
}

function isContractualUnit(facilityId: string, businessUnitId: string): boolean {
  return businessUnitsStore.some(
    (unit) => unit.id === businessUnitId && unit.facilityId === facilityId && unit.isActive && unit.quotaType === "contractual",
  );
}

function recordEventMutation(
  actorUserId: string,
  event: EventBooking,
  action: "created" | "updated" | "cancelled",
  details: Record<string, unknown>,
): void {
  eventBookingAuditStore.push({
    id: crypto.randomUUID(),
    facilityId: event.facilityId,
    eventId: event.id,
    userId: actorUserId,
    action,
    details,
    createdAt: new Date().toISOString(),
  });
}

// GET /api/facilities/:id/events
facilityRoutes.get("/:id/events", authMiddleware("admin"), (c) => {
  const facilityId = c.req.param("id") as string;
  if (!facilitiesStore.some((facility) => facility.id === facilityId)) {
    return c.json({ error: `Instalación "${facilityId}" no encontrada` }, 404);
  }

  const events = eventBookingsStore
    .filter((event) => event.facilityId === facilityId)
    .sort((left, right) => left.startTime.localeCompare(right.startTime));
  return c.json({ events });
});

// POST /api/facilities/:id/events
facilityRoutes.post("/:id/events", authMiddleware("admin"), async (c) => {
  const facilityId = c.req.param("id") as string;
  const facility = facilitiesStore.find((item) => item.id === facilityId);
  if (!facility) return c.json({ error: `Instalación "${facilityId}" no encontrada` }, 404);

  const body = await c.req.json();
  const parsed = CreateEventBookingInputSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Datos de reserva inválidos", details: parsed.error.format() }, 400);
  }
  if (!isContractualUnit(facilityId, parsed.data.businessUnitId as string)) {
    return c.json({ error: "La unidad de negocio debe estar activa y tener cuota contractual" }, 400);
  }

  const event: EventBooking = {
    ...parsed.data,
    id: crypto.randomUUID(),
    facilityId,
    status: "scheduled",
    version: 1,
  };
  try {
    const existing = eventBookingsStore.filter((item) => item.facilityId === facilityId);
    validateEventBookingCapacity(event, existing, facility.totalCapacity, getGuaranteedQuota(facilityId));
    eventBookingsStore.push(event);
    recordEventMutation(c.get("user").userId, event, "created", { event });
    return c.json({ event }, 201);
  } catch (error: unknown) {
    return c.json({ error: error instanceof Error ? error.message : "No se pudo crear la reserva" }, 409);
  }
});

// PUT /api/facilities/:id/events/:eventId
facilityRoutes.put("/:id/events/:eventId", authMiddleware("admin"), async (c) => {
  const facilityId = c.req.param("id") as string;
  const eventId = c.req.param("eventId") as string;
  const facility = facilitiesStore.find((item) => item.id === facilityId);
  if (!facility) return c.json({ error: `Instalación "${facilityId}" no encontrada` }, 404);

  const currentIndex = eventBookingsStore.findIndex((event) => event.id === eventId && event.facilityId === facilityId);
  if (currentIndex < 0) return c.json({ error: `Reserva "${eventId}" no encontrada` }, 404);

  const body = await c.req.json();
  const parsed = UpdateEventBookingInputSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Datos de actualización inválidos", details: parsed.error.format() }, 400);
  }
  if (!isContractualUnit(facilityId, parsed.data.businessUnitId as string)) {
    return c.json({ error: "La unidad de negocio debe estar activa y tener cuota contractual" }, 400);
  }

  const current = eventBookingsStore[currentIndex];
  try {
    const updated = updateEventBooking({
      current,
      updates: parsed.data,
      events: eventBookingsStore.filter((event) => event.facilityId === facilityId),
      facilityCapacity: facility.totalCapacity,
      guaranteedQuota: getGuaranteedQuota(facilityId),
    });
    eventBookingsStore[currentIndex] = updated;
    recordEventMutation(c.get("user").userId, updated, "updated", { before: current, after: updated });
    return c.json({ event: updated }, 200);
  } catch (error: unknown) {
    return c.json({ error: error instanceof Error ? error.message : "No se pudo actualizar la reserva" }, 409);
  }
});

// PATCH /api/facilities/:id/events/:eventId/status
facilityRoutes.patch("/:id/events/:eventId/status", authMiddleware("admin"), async (c) => {
  const facilityId = c.req.param("id") as string;
  const eventId = c.req.param("eventId") as string;
  const currentIndex = eventBookingsStore.findIndex((event) => event.id === eventId && event.facilityId === facilityId);
  if (currentIndex < 0) return c.json({ error: `Reserva "${eventId}" no encontrada` }, 404);

  const body = await c.req.json();
  const parsed = CancelEventBookingInputSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Datos de cancelación inválidos", details: parsed.error.format() }, 400);
  }

  const current = eventBookingsStore[currentIndex];
  try {
    const cancelled = cancelEventBooking(current, parsed.data.version);
    eventBookingsStore[currentIndex] = cancelled;
    recordEventMutation(c.get("user").userId, cancelled, "cancelled", { before: current, after: cancelled });
    return c.json({ event: cancelled }, 200);
  } catch (error: unknown) {
    return c.json({ error: error instanceof Error ? error.message : "No se pudo cancelar la reserva" }, 409);
  }
});

// GET /api/facilities/:id/catalogs
facilityRoutes.get("/:id/catalogs", (c) => {
  const facilityId = c.req.param("id");
  const facility = facilitiesStore.find((f) => f.id === facilityId) || defaultFacility;
  const units = businessUnitsStore.filter(
    (unit) => unit.isActive && (unit.facilityId === facility.id || unit.facilityId === defaultFacility.id),
  );
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
    events: eventBookingsStore.filter((event) => event.facilityId === facility.id),
  });
});
