# Tasks: Sistema visual adaptable para Smart Parking

**Input**: Design documents from `specs/006-responsive-design-system/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/ui-system.md`, `design-system.md`, `quickstart.md`

**Tests**: TDD is required by the project constitution. Add behavior tests first and confirm they fail before implementation. CSS layout and browser interactions require real-browser verification.

**Organization**: Tasks are grouped by user story so each increment can be verified independently.

## Phase 1: Setup

**Purpose**: Establish the shared, reviewable visual reference.

- [x] T001 Document color roles, type, spacing, interaction patterns, accessibility targets, and responsive ranges in `specs/006-responsive-design-system/design-system.md`.
- [x] T002 Install ESLint and `typescript-eslint`, configure flat rules for TypeScript/TSX/JavaScript, add `npm run lint`, and verify ignore patterns in `eslint.config.mjs`, `package.json`, and `package-lock.json`.

---

## Phase 2: Foundational

**Purpose**: Provide shared semantic tokens used by every story.

- [x] T003 [P] Add a failing token contract test for required light/dark roles and minimum contrast pairs in `tests/unit/client/test_design_tokens.test.ts`.
- [x] T004 Define the semantic light/dark CSS variables and compatibility aliases in `src/client/styles/design-tokens.css`, import them from `src/client/index.css`, and make page/native control colors consume the selected scheme.

**Checkpoint**: The shared palette resolves for both themes before theme-specific UI and responsive adjustments begin.

---

## Phase 3: User Story 1 - Elegir y conservar el tema visual (Priority: P1)

**Goal**: Start in system mode, allow Sistema/Claro/Oscuro, persist the selection locally, and apply changes without reload across login and authenticated views.

**Independent Test**: Run theme preference and selector unit tests; in a browser, change each option, reload, and change the device preference while Sistema is selected.

### Tests for User Story 1

- [x] T005 [P] [US1] Write tests for default/system resolution, valid and invalid stored values, explicit selection, storage failures, and system change notifications in `tests/unit/client/test_theme_preference.test.ts`.
- [x] T006 [P] [US1] Write static-render tests for the accessible Tema visual selector and its exact Sistema/Claro/Oscuro options in `tests/unit/client/test_theme_selector.test.tsx`.

### Implementation for User Story 1

- [x] T007 [US1] Implement validated `system | light | dark` preference read/write, effective-theme resolution, and system preference subscriptions in `src/client/utils/theme-preference.ts`.
- [x] T008 [US1] Implement shared theme state/provider and accessible Tema visual selector in `src/client/components/ThemeProvider.tsx` and `src/client/components/ThemeSelector.tsx`.
- [x] T009 [US1] Add a defensive pre-render theme bootstrap and color-scheme metadata to `index.html` using the same storage key and effective-theme rules as the client.
- [x] T010 [US1] Wrap the client with the theme provider and add the selector to the login view and authenticated header in `src/client/main.tsx`, `src/client/App.tsx`, and `src/client/components/LoginView.tsx`.
- [x] T011 [US1] Style the selector, selected option, focus, disabled state, and theme transitions with semantic tokens in `src/client/index.css`.

**Checkpoint**: Theme choice persists and updates all rendered views immediately, including login and the shared application frame.

---

## Phase 4: User Story 2 - Operar las vistas principales desde un móvil (Priority: P1)

**Goal**: Preserve all existing operations and information in Garita, Dashboard, and Configuración from 375 px, with usable reflow at 320 px and desktop composition at 1280 px.

**Independent Test**: Use a real browser at 375x812 to complete Garita entry/edit/exit, review Dashboard, and use Configuration forms/lists; repeat at 320 px and 1280 px and confirm no page-level horizontal overflow or clipped primary actions.

### Implementation for User Story 2

- [x] T012 [US2] Refactor the shared header, facility label, account actions, navigation, and main content wrappers for narrow screens in `src/client/App.tsx` and `src/client/index.css`.
- [x] T013 [US2] Adapt the operation selector, entry form, active vehicle rows, plate editing, and exit actions to 375 px touch use in the gate forms and `src/client/index.css`.
- [x] T014 [US2] Make Dashboard metric cards, area occupancy cards, quota cards, headings, and loading/empty states reflow without fixed minimum widths in `src/client/components/OperationalDashboard.tsx` and `src/client/index.css`.
- [x] T015 [US2] Make Configuration area, unit, and event forms, records, dialogs, and action groups fit the mobile content width in `src/client/components/FacilityConfigView.tsx`, `src/client/components/BusinessUnitManager.tsx`, `src/client/components/EventBookingsManager.tsx`, and `src/client/index.css`.
- [x] T016 [US2] Verify mobile and desktop acceptance scenarios against the real browser at 375x812, 320x700, and 1280x800; record any correction in the affected view files.

**Checkpoint**: Each view is operable at 375 px without page-level horizontal scrolling or hidden primary actions, and remains usable at 320 px and 1280 px.

---

## Phase 5: User Story 3 - Reconocer un lenguaje visual común (Priority: P2)

**Goal**: Use consistent semantic colors, typography, surfaces, controls, and states in login, Garita, Dashboard, Configuración, and shared status UI.

**Independent Test**: Compare equivalent buttons, fields, panels, labels, alerts, and states in both themes; verify all theme-bound UI uses semantic roles and retains the same visual hierarchy.

### Implementation for User Story 3

- [x] T017 [US3] Replace dark-only and inline palette values with shared semantic roles for operation cards, active vehicle list, messages, and tickets in the gate forms and `src/client/index.css`.
- [x] T018 [US3] Replace hard-coded colors and style-only presentation with semantic dashboard roles for metrics, progress bars, area cards, quota cards, and badges in `src/client/components/OperationalDashboard.tsx` and `src/client/index.css`.
- [x] T019 [US3] Replace dark-only colors and inline palette values with semantic roles for facility/area, unit, event, confirmation dialog, and feedback states in `src/client/components/FacilityConfigView.tsx`, `src/client/components/BusinessUnitManager.tsx`, `src/client/components/EventBookingsManager.tsx`, and `src/client/index.css`.
- [x] T020 [US3] Apply semantic status, button, and surface tokens to sync feedback and login messages in `src/client/components/SyncStatusBar.tsx`, `src/client/components/LoginView.tsx`, and `src/client/index.css`.
- [x] T021 [US3] Audit rendered foreground/background pairs and adjust token values or usage until ordinary text is at least 4.5:1 and large text/essential graphics are at least 3:1 in both themes; record checked pairs in `specs/006-responsive-design-system/design-system.md`.

**Checkpoint**: All in-scope surfaces share one visual language and remain readable in light and dark themes.

---

## Phase 6: User Story 4 - Usar la interfaz con accesibilidad básica (Priority: P2)

**Goal**: Support keyboard, screen-reader naming, visible focus, touch targets, and reduced motion across the shared controls and principal views.

**Independent Test**: Navigate the login, theme selector, app navigation, Garita actions, and Configuration forms with keyboard and touch at 375 px; inspect accessible names, focus, control dimensions, status announcements, and reduced-motion behavior.

### Tests for User Story 4

- [x] T022 [P] [US4] Extend static-render tests to assert the theme selector label, selected value, and keyboard-operable native select semantics in `tests/unit/client/test_theme_selector.test.tsx`.

### Implementation for User Story 4

- [x] T023 [US4] Add persistent `:focus-visible` styles, minimum 44x44 px targets for principal controls, and `prefers-reduced-motion` rules in `src/client/index.css`.
- [x] T024 [US4] Ensure the login fields, app navigation, theme selector, and primary operations expose accessible names and state semantics in `src/client/components/LoginView.tsx`, `src/client/App.tsx`, and the gate forms.
- [x] T025 [US4] Complete keyboard, focus, touch-target, and reduced-motion checks in a real browser at 375 px and correct any failures in the relevant files under `src/client/`.

**Checkpoint**: Main interactions can be reached and understood by keyboard, touch, and assistive technology in both themes.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Verify the whole feature and preserve project quality gates.

- [x] T026 [P] Update `specs/006-responsive-design-system/quickstart.md` with the final theme control and viewport verification flow if implementation details differ.
- [x] T027 Run `npm run lint`, `npm run test:coverage`, `npm run typecheck`, `npm run build`, `npm audit`, and `git diff --check`; resolve regressions without reducing the required 85% coverage threshold.
- [x] T028 Record implementation findings, actual test results, browser evidence, remaining UX reviewer checks, and commit status in `history/prompts/PHR-008-responsive-design-system-implementation.prompt.md`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Design-system reference is established.
- **Foundational (Phase 2)**: Token contract test is written before token CSS; shared roles block user-story styling.
- **User Stories (Phases 3–6)**: Depend on semantic tokens. US2 navigation integration depends on the common header changes in US1; US3 consumes token roles; US4 finishes shared interaction semantics.
- **Polish (Phase 7)**: Depends on all four stories.

### User Story Dependencies

- **US1 (P1)**: Starts after tokens; theme preference and selector are independent of business operations.
- **US2 (P1)**: Starts after tokens and shares the header/layout prepared by US1; it does not depend on US3 palette cleanup.
- **US3 (P2)**: Starts after tokens; it completes semantic-color adoption across in-scope components.
- **US4 (P2)**: Starts after the selector and shared controls exist; checks and corrections apply across all views.

### Parallel Opportunities

- T003 token tests and T005/T006 theme tests can be authored in parallel before their implementation tasks.
- After shared tokens/provider/header exist, Dashboard layout work (T014) and Configuration reflow work (T015) touch different view components and can be developed independently.
- Semantic palette cleanup for Dashboard (T018) and sync/login (T020) touch different component files, though both share CSS coordination and should be merged sequentially if both edit `index.css`.
- T022 selector assertions and independent browser viewport checks can be prepared separately once the selector contract is stable.

## Parallel Example: User Story 2

```text
Task: T014 Dashboard reflow in OperationalDashboard.tsx and its CSS rules
Task: T015 Configuration reflow in FacilityConfigView.tsx, BusinessUnitManager.tsx, EventBookingsManager.tsx
```

## Implementation Strategy

### MVP First

1. Complete shared token roles (Phase 2).
2. Complete US1 theme selection and persistence (Phase 3).
3. Verify the theme in isolation before starting the responsive views.

### Incremental Delivery

1. Add US2 mobile operation for all three requested views.
2. Add US3 full semantic palette adoption in both themes.
3. Add US4 interaction and accessibility refinements.
4. Run the full verification and browser walkthrough.

## Notes

- Every implementation task names its target file paths.
- CSS layout has real-browser acceptance criteria; unit tests alone do not count as layout verification.
- Commit automation hooks in `.specify/extensions.yml` are optional; no new-feature commit is performed unless separately requested.
