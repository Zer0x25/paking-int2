import { describe, it, expect } from "vitest";
import {
  validateFacilityCapacity,
  calculateFacilityBuffer,
  createParkingArea,
  reallocateAreaCapacity,
  calculateAreaAvailability,
  canAdmitVehicleToArea,
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
});

