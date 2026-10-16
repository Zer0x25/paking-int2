import { Hono } from "hono";
import { FacilitySchema, BusinessUnitSchema } from "@core/types/schema";
import {
  defaultFacility,
  defaultBusinessUnits,
  defaultEvents,
} from "../services/allocation-service";

export const facilityRoutes = new Hono();

// Memory store of facilities
export const facilitiesStore = [defaultFacility];
export const businessUnitsStore = [...defaultBusinessUnits];

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

// GET /api/facilities/:id/catalogs
facilityRoutes.get("/:id/catalogs", (c) => {
  const facilityId = c.req.param("id");
  const facility = facilitiesStore.find((f) => f.id === facilityId) || defaultFacility;
  const units = businessUnitsStore.filter((u) => u.facilityId === facility.id || u.facilityId === defaultFacility.id);

  const categories = [
    { id: "cat-std", facilityId: facility.id, name: "General / Estándar", code: "STD", allocatedSlots: 80 },
    { id: "cat-acc", facilityId: facility.id, name: "Accesible (PMR)", code: "ACC", allocatedSlots: 10 },
    { id: "cat-vip", facilityId: facility.id, name: "VIP / Reservado", code: "VIP", allocatedSlots: 10 },
  ];

  return c.json({
    facility,
    categories,
    businessUnits: units,
    events: defaultEvents,
  });
});
