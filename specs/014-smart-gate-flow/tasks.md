# Tasks: Flujo inteligente de patente en Garita

**Input**: Design documents in `specs/014-smart-gate-flow/`

**Prerequisites**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/gate-flow-ui.md`, `quickstart.md`

**Tests**: Explicitly requested by the user and required by the project Constitution. All new tests must be authored and shown failing before any production edits.

**Organization**: The existing app, test harness, and dependencies are already configured; no setup, database, or API work is needed. A shared red-test phase comes first so both stories have tests before either production story is implemented.

## Phase 1: Setup

**Purpose**: Shared infrastructure

No setup tasks are required. The Vite/React client, Vitest/Testing Library, active-session model, and development commands already exist.

## Phase 2: Red Test Baseline

**Purpose**: Define both user stories from the approved spec and UI contract, then demonstrate failure before production changes.

- [X] T001 Add or update US1 interaction tests for loading, exact active plate showing only exit, unmatched valid plate showing only entry, removal of the generic Registrar/movement step, entry destination confirmation, and error preservation in `tests/unit/client/test_gate_entry_wizard.test.tsx`.
- [X] T002 Add or update US2 tests for current-facility normalized prefix results, five-result cap, suggestion detail, keyboard selection/Escape, and no request per keystroke in `tests/unit/client/test_gate_entry_wizard.test.tsx`.
- [X] T003 Run the focused gate suite and record that the new smart-flow expectations fail before production edits in `tests/unit/client/test_gate_entry_wizard.test.tsx`.

## Phase 3: User Story 1 - Detectar el movimiento válido (Priority: P1)

**Goal**: Infer the only valid movement from the current facility's active sessions and keep entry confirmation and exit explicit.

**Independent Test**: A complete active plate exposes only `Registrar salida`; a valid unmatched plate exposes only `Registrar entrada`; loading shows no decision; entry still requires destination confirmation.

### Implementation

- [X] T004 [US1] Replace the generic movement step with an exact-active-session decision using existing normalized plate helpers and current facility sessions in `src/client/components/VehicleGatePanel.tsx`.
- [X] T005 [US1] Route the explicit active-session exit action through the existing session-specific quick-exit handler and preserve the entry details/back/error states in `src/client/components/VehicleGatePanel.tsx`.

**Checkpoint**: US1 passes its focused tests while retaining online/offline operation behavior.

## Phase 4: User Story 2 - Buscar vehículos activos mientras se escribe (Priority: P1)

**Goal**: Search active vehicles locally as the operator types, with a short accessible suggestion list.

**Independent Test**: Typing a normalized prefix shows at most five current-facility active matches; keyboard selection fills the plate; search creates no network requests.

### Implementation

- [X] T006 [US2] Add combobox/listbox semantics, active option state, Arrow Up/Down, Enter, Escape, and suggestion vehicle context in `src/client/components/VehicleGatePanel.tsx`.
- [X] T007 [US2] Style the suggestion list, selected option, loading/search state, and touch-sized actions for narrow layouts in `src/client/index.css`.

**Checkpoint**: US1 and US2 pass independently and together at desktop and 375 px widths.

## Phase 5: Polish & Cross-Cutting Validation

**Purpose**: Run the project gates and verify the interaction in a real browser.

- [X] T008 Run `npm test`, `npm run test:coverage` (85% unit and Worker thresholds), `npm run typecheck`, `npm run lint`, and `npm run build`; fix only feature-scoped failures in `src/client/components/VehicleGatePanel.tsx`, `src/client/index.css`, or `tests/unit/client/test_gate_entry_wizard.test.tsx`.
- [X] T009 Verify active exit, unmatched entry, suggestions, keyboard navigation, and 375 px layout in the local browser; record observable results in `history/prompts/PHR-023-smart-gate-flow.prompt.md`.

## Dependencies & Execution Order

### Phase Dependencies

- Setup is already satisfied by the repository.
- Red Test Baseline must complete before any production change.
- US1 depends on the red test baseline; US2 builds on the same plate decision state and follows US1.
- Validation depends on both user stories.

### Parallel Opportunities

- T001 and T002 edit the same test file and must run sequentially.
- T004/T005 edit the same component and must run sequentially.
- T006 follows US1 in the same component; T007 can start after the suggestion markup in T006 exists.
- No task needs a separate Worker or database change.

## Implementation Strategy

1. Complete all story tests and demonstrate Red.
2. Implement US1 movement inference and keep the existing entry/exit handlers.
3. Implement US2 local suggestions and keyboard/accessibility behavior.
4. Run the full verification gates and real-browser check.
