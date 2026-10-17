# Tasks: Flujo guiado de garita

**Input**: Design documents from `specs/008-gate-entry-wizard/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/gate-entry-flow.md`, `quickstart.md`

**Tests**: TDD required. Add behavior tests before production changes and demonstrate they fail. Run the full project gate and browser scenarios after implementation.

## Phase 1: User Story 1 - Ingresar patente y elegir movimiento (Priority: P1)

**Goal**: Start each operation with plate-only entry, then choose Entry or Exit.

**Independent Test**: A valid plate advances to the two movement choices; Salida records an exit for that same plate and updates the active list.

### Tests

- [x] T001 [US1] Add failing tests for plate-only start, invalid/valid plate progression, retained plate, back navigation, and choosing Salida in `tests/unit/client/test_gate_entry_wizard.test.tsx`.

### Implementation

- [x] T002 [US1] Refactor local gate-flow state to `plate`, `movement` and `entry-details` steps in `src/client/components/VehicleGatePanel.tsx`.
- [x] T003 [US1] Show only the plate field and Registrar initially, reuse strict validation, and expose Entrada/Salida only after a valid plate in `src/client/components/VehicleGatePanel.tsx`.
- [x] T004 [US1] Route Salida through the existing manual-exit online/offline handler using the retained plate and reset the step only on success in `src/client/components/VehicleGatePanel.tsx`.
- [x] T005 [US1] Add accessible step, error and operation-result semantics while preserving data during back navigation in `src/client/components/VehicleGatePanel.tsx`.

## Phase 2: User Story 2 - Revisar destino antes de registrar entrada (Priority: P1)

**Goal**: Require an explicit review and confirmation of unit, space type and area/sector before creating an entry.

**Independent Test**: Entrada reveals the destination controls; confirmation writes the currently selected values and the existing offline flow continues to queue an operation.

### Tests

- [x] T006 [US2] Add failing tests for destination selection, explicit entry confirmation, selected payload values, back-preserved selections, error retention and success reset in `tests/unit/client/test_gate_entry_wizard.test.tsx`.

### Implementation

- [x] T007 [US2] Render unit, space type and area/sector selectors only on the entry-details step, including automatic/floating assignment, in `src/client/components/VehicleGatePanel.tsx`.
- [x] T008 [US2] Call the existing entry handler only from Confirmar entrada and preserve selected values on back or failure in `src/client/components/VehicleGatePanel.tsx`.
- [x] T009 [US2] Keep existing entry ticket, online/offline persistence, outbox enqueue and active-list refresh behavior in `src/client/components/VehicleGatePanel.tsx`.

## Phase 3: Polish & Cross-Cutting Concerns

- [x] T010 [P] Style the new step controls and actions with semantic tokens and 375 px layout rules in `src/client/index.css`.
- [x] T011 Run the focused tests, `npm run test:coverage`, `npm run typecheck`, `npm run lint`, `npm run build`, and `git diff --check`; correct any regressions in the affected source/test files.
- [ ] T012 Verify entry, exit, back navigation, error retention, offline behavior and 375 px layout in a real browser, then record observed results in `history/prompts/PHR-011-gate-entry-wizard.prompt.md`.
- [x] T013 Run `speckit-converge` against `spec.md`, `plan.md`, and completed tasks; append any remaining work without editing earlier tasks in `specs/008-gate-entry-wizard/tasks.md`.

## Dependencies & Execution Order

- T001 must demonstrate red before implementation tasks T002-T005.
- T006 adds the entry-specific red cases after the stage contract exists and before T007-T009.
- T010 follows the final markup from T002-T009. T011 and T012 follow all implementation and style tasks; T013 runs after implementation.
- No parallel source changes are planned because the flow and styles have a direct component/CSS dependency.

## Implementation Strategy

1. Complete US1 tests and implementation while preserving current exit/list behavior.
2. Complete US2 tests and implementation for entry-only destination review and explicit confirmation.
3. Add responsive styles, run the project verification gate, and walk the acceptance scenarios in a browser.
4. Reproduce the reported UUID compatibility failure, then implement the secure fallback and rerun all gates.

## Phase 4: Convergence

- [ ] T014 Verify the step flow and confirm no horizontal overflow at exactly 375 px in a real browser per FR-013 (partial).

## Phase 5: Compatibilidad de UUID

- [x] T015 [US2] Add a failing gate-entry regression test with Web Crypto `getRandomValues()` available and `randomUUID()` missing; assert an entry is submitted with a valid UUID v4 in `tests/unit/client/test_gate_entry_wizard.test.tsx`.
- [x] T016 [US2] Add and unit-test a shared secure UUID v4 generator with `randomUUID()` preference and `getRandomValues()` fallback in `src/core/utils/uuid.ts`; replace direct browser/client `crypto.randomUUID()` calls.
- [x] T017 Run focused test, full test coverage, typecheck, lint, build and diff checks; converge against spec/plan/tasks and record verification in `history/prompts/PHR-011-gate-entry-wizard.prompt.md`.
