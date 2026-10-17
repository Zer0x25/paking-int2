# Implementation Plan: Instalaciones, Áreas y Reservas de Eventos

**Branch**: `002-facility-area-setup` | **Date**: 2026-10-15 | **Spec**: [spec.md](file:///home/zer0x/proyectos/paking-int2/specs/002-facility-area-setup/spec.md)

**Input**: Feature specification from `/specs/002-facility-area-setup/spec.md`

## Summary

Implementar la capacidad administrativa y operativa de:
1. Crear y parametrizar la instalación principal (`Facility`) con su capacidad total física de plazas.
2. Crear y configurar áreas o sectores de estacionamiento (`ParkingArea`), vinculables opcionalmente a unidades de negocio (ej. Exclusivo Hotel vs. Compartido).
3. Definir y reajustar dinámicamente en caliente la capacidad de cada área, validando que la suma de áreas no exceda la capacidad total del recinto y que ninguna reducción de capacidad viole la cantidad de vehículos actualmente estacionados en el área.
4. Extender el registro de entrada vehicular (`VehicleEntryForm`) y el dashboard operativo (`OperationalDashboard`) para reflejar la disponibilidad y ocupación desglosada por área física en tiempo real, operando bajo arquitectura offline-first con IndexedDB y sincronización hacia Cloudflare D1.
5. Gestionar múltiples reservas contractuales de eventos desde Configuración: crear, editar y cancelar rangos de fecha y hora; aplicar cupos durante el intervalo del evento; conservarlas hasta el final del día de gracia posterior a su fecha de término.

---

## Technical Context

**Language/Version**: TypeScript 5.7 (Strict Mode, `noImplicitAny: true`)
**Primary Dependencies**: React 18, Vite 6, Hono 4 (Cloudflare Workers), Zod 3.23, `idb` / IndexedDB API
**Storage**: IndexedDB (`SmartParkingDB`) en cliente PWA; Cloudflare D1 (SQLite distribuido) con Drizzle ORM en backend  
**Testing**: Vitest (`@cloudflare/vitest-pool-workers`, tests unitarios de dominio puro) con cobertura $\ge 85\%$  
**Target Platform**: Cloudflare Workers (Backend) + Navegadores modernos / PWA Offline-First (Frontend)  
**Project Type**: Web Application Hexagonal Offline-First (Frontend React + Backend Workers + Dominio Puro)  
**Performance Goals**:
- Creación de áreas y reajuste dinámico reflejado en la UI en $< 200\text{ ms}$.
- Validación atómica de invariantes de capacidad en dominio puro $< 5\text{ ms}$.  
- Validación de cupos simultáneos y rango de una reserva en dominio puro $< 5\text{ ms}$ para hasta 1,000 reservas.
**Constraints**:
- Offline-first: Toda la parametrización de instalaciones y áreas debe poder realizarse y consultarse sin conexión, persistiendo en IndexedDB y resolviendo sincronización en cola outbox.
- Cloudflare Free Tier awareness: Operaciones batch y sincronización incremental delta.  
**Scale/Scope**:
- Instalaciones con hasta 10,000 plazas y 50 áreas dinámicas simultáneas.

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio Constitucional | Estado | Evidencia de Cumplimiento |
|---|---|---|
| **I. Arquitectura Hexagonal & Library-First** | PASS | La lógica de validación de capacidades dinámicas, control de sumatoria y cálculo de buffer flotante reside en `src/core/` (dominio puro), sin dependencias de React ni de Workers. |
| **I. Offline-First PWA** | PASS | El almacén `parking_areas` y `facilities` se mantiene en IndexedDB con soporte de lectura/escritura local inmediata y sincronización asíncrona hacia Cloudflare D1. |
| **II. Test-First Riguroso (TDD Red/Green)** | PASS | Se definen pruebas unitarias en `tests/unit/core/test_area_allocation.test.ts` y en `tests/unit/server/test_area_api.test.ts` que fallan antes de habilitar el código de producción. Cobertura $\ge 85\%$. |
| **III. Esquemas Estrictos con Zod** | PASS | Todas las cargas útiles, mutaciones y modelos de áreas e instalaciones se validan estrictamente mediante `ParkingAreaSchema`, `CreateParkingAreaInputSchema`, etc. |
| **III. Integridad de Reservas Contractuales** | PASS | Los rangos y cupos de las reservas se validan en dominio; cancelar conserva el registro y lo excluye de la lista vigente. |
| **III. Cloudflare Free Tier Optimization** | PASS | El catálogo de áreas e instalaciones se almacena en caché en IndexedDB, minimizando lecturas repetitivas a Cloudflare D1. |
| **III. Seguridad y RBAC** | PASS | La creación de instalaciones y reajuste dinámico de áreas está estrictamente restringido al rol `admin` con token JWT verificado y trazabilidad en `audit_logs`. |
| **IV. Definition of Done (DoD)** | PASS | Cero errores de TypeScript (`tsc --noEmit`), linters limpios, cobertura $\ge 85\%$ y validación visual real en navegador. |

---

## Project Structure

### Documentation (this feature)

```text
specs/002-facility-area-setup/
├── plan.md              # Este plan de implementación
├── research.md          # Investigación y decisiones de diseño
├── data-model.md        # Modelo de datos, invariantes y esquemas Zod
├── quickstart.md        # Guía de verificación paso a paso
├── contracts/           # Contratos de API REST (Facilities & Areas)
│   └── api-facilities-areas.md
├── checklists/
│   └── requirements.md
└── tasks.md             # Tareas de implementación TDD
```

### Source Code (repository root)

```text
src/
├── core/                                # Dominio puro desacoplado
│   ├── types/
│   │   └── schema.ts                    # ParkingAreaSchema, FacilitySchema, inputs
│   └── rules/
│       ├── areaAllocationRules.ts       # Invariantes de capacidad dinámica, buffer y validaciones
│       ├── eventBookingRules.ts         # Validación de rangos y compromisos simultáneos
│       └── allocationRules.ts           # Integración con motor de asignación
├── server/                              # Backend Cloudflare Workers + Hono
│   ├── routes/
│   │   ├── facilities.ts                # Endpoints de instalaciones, áreas y reservas
│   │   ├── parking.ts                   # Ingreso y salida vehicular
│   │   └── dashboard.ts                 # Métricas operativas
│   └── db/
│       └── schema.ts                    # Tablas D1 (facilities, parking_areas, parking_sessions)
└── client/                              # PWA React Offline-First
    ├── db/
    │   └── index.ts                     # Almacén IndexedDB 'parking_areas' y 'facilities'
    ├── components/
    │   ├── FacilityConfigView.tsx       # Interfaz ampliada: constructor de instalación y áreas dinámicas
    │   ├── EventBookingsManager.tsx      # Alta, edición, cancelación y vencimiento de reservas
    │   ├── OperationalDashboard.tsx     # Desglose de ocupación por área física en tiempo real
    │   └── VehicleEntryForm.tsx         # Selector de área física al ingresar vehículo
    └── App.tsx

tests/
├── unit/
│   ├── core/
│   │   └── test_area_allocation.test.ts # TDD de reglas de asignación y límites dinámicos
│   │   └── test_event_booking.test.ts   # TDD de reglas de reservas de eventos
│   └── server/
│       └── test_area_api.test.ts        # TDD de endpoints de API de áreas e instalaciones
│       └── test_event_api.test.ts       # TDD de endpoints y auditoría de reservas
```

**Structure Decision**: Arquitectura hexagonal modular existente. Se preserva la separación estricta entre dominio (`src/core`), infraestructura backend (`src/server`) y cliente PWA (`src/client`). Las operaciones de eventos seguirán el patrón actual de catálogos de desarrollo en memoria y se integrarán con el motor de asignación sin acoplar el dominio a Hono o React. `EventBookingsManager` se monta desde la pantalla de Configuración.

---

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Persistencia durable de nuevas reservas en D1 fuera del proceso local | El backend de Configuración existente usa repositorios en memoria durante esta etapa de desarrollo; esta iteración reutiliza ese patrón para habilitar el CRUD y validar el flujo en la app local. Los registros creados en desarrollo se pierden al reiniciar el Worker. | Migrar todas las entidades de Configuración a D1 excede este cambio; persistir solo Eventos en D1 dejaría una dependencia parcial mientras instalaciones y unidades de negocio siguen en memoria. |
