# Implementation Tasks: Construcción de Instalaciones, Gestión de Áreas y Asignación Dinámica

**Feature**: `002-facility-area-setup` | **Date**: 2026-10-15 | **Spec**: [spec.md](file:///home/zer0x/proyectos/paking-int2/specs/002-facility-area-setup/spec.md) | **Plan**: [plan.md](file:///home/zer0x/proyectos/paking-int2/specs/002-facility-area-setup/plan.md)

---

## Phase 1: Setup & Data Contracts (Foundational)

**Purpose**: Expand domain schemas and database foundations for facilities and parking areas.

- [x] T001 [P] Define `ParkingAreaSchema`, input schemas, and extend `ParkingSessionSchema` with `parkingAreaId` in `src/core/types/schema.ts`
- [x] T002 [P] Update database schema with `parking_areas` table and session relations in `src/server/db/schema.ts`
- [x] T003 Update IndexedDB local schema with `parking_areas` store in `src/client/db/index.ts`

---

## Phase 2: TDD Red Phase - Failing Tests (Blocking Prerequisites)

**Purpose**: Write automated test suites that fail demonstrably before writing production code (Constitution Principle II).

- [x] T004 [P] [US1] Write failing unit tests for facility creation, capacity updates and buffer calculations in `tests/unit/core/test_area_allocation.test.ts`
- [x] T005 [P] [US2] Write failing unit tests for area creation, code uniqueness and business unit binding in `tests/unit/core/test_area_allocation.test.ts`
- [x] T006 [P] [US3] Write failing unit tests for dynamic capacity reallocations, over-allocation prevention and under-occupancy reduction blocks in `tests/unit/core/test_area_allocation.test.ts`
- [x] T007 [P] [US1-US3] Write failing integration tests for facilities and areas API endpoints (`/api/facilities`, `/api/facilities/:facilityId/areas`) in `tests/unit/server/test_area_api.test.ts`

**Checkpoint**: Execute Vitest to confirm that all new tests fail in Red Phase.

---

## Phase 3: Core Domain Implementation (Hexagonal Pure Domain)

**Purpose**: Implement pure domain logic for facility capacity, parking areas, and dynamic adjustments without UI/DB coupling.

- [x] T008 [US1] Implement facility validation, total capacity constraints and buffer calculation in `src/core/rules/areaAllocationRules.ts`
- [x] T009 [US2] Implement parking area entity factory, code uniqueness validator, and business unit exclusivity rules in `src/core/rules/areaAllocationRules.ts`
- [x] T010 [US3] Implement dynamic capacity re-adjustment validator (preventing over-allocation and preventing reduction below active occupancy) in `src/core/rules/areaAllocationRules.ts`
- [x] T011 [US3] Integrate area-level capacity and occupancy tracking into the general allocation engine in `src/core/rules/allocationRules.ts`

**Checkpoint**: Confirm domain unit tests in `tests/unit/core/test_area_allocation.test.ts` pass (Green Phase).

---

## Phase 4: Server API & D1 Persistence Implementation

**Purpose**: Expose REST endpoints in Hono and persist facilities and areas in Cloudflare D1 with audit logging.

- [x] T012 [US1] Implement `POST /api/facilities` and `PUT /api/facilities/:id` endpoints with RBAC admin check in `src/server/api/facilities.ts`
- [x] T013 [US2] Implement `GET /api/facilities/:facilityId/areas` and `POST /api/facilities/:facilityId/areas` in `src/server/api/areas.ts`
- [x] T014 [US3] Implement `PATCH /api/facilities/:facilityId/areas/:areaId/capacity` with optimistic locking and occupancy guard in `src/server/api/areas.ts`
- [x] T015 Register facility and area routes in server main router `src/server/index.ts` and add audit log records for area changes

**Checkpoint**: Confirm server API integration tests in `tests/unit/server/test_area_api.test.ts` pass (Green Phase).

---

## Phase 5: Client PWA Offline-First & UI Implementation

**Purpose**: Provide intuitive, real-time UI components in Vite + React for constructing facilities, creating areas, and adjusting quotas dynamically.

- [x] T016 [US1-US3] Implement full Facility & Area Management UI in `src/client/components/FacilityConfigView.tsx`:
  - Form to create and update facility name and total capacity
  - Visual summary card with Total Capacity, Allocated Sum, and Floating Buffer
  - Form to create new parking areas (name, code, dynamic capacity, business unit binding)
  - Interactive table/cards of areas with live dynamic capacity editor (slider or quick +/- inputs) and occupancy bar
- [x] T017 [US4] Update `src/client/components/VehicleEntryForm.tsx` to include an Area Selector with real-time occupancy indicators
- [x] T018 [US4] Update `src/client/components/OperationalDashboard.tsx` to display real-time capacity and occupancy metrics by physical parking area
- [x] T019 Update state orchestration and offline synchronization for areas in `src/client/App.tsx`

---

## Phase 6: Verification, Typecheck & Quality Audit (Definition of Done)

**Purpose**: Verify end-to-end criteria in real browser and satisfy all DoD requirements.

- [x] T020 Run `tsc --noEmit` and ESLint to verify 0 errors and strict TypeScript compliance
- [x] T021 Run complete test suite with `npm run test:run` verifying coverage $\ge 85\%$
- [x] T022 Execute browser verification with browser subagent testing facility creation, area addition, dynamic capacity re-allocation, and entry assignment
