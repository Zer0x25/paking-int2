# Tasks: Publicación de la PWA con Workers Static Assets

**Input**: Design documents from `specs/010-workers-static-assets/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/worker-assets-routing.md`, `quickstart.md`

**Tests**: Requested by the feature specification. Add and run regression tests before production configuration or asset changes, then verify with Wrangler locally.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the existing Vite, Worker and local verification contracts.

- [x] T001 Inspect `package.json`, `wrangler.toml`, `vite.config.ts` and `scripts/dev-worker.mjs` to record the build output and local port contract.
- [x] T002 Record the Workers Static Assets decision in `history/adr/ADR-016-workers-static-assets.md` and its index in `history/adr/README.md`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish reproducible spec-driven implementation artifacts before changing deploy configuration.

- [x] T003 Document the request/response contract and local verification procedure in `specs/010-workers-static-assets/contracts/worker-assets-routing.md` and `specs/010-workers-static-assets/quickstart.md`.

---

## Phase 3: User Story 1 - Probar la aplicación completa con Wrangler local (Priority: P1)

**Goal**: Serve the built SPA from the local Worker while keeping the API and current Vite development flow available.

**Independent Test**: Run the configuration contract test, build, then use Wrangler on 8787 to fetch `/`, an SPA route, a generated asset, and `/api/health`.

### Tests for User Story 1

- [x] T004 [P] [US1] Add configuration contract tests for the Assets directory, SPA fallback, compatibility flag, retired `[site]` section and build-first local/deploy scripts in `tests/unit/config/workers-assets.test.ts`.
- [x] T005 [US1] Run `npx vitest run tests/unit/config/workers-assets.test.ts` and record the expected RED result before editing `wrangler.toml` or `package.json`.

### Implementation for User Story 1

- [x] T006 [US1] Replace `[site]` with `[assets]` in `wrangler.toml`, using `./dist`, SPA fallback and the explicit navigation compatibility flag while preserving existing D1 bindings and compatibility date.
- [x] T007 [US1] Update `worker:dev` and `worker:deploy` in `package.json` to build the current Vite output before starting Wrangler.
- [x] T008 [US1] Run `npx vitest run tests/unit/config/workers-assets.test.ts` and record the GREEN result.

---

## Phase 4: User Story 2 - Mantener una separación clara entre archivos y API (Priority: P1)

**Goal**: Confirm that static delivery, SPA navigation and API errors remain distinct on one origin.

**Independent Test**: Open the integrated Wrangler Worker in a real browser, navigate directly to an SPA route, load an asset, and fetch the health and unknown API routes.

### Tests for User Story 2

- [x] T009 [US2] Build and start the local Worker through `npm run worker:dev`; verify HTTP status, content type and body for `/`, `/dashboard`, a generated asset, `/api/health` and `/api/ruta-inexistente` using `specs/010-workers-static-assets/contracts/worker-assets-routing.md`.
- [x] T010 [US2] Run the Vite HMR server and verify the app at 5173 continues proxying API calls to the Worker on 8787 without changing `vite.config.ts`.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Verify quality gates, upload packaging and traceable records without a remote deployment.

- [x] T011 Update `specs/010-workers-static-assets/quickstart.md`, `history/adr/ADR-016-workers-static-assets.md`, `history/adr/README.md` and `history/prompts/PHR-013-workers-static-assets.prompt.md` with final findings.
- [x] T012 Run `npm run build`, `npm test`, `npm run typecheck`, `npm run lint`, `npm audit` and `git diff --check` from the repository root.
- [x] T013 Run `./node_modules/.bin/wrangler deploy src/server/index.ts --dry-run` after the build and confirm Wrangler packages the files in `dist/` without contacting a remote database.
- [x] T014 Run convergence against `specs/010-workers-static-assets/spec.md`, `plan.md` and `tasks.md`; append any remaining work only to a final Convergence phase in `tasks.md`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup** and **Foundational**: Complete before TDD; their documentation and repository inspection are already recorded.
- **User Story 1**: T004 then T005 RED; only then T006 and T007; T008 GREEN follows the changes.
- **User Story 2**: Depends on the green configuration test; then verify the integrated Worker and Vite workflows.
- **Polish**: Depends on both stories and the local smoke test.

### User Story Dependencies

- **US1 (P1)**: Provides an integrated local Worker with a fresh static build.
- **US2 (P1)**: Depends on the configured Worker in US1 to verify API and SPA routing together.

### Parallel Opportunities

- T004 may be prepared independently from final ADR/PHR editing, but must run before the Wrangler configuration changes.
- The separate full test, typecheck, lint and audit commands in T012 can run independently after implementation.

## Implementation Strategy

1. Complete the feature docs and routing contract.
2. Add and run the configuration regression test until it fails against the legacy config.
3. Change only Wrangler asset routing and the build-before-Wrangler scripts.
4. Run the test again, then validate the integrated Worker and Vite HMR in a real browser.
5. Run repository gates and Wrangler dry-run; do not deploy remotely.

## Notes

- The local D1 binding remains local; never add `--remote` to validation commands.
- All tasks use repository-relative paths and task IDs. Tests must fail before implementation and pass afterward.

---

## Phase 6: Scope extension - completar los iconos PWA

**Purpose**: Corregir las referencias de icono ausentes detectadas al comprobar Assets, y evitar publicar una compilación que anuncie recursos inexistentes.

### Tests (Red/Green)

- [x] T015 Add a PWA asset contract test that derives paths from `index.html` and `vite.config.ts`, then checks source existence, SVG/ICO/PNG signatures and required PNG dimensions; run it first and record the expected RED result.

### Implementation

- [x] T016 Add brand-consistent `favicon.svg`, `favicon.ico`, `mask-icon.svg`, `apple-touch-icon.png`, `icon-192.png` and `icon-512.png` under `public/`; make the contract test pass without a runtime dependency.

### Verification and records

- [x] T017 Build and verify all six icon resources in `dist/` and through the local Worker with status 200, matching MIME types and expected dimensions; verify the generated PWA manifest points to existing assets.
- [x] T018 Update the quickstart, contract, ADR/PHR evidence and run the required repository quality gates, coverage and Wrangler dry run. Do not deploy remotely.
