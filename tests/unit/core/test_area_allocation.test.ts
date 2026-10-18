import { describe, it, expect } from "vitest";
import {
  validateFacilityCapacity,
  calculateFacilityBuffer,
  createParkingArea,
  reallocateAreaCapacity,
  updateParkingArea,
  deactivateParkingArea,
  calculateAreaAvailability,
  canAdmitVehicleToArea,
  calculateFacilityTypeBuffer,
  splitFacilityCapacity,
} from "@core/rules/areaAllocationRules";
import type {
  Facility,
  ParkingArea,
  ParkingSession,
} from "@core/types/schema";

describe("TDD Feature 002: Construcción de Instalaciones, Áreas y Asignación Dinámica", () => {
  const facility: Facility = {
    id: "fac-001",
    name: "Complejo de Convenciones & Hotel Pacífico",
    address: "Av. Costanera 1000",
    totalCapacity: 100,
    createdAt: "2026-10-15T00:00:00Z",
    updatedAt: "2026-10-15T00:00:00Z",
  };

  const sampleAreas: ParkingArea[] = [
    {
      id: "area-sub-1",
      facilityId: "fac-001",
      name: "Subsuelo Techado",
      code: "SUB-1",
      description: "Nivel -1",
      allocatedCapacity: 40,
      businessUnitId: null, // Compartido
      isActive: true,
      version: 1,
      createdAt: "2026-10-15T00:00:00Z",
      updatedAt: "2026-10-15T00:00:00Z",
    },
    {
      id: "area-hotel-vip",
      facilityId: "fac-001",
      name: "Sector VIP Hotel",
      code: "VIP-HOTEL",
      description: "Frente a recepción hotel",
      allocatedCapacity: 30,
      businessUnitId: "bu-hotel", // Exclusivo
      isActive: true,
      version: 1,
      createdAt: "2026-10-15T00:00:00Z",
      updatedAt: "2026-10-15T00:00:00Z",
    },
  ];

  describe("User Story 1: Creación y Parámetros de Instalación (Buffer y Capacidad Total)", () => {
    it("debe calcular correctamente la reserva flotante (buffer general) no sectorizada", () => {
      // 100 total - (40 + 30) = 30 plazas de buffer
      const buffer = calculateFacilityBuffer(facility.totalCapacity, sampleAreas);
      expect(buffer).toBe(30);
    });

    it("debe rechazar capacidad total menor o igual a cero", () => {
      expect(() => validateFacilityCapacity(0, sampleAreas, 0)).toThrow(
        /capacidad total debe ser mayor a 0/i
      );
      expect(() => validateFacilityCapacity(-10, sampleAreas, 0)).toThrow();
    });

    it("debe impedir reducir la capacidad total de la instalación por debajo de las plazas ya asignadas a áreas", () => {
      // Áreas suman 70 plazas asignadas. Reducir a 60 debe fallar.
      expect(() => validateFacilityCapacity(60, sampleAreas, 0)).toThrow(
        /la capacidad total no puede ser inferior a la suma de plazas asignadas/i
      );
    });

    it("debe impedir reducir la capacidad total por debajo de la ocupación activa total", () => {
      expect(() => validateFacilityCapacity(80, [], 85)).toThrow(
        /la capacidad total no puede ser inferior a los vehículos actualmente aparcados/i
      );
    });
  });

  describe("User Story 2: Creación de Áreas de Estacionamiento y Exclusividad", () => {
    it("debe crear un área válida asociada a la instalación respetando el código en mayúsculas", () => {
      const newArea = createParkingArea(
        {
          facilityId: "fac-001",
          name: "Playa Abierta Norte",
          code: "norte-1",
          allocatedCapacity: 20,
          businessUnitId: null,
        },
        sampleAreas,
        facility.totalCapacity
      );

      expect(newArea.id).toBeDefined();
      expect(newArea.code).toBe("NORTE-1");
      expect(newArea.allocatedCapacity).toBe(20);
      expect(newArea.version).toBe(1);
    });

    it("debe impedir crear un área con un código duplicado en la misma instalación", () => {
      expect(() =>
        createParkingArea(
          {
            facilityId: "fac-001",
            name: "Subsuelo Duplicado",
            code: "SUB-1",
            allocatedCapacity: 10,
          },
          sampleAreas,
          facility.totalCapacity
        )
      ).toThrow(/código .* ya existe/i);
    });

    it("debe rechazar la creación de un área si su capacidad supera el buffer flotante disponible", () => {
      // Buffer actual: 30 plazas libres. Intentar crear área con 35 debe fallar.
      expect(() =>
        createParkingArea(
          {
            facilityId: "fac-001",
            name: "Área Gigante",
            code: "GIGA-1",
            allocatedCapacity: 35,
          },
          sampleAreas,
          facility.totalCapacity
        )
      ).toThrow(/supera el buffer disponible/i);
    });
  });

  describe("User Story 3: Asignación y Reajuste Dinámico de Capacidad por Área", () => {
    it("debe reajustar dinámicamente la capacidad de un área si hay buffer disponible", () => {
      // SUB-1 pasa de 40 a 60 (toma 20 del buffer de 30)
      const updatedArea = reallocateAreaCapacity({
        areaId: "area-sub-1",
        newCapacity: 60,
        areas: sampleAreas,
        facilityTotalCapacity: facility.totalCapacity,
        activeOccupancy: 15,
        expectedVersion: 1,
      });

      expect(updatedArea.allocatedCapacity).toBe(60);
      expect(updatedArea.version).toBe(2);
    });

    it("debe rechazar la reducción de capacidad si la nueva capacidad es menor a los vehículos aparcados", () => {
      // En SUB-1 hay 25 autos estacionados actualmente.
      // Intentar reducir a 20 debe ser estrictamente bloqueado.
      expect(() =>
        reallocateAreaCapacity({
          areaId: "area-sub-1",
          newCapacity: 20,
          areas: sampleAreas,
          facilityTotalCapacity: facility.totalCapacity,
          activeOccupancy: 25,
          expectedVersion: 1,
        })
      ).toThrow(/no es posible reducir la capacidad a 20: hay 25 vehículos/i);
    });

    it("debe rechazar el aumento si la nueva capacidad excede la capacidad total de la instalación", () => {
      // SUB-1 (40) + VIP-HOTEL (30) = 70. Buffer = 30.
      // Si se intenta subir SUB-1 a 80, la suma sería 80 + 30 = 110 > 100.
      expect(() =>
        reallocateAreaCapacity({
          areaId: "area-sub-1",
          newCapacity: 80,
          areas: sampleAreas,
          facilityTotalCapacity: facility.totalCapacity,
          activeOccupancy: 10,
          expectedVersion: 1,
        })
      ).toThrow(/superaría la capacidad total/i);
    });

    it("debe prevenir modificaciones concurrentes por colisión de versión optimista", () => {
      expect(() =>
        reallocateAreaCapacity({
          areaId: "area-sub-1",
          newCapacity: 50,
          areas: sampleAreas,
          facilityTotalCapacity: facility.totalCapacity,
          activeOccupancy: 5,
          expectedVersion: 99, // Versión no coincide con 1
        })
      ).toThrow(/concurrencia optimista/i);
    });
  });

  describe("User Story 4: Disponibilidad Operativa por Área y Control de Admisión", () => {
    const activeSessions: ParkingSession[] = [
      {
        id: "sess-1",
        facilityId: "fac-001",
        businessUnitId: "bu-restaurant",
        spaceCategoryId: "cat-std",
        parkingAreaId: "area-sub-1",
        licensePlate: "AA111AA",
        entryTime: "2026-10-15T12:00:00Z",
        status: "active",
        operatorUserId: "op-1",
        deviceId: "gate-1",
        version: 1,
        exitTime: null,
        durationMinutes: null,
      },
      {
        id: "sess-2",
        facilityId: "fac-001",
        businessUnitId: "bu-hotel",
        spaceCategoryId: "cat-std",
        parkingAreaId: "area-hotel-vip",
        licensePlate: "BB222BB",
        entryTime: "2026-10-15T12:05:00Z",
        status: "active",
        operatorUserId: "op-1",
        deviceId: "gate-1",
        version: 1,
        exitTime: null,
        durationMinutes: null,
      },
    ];

    it("debe calcular métricas de aforo y ocupación por área en tiempo real", () => {
      const metrics = calculateAreaAvailability(sampleAreas[0], activeSessions);
      expect(metrics.allocatedCapacity).toBe(40);
      expect(metrics.occupied).toBe(1);
      expect(metrics.available).toBe(39);
      expect(metrics.occupancyPercentage).toBe(2.5);
      expect(metrics.isSaturated).toBe(false);
    });

    it("debe impedir admitir un vehículo en un área exclusiva de otra unidad de negocio", () => {
      // area-hotel-vip es exclusiva para 'bu-hotel'
      const canAdmitRestaurant = canAdmitVehicleToArea(
        sampleAreas[1],
        activeSessions,
        "bu-restaurant"
      );
      expect(canAdmitRestaurant.allowed).toBe(false);
      expect(canAdmitRestaurant.reason).toMatch(/exclusiva/i);

      const canAdmitHotel = canAdmitVehicleToArea(
        sampleAreas[1],
        activeSessions,
        "bu-hotel"
      );
      expect(canAdmitHotel.allowed).toBe(true);
    });

    it("debe permitir ingreso en área compartida para cualquier unidad de negocio si hay cupo", () => {
      const canAdmit = canAdmitVehicleToArea(
        sampleAreas[0],
        activeSessions,
        "bu-restaurant"
      );
      expect(canAdmit.allowed).toBe(true);
    });

    it("debe rechazar ingreso si el área ha alcanzado su capacidad asignada", () => {
      const fullArea: ParkingArea = {
        ...sampleAreas[0],
        allocatedCapacity: 1, // Sólo 1 plaza y ya hay 1 activa
      };
      const result = canAdmitVehicleToArea(fullArea, activeSessions, "bu-restaurant");
      expect(result.allowed).toBe(false);
      expect(result.reason).toMatch(/capacidad máxima alcanzada/i);
    });

    it("debe rechazar ingreso si el área está inactiva", () => {
      const inactiveArea: ParkingArea = {
        ...sampleAreas[0],
        isActive: false,
      };
      const result = canAdmitVehicleToArea(inactiveArea, activeSessions, "bu-restaurant");
      expect(result.allowed).toBe(false);
      expect(result.reason).toMatch(/inactiva/i);
    });

    it("debe arrojar error si el área a reajustar no existe", () => {
      expect(() =>
        reallocateAreaCapacity({
          areaId: "area-inexistente",
          newCapacity: 50,
          areas: sampleAreas,
          facilityTotalCapacity: facility.totalCapacity,
          activeOccupancy: 0,
          expectedVersion: 1,
        })
      ).toThrow(/no encontrada/i);
    });

    it("debe rechazar capacidad negativa o no entera en reallocateAreaCapacity", () => {
      expect(() =>
        reallocateAreaCapacity({
          areaId: "area-sub-1",
          newCapacity: -5,
          areas: sampleAreas,
          facilityTotalCapacity: facility.totalCapacity,
          activeOccupancy: 0,
          expectedVersion: 1,
        })
      ).toThrow(/mayor o igual a 0/i);
    });
  });

  describe("Convergencia: edición y baja lógica de áreas", () => {
    it("debe actualizar todos los datos editables y normalizar el código", () => {
      const updated = updateParkingArea({
        areaId: "area-sub-1",
        name: "Subsuelo Remodelado",
        code: "sub-nuevo",
        description: "Acceso por rampa norte",
        allocatedCapacity: 45,
        businessUnitId: "bu-hotel",
        areas: sampleAreas,
        facilityTotalCapacity: facility.totalCapacity,
        activeOccupancy: 15,
        expectedVersion: 1,
      });

      expect(updated).toMatchObject({
        name: "Subsuelo Remodelado",
        code: "SUB-NUEVO",
        description: "Acceso por rampa norte",
        allocatedCapacity: 45,
        businessUnitId: "bu-hotel",
        version: 2,
        isActive: true,
      });
    });

    it("debe rechazar un código que ya pertenece a otra área", () => {
      expect(() =>
        updateParkingArea({
          areaId: "area-sub-1",
          name: "Subsuelo Remodelado",
          code: "vip-hotel",
          description: "",
          allocatedCapacity: 40,
          businessUnitId: null,
          areas: sampleAreas,
          facilityTotalCapacity: facility.totalCapacity,
          activeOccupancy: 0,
          expectedVersion: 1,
        })
      ).toThrow(/código .* ya existe/i);
    });

    it("debe proteger ocupación, capacidad total y versión al editar", () => {
      const params = {
        areaId: "area-sub-1",
        name: "Subsuelo Remodelado",
        code: "SUB-1",
        description: "",
        allocatedCapacity: 20,
        businessUnitId: null,
        areas: sampleAreas,
        facilityTotalCapacity: facility.totalCapacity,
        activeOccupancy: 25,
        expectedVersion: 1,
      };

      expect(() => updateParkingArea(params)).toThrow(/no es posible reducir.*25 vehículos/i);
      expect(() => updateParkingArea({ ...params, allocatedCapacity: 80, activeOccupancy: 0 }))
        .toThrow(/superaría la capacidad total/i);
      expect(() => updateParkingArea({ ...params, expectedVersion: 99 }))
        .toThrow(/concurrencia optimista/i);
    });

    it("debe desactivar un área vacía y conservar su registro con nueva versión", () => {
      const deactivated = deactivateParkingArea({
        areaId: "area-sub-1",
        areas: sampleAreas,
        activeOccupancy: 0,
        expectedVersion: 1,
      });

      expect(deactivated.isActive).toBe(false);
      expect(deactivated.version).toBe(2);
      expect(sampleAreas[0].isActive).toBe(true);
    });

    it("debe bloquear la baja de áreas ocupadas o con versión obsoleta", () => {
      const params = {
        areaId: "area-sub-1",
        areas: sampleAreas,
        activeOccupancy: 1,
        expectedVersion: 1,
      };

      expect(() => deactivateParkingArea(params)).toThrow(/no se puede desactivar.*1 vehículo/i);
      expect(() => deactivateParkingArea({ ...params, activeOccupancy: 0, expectedVersion: 99 }))
        .toThrow(/concurrencia optimista/i);
    });
  });

  describe("Capacidad física por tipo", () => {
    it("crea áreas con capacidad Estándar y Accesible calculando el total", () => {
      const area = createParkingArea(
        { facilityId: facility.id, name: "Acceso", code: "ACC-1", standardCapacity: 20, accessibleCapacity: 1 },
        [],
        { standardCapacity: 33, accessibleCapacity: 2 },
      );

      expect(area).toMatchObject({ standardCapacity: 20, accessibleCapacity: 1, allocatedCapacity: 21 });
    });

  it("protege el buffer Estándar y Accesible de forma independiente", () => {
      const allocated: ParkingArea[] = [{
        ...sampleAreas[0], standardCapacity: 30, accessibleCapacity: 1, allocatedCapacity: 31,
      }];

      expect(() => createParkingArea(
        { facilityId: facility.id, name: "Too many Standard", code: "S-2", standardCapacity: 4, accessibleCapacity: 0 },
        allocated,
        { standardCapacity: 33, accessibleCapacity: 2 },
      )).toThrow(/buffer.*estándar/i);
      expect(() => createParkingArea(
        { facilityId: facility.id, name: "Too many Accessible", code: "A-2", standardCapacity: 0, accessibleCapacity: 2 },
        allocated,
        { standardCapacity: 33, accessibleCapacity: 2 },
    )).toThrow(/buffer.*accesible/i);
  });

  it("calculates typed floating buffers and supports legacy areas", () => {
    const assignedAreas: ParkingArea[] = [
      { ...sampleAreas[0], standardCapacity: 20, accessibleCapacity: 1, allocatedCapacity: 21 },
      { ...sampleAreas[1], isActive: false, standardCapacity: 99, accessibleCapacity: 99, allocatedCapacity: 198 },
    ];

    expect(splitFacilityCapacity(35, 2)).toEqual({ standardCapacity: 33, accessibleCapacity: 2 });
    expect(calculateFacilityTypeBuffer({ standardCapacity: 33, accessibleCapacity: 2 }, assignedAreas))
      .toEqual({ standardCapacity: 13, accessibleCapacity: 1 });
    expect(calculateFacilityTypeBuffer({ standardCapacity: 10, accessibleCapacity: 0 }, [sampleAreas[0]]))
      .toEqual({ standardCapacity: 0, accessibleCapacity: 0 });
  });

  it("edits area capacities by type and protects typed occupancy", () => {
    const area: ParkingArea = { ...sampleAreas[0], allocatedCapacity: 10, standardCapacity: 8, accessibleCapacity: 2 };
    const reallocation = {
      areaId: area.id, newCapacity: 10, standardCapacity: 8, accessibleCapacity: 2,
      areas: [area], facilityTotalCapacity: 100, facilityAccessibleCapacity: 10,
      activeOccupancy: 3, activeStandardOccupancy: 2, activeAccessibleOccupancy: 1, expectedVersion: 1,
    };
    expect(reallocateAreaCapacity(reallocation)).toMatchObject({ allocatedCapacity: 10, standardCapacity: 8, accessibleCapacity: 2 });
    expect(() => reallocateAreaCapacity({ ...reallocation, standardCapacity: 1, newCapacity: 3 }))
      .toThrow(/reducir Estándar/i);
    expect(() => reallocateAreaCapacity({ ...reallocation, accessibleCapacity: 0, newCapacity: 8 }))
      .toThrow(/reducir Accesible/i);

    const update = {
      areaId: area.id, name: "Subsuelo", code: "SUB-1", description: "", allocatedCapacity: 10,
      standardCapacity: 8, accessibleCapacity: 2, businessUnitId: null, areas: [area],
      facilityTotalCapacity: 100, facilityAccessibleCapacity: 10, activeOccupancy: 3,
      activeStandardOccupancy: 2, activeAccessibleOccupancy: 1, expectedVersion: 1,
    };
    expect(updateParkingArea(update)).toMatchObject({ standardCapacity: 8, accessibleCapacity: 2 });
    expect(() => updateParkingArea({ ...update, standardCapacity: 1, allocatedCapacity: 3 }))
      .toThrow(/reducir Estándar/i);
    expect(() => updateParkingArea({ ...update, accessibleCapacity: 0, allocatedCapacity: 8 }))
      .toThrow(/reducir Accesible/i);
  });
});
});
