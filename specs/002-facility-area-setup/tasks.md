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

## Phase 7: Convergence - Dashboard Refresh and Area Lifecycle

**Purpose**: Close the reported dashboard refresh and area-management gaps against US2, US4, and the requested full area editor.

- [x] T023 [P] Add unit tests for area metadata updates, unique codes, capacity guards, optimistic versions, and safe deactivation in `tests/unit/core/test_area_allocation.test.ts`
- [x] T024 [P] Add API tests for area editing, inactive-area inventory, and deactivation guards in `tests/unit/server/test_area_api.test.ts`
- [x] T025 Preserve dashboard metrics and scroll position during background polling, showing the loading placeholder only before the first successful response; cover render state in `tests/unit/client/test_dashboard_render_state.test.ts`
- [x] T026 Implement versioned area metadata updates and occupancy-guarded logical deactivation in `src/core/types/schema.ts`, `src/core/rules/areaAllocationRules.ts`, and `src/server/routes/facilities.ts`
- [x] T027 Add full area editing and confirmed deactivation controls, and display inactive areas in `src/client/components/FacilityConfigView.tsx`
- [x] T028 Update the area API contract and quickstart scenarios for editing, deactivation, and stable dashboard refresh
- [x] T029 Verify the refreshed dashboard remains in place and validate area edit/deactivation flows in a browser without affecting existing active areas

## Phase 8: Event Booking Lifecycle

**Purpose**: Allow administrators to manage multiple date-bounded contractual event reservations while protecting facility capacity and retaining history.

- [x] T030 [P] [US5] Add failing domain tests for event booking validation, date/time ranges, overlapping capacity commitments, versioned edits/cancellation, and grace-period visibility in `tests/unit/core/test_event_booking.test.ts`
- [x] T031 [P] [US5] Add failing API tests for reservation create/list/edit/cancel, invalid ranges, capacity conflicts, and event audit records in `tests/unit/server/test_event_api.test.ts`
- [x] T032 [US5] Implement strict event booking schemas and pure validation/lifecycle rules in `src/core/types/schema.ts` and `src/core/rules/eventBookingRules.ts`
- [x] T033 [US5] Add an event booking store, audit trail, and Hono endpoints for list/create/versioned update/logical cancellation in `src/server/services/allocation-service.ts` and `src/server/routes/facilities.ts`
- [x] T034 [US5] Use managed reservations in admission allocation and return the facility's event records through `GET /catalogs` in `src/server/services/allocation-service.ts` and `src/server/routes/facilities.ts`
- [x] T035 [US5] Add event create/edit/cancel forms, date range display, and expiry filtering in `src/client/components/EventBookingsManager.tsx` and `src/client/utils/event-booking.ts`
- [x] T036 [US5] Update event contracts, data model, quickstart, ADR, and PHR; verify create/edit/cancel/expiry behavior in a real browser
