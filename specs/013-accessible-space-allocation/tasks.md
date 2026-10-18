# Tasks: Capacidad por Tipo de Espacio

**Input**: Design documents from `/specs/013-accessible-space-allocation/`

**Prerequisites**: `plan.md`, approved `spec.md`, `research.md`, `data-model.md`, `contracts/`

**Tests**: Required by the approved spec, user request and project constitution. Follow Red/Green: write and run each story's tests before its implementation.

## Phase 1: Setup

**Purpose**: Lock the design decisions and verify the required artifacts.

- [ ] T001 Record the two-category capacity source, area fields and migration compatibility in `history/adr/ADR-022-physical-space-capacity-split.md`.
- [ ] T002 Confirm the approved spec, data model and API contract agree on STD/ACC and the explicit ACC-to-STD fallback in `specs/013-accessible-space-allocation/`.

## Phase 2: Foundational

**Purpose**: Add persisted per-area capacities and shared typed contracts required by every story.

- [ ] T003 [P] Add legacy fixture tests for per-type migration, active session preservation and area backfill in `tests/workers/space-capacity-migration.worker.test.ts` and extend `tests/workers/support/d1-fixture.ts` to apply migrations through a selected version.
- [ ] T004 [P] Add validation tests for typed area and occupancy response schemas in `tests/unit/server/test_facility_capacity.test.ts`.
- [ ] T005 Run the focused migration and schema tests and record their expected pre-implementation failures.
- [ ] T006 Add `standard_capacity` and `accessible_capacity` columns, constraints, and safe legacy backfill in `src/server/db/migrations/0004_space_category_capacity.sql` and `src/server/db/schema.ts`.
- [ ] T007 Add `standardCapacity` and `accessibleCapacity` mapping, preserving `allocatedCapacity` as their sum, plus strict Zod capacity/metric schemas in `src/server/db/repositories/row-mappers.ts`, `src/server/db/repositories/catalog-repository.ts` and `src/core/types/schema.ts`.

## Phase 3: User Story 1 - Configurar capacidad por tipo en el recinto (Priority: P1)

**Goal**: Configure total and Accessible capacity while deriving Standard and protecting existing area assignments and occupancy.

**Independent Test**: A 35-space facility with 2 Accessible spaces shows 33 Standard + 2 Accessible; invalid splits and reductions below protected capacity are rejected.

### Tests for User Story 1

- [ ] T008 [P] [US1] Add Zod and domain tests for default Accessible=0, Standard derivation, bounds, occupied spaces and area allocations in `tests/unit/server/test_facility_capacity.test.ts`.
- [ ] T009 [P] [US1] Add Worker tests for facility creation/update, category rows, audit atomicity and conflict responses in `tests/workers/configuration-persistence.worker.test.ts`.
- [ ] T010 [US1] Run the focused US1 tests and record their expected pre-implementation failures.

### Implementation for User Story 1

- [ ] T011 [US1] Extend facility create/update schemas and pure per-type facility validation in `src/core/types/schema.ts` and `src/core/rules/areaAllocationRules.ts`.
- [ ] T012 [US1] Persist STD=`totalCapacity-accessibleCapacity` and ACC=`accessibleCapacity` in bootstrap and update batches, including audit/version checks, in `src/server/db/repositories/catalog-repository.ts`.
- [ ] T013 [US1] Reject facility splits below per-type active occupancy or area assignments in `src/server/routes/facilities.ts`.
- [ ] T014 [US1] Add Accessible input, calculated Standard summary and current split to create/edit facility forms in `src/client/components/FacilityConfigView.tsx`; pass catalog categories from `src/client/App.tsx`.
- [ ] T015 [US1] Run focused US1 tests and verify 35/2, invalid input, audit and optimistic concurrency behavior.

## Phase 4: User Story 2 - Distribuir cada tipo entre áreas (Priority: P1)

**Goal**: Create and edit areas with separate Standard and Accessible capacity while preserving typed floating buffers.

**Independent Test**: With 33 Standard and 2 Accessible, areas can be assigned 20/1 and 10/1, leaving 3/0; over-allocation and reduction under typed occupancy fail.

### Tests for User Story 2

- [ ] T016 [P] [US2] Add tests for typed area creation/update, per-type buffers, per-type occupancy and legacy aggregate requests in `tests/unit/server/test_area_api.test.ts`.
- [ ] T017 [P] [US2] Add Worker tests for create/edit/quick-adjust persistence and audit of both area capacities in `tests/workers/configuration-persistence.worker.test.ts`.
- [ ] T018 [US2] Run focused US2 tests and record their expected pre-implementation failures.

### Implementation for User Story 2

- [ ] T019 [US2] Extend pure create/update/reallocate rules to enforce each facility category budget and each area's active occupancy in `src/core/rules/areaAllocationRules.ts`.
- [ ] T020 [US2] Persist both area values atomically and derive aggregate `allocated_capacity` in `src/server/db/repositories/catalog-repository.ts`.
- [ ] T021 [US2] Validate split payloads, expose typed area occupancy and keep aggregate API fields in `src/server/routes/facilities.ts`.
- [ ] T022 [US2] Add Standard/Accessible inputs, derived area total and per-type buffer feedback to area create/edit cards in `src/client/components/FacilityConfigView.tsx`.
- [ ] T023 [US2] Run focused US2 tests and verify legacy aggregate requests remain compatible.

## Phase 5: User Story 3 - Admitir vehículos respetando tipo y cuota (Priority: P1)

**Goal**: Apply the physical category limit as well as the independent business-unit quota for online and offline entries.

**Independent Test**: Standard cannot use Accessible capacity; an Accessible request can use Standard only after an explicit warning when no Accessible capacity remains in the facility; concurrent or synced requests cannot overbook.

### Tests for User Story 3

- [ ] T024 [P] [US3] Add domain tests for global, area and floating-buffer capacity by category, legacy occupancy, and preserved business quotas in `tests/unit/core/test_allocation_engine.test.ts`.
- [ ] T025 [P] [US3] Add Worker tests proving online and delta-sync entries reject unknown/legacy categories, enforce typed capacity and do not persist conflicts in `tests/workers/parking-operations.worker.test.ts`.
- [ ] T026 [P] [US3] Add gate tests for alternative-area guidance and explicit Accessible-to-Standard confirmation in `tests/unit/client/test_gate_entry_wizard.test.tsx`.
- [ ] T027 [US3] Run focused US3 tests and record their expected pre-implementation failures.

### Implementation for User Story 3

- [ ] T028 [US3] Add requested category to the pure admission context and enforce facility, area and floating-buffer limits in `src/core/rules/allocation-engine.ts` and `src/core/rules/areaAllocationRules.ts`.
- [ ] T029 [US3] Resolve category IDs to STD/ACC and apply the same capacity check before persisting direct and synced entries in `src/server/routes/parking.ts`, `src/server/routes/sync.ts` and `src/server/services/allocation-service.ts`.
- [ ] T030 [US3] Limit new gate choices to STD/ACC, show per-area availability, suggest another Accessible area and require an explicit Standard retry after the agreed warning in `src/client/components/VehicleGatePanel.tsx` and `src/client/components/VehicleEntryForm.tsx`.
- [ ] T031 [US3] Run focused US3 tests including conflicting concurrent mutations and offline synchronization.

## Phase 6: User Story 4 - Consultar disponibilidad por tipo (Priority: P2)

**Goal**: Show capacity, occupancy and remaining capacity per category for the facility, areas and gate.

**Independent Test**: With active Standard and Accessible sessions, facility, area and dashboard totals match their respective capacities and sessions.

### Tests for User Story 4

- [ ] T032 [P] [US4] Add dashboard calculation tests for typed facility and area totals in `tests/unit/core/test_dashboard_calculator.test.ts`.
- [ ] T033 [P] [US4] Add client assertions that typed capacity/occupancy renders while aggregate totals remain visible in `tests/unit/client/test_operational_dashboard.test.tsx` and `tests/unit/client/test_facility_config_view.test.tsx`.
- [ ] T034 [US4] Run focused US4 tests and record their expected pre-implementation failures.

### Implementation for User Story 4

- [ ] T035 [US4] Calculate typed capacity, occupancy and availability for each area and the facility in `src/core/rules/areaAllocationRules.ts`, `src/core/rules/dashboard-calculator.ts` and `src/core/rules/allocation-engine.ts`.
- [ ] T036 [US4] Return typed metrics from the existing facilities and dashboard endpoints in `src/server/routes/facilities.ts` and `src/server/routes/dashboard.ts`.
- [ ] T037 [US4] Display typed distribution in the configuration area cards, gate area choices and dashboard in `src/client/components/FacilityConfigView.tsx`, `src/client/components/VehicleGatePanel.tsx` and `src/client/components/OperationalDashboard.tsx`.
- [ ] T038 [US4] Run focused US4 tests and reconcile each metric with active session fixtures.

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Converge implementation with the approved spec and validate the local app.

- [ ] T039 Check that every FR and SC in `specs/013-accessible-space-allocation/spec.md` has implementation and test evidence; append any remaining work to this file.
- [ ] T040 Run `npm run test:coverage`, `npm run typecheck`, `npm run lint`, and `npm run build`; resolve failures without weakening the coverage threshold.
- [ ] T041 Validate the quickstart flows and visible forms in a real browser at `http://localhost:5173/` and `http://localhost:8787/` using `specs/013-accessible-space-allocation/quickstart.md`.
- [ ] T042 Add the completed implementation record to `history/prompts/PHR-021-accessible-space-allocation-implementation.prompt.md`.

## Dependencies & Execution Order

### Phase Dependencies

- Setup precedes implementation; approved spec and contract already exist.
- Foundational migration/schema/mapping precedes capacity configuration, area distribution, admission and metrics.
- Complete each story's tests and demonstrate red before its implementation tasks.
- US1 and US2 establish persisted capacity data. US3 depends on both. US4 depends on the shared type metrics and may proceed once foundational schema is ready, but final integration follows US1-US3.
- Polish begins after all four stories.

### User Story Dependencies

- **US1 (P1)**: Depends on Foundation; defines facility category capacities.
- **US2 (P1)**: Depends on Foundation and the facility type budgets from US1.
- **US3 (P1)**: Depends on US1 and US2 typed capacities.
- **US4 (P2)**: Depends on typed schemas and active sessions; integrate after capacity and admission stories.

### Parallel Opportunities

- T003, T004 and T007 work on independent migration/schema/test files after reviewing the same contract.
- Within each story, unit, Worker and UI tests can be drafted independently; all must be run red before production changes.
- Dashboard calculation tests and typed API tests can be drafted in parallel once shared schema is settled.

## Implementation Strategy

Implement the P1 configuration and area allocation path first, then protect admission across online/offline operation, then expose typed metrics. Keep each story independently verifiable. The deliverable is complete only when all stories, the coverage/type/lint/build gates, convergence, and browser-visible configuration are verified.

## Phase 8: Convergence

- [ ] T043 Verify in an authenticated real-browser session that Configuration shows Standard and Accessible capacity for the facility and areas, and record visible evidence per Constitution V and SC-001/SC-004 (partial).
