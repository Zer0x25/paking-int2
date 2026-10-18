---
description: "Ordered implementation backlog for Cloudflare production readiness"
---

# Tasks: Cloudflare Production Readiness

**Input**: Design documents from `specs/012-cloudflare-production-readiness/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: Required by the approved feature scope and repository constitution. Every code change starts with a failing test.

**Priority order**: P1 release safety → P1 quality/recovery process → P2 diagnostics/observability → final cross-cutting gates.

## Phase 1: Setup

**Purpose**: Confirm toolchain and named feature inputs without touching Cloudflare.

- [x] T001 Confirm local Wrangler 4.151.1, npm lockfile, and existing local-only `worker:dev`/D1 scripts before changing release configuration in `package.json` and `wrangler.toml`.

## Phase 2: Foundational

**Purpose**: No shared runtime foundation changes are required; each user story adds its own tests before implementation.

## Phase 3: User Story 1 - Safe production release (Priority: P1)

**Goal**: Local, staging, and production targets are explicit; incomplete remote targets cannot deploy.

**Independent Test**: Unit tests prove local config stays local, staging/production have isolated bindings, placeholders fail local preflight without running Wrangler, and missing remote secret names fail before the deploy command.

### Tests for User Story 1

- [x] T002 [US1] Update `tests/unit/config/workers-assets.test.ts` to expect compatibility date `2026-10-18` and add failing assertions for named environments, separate D1/DO bindings, required secrets, source maps, and observability.
- [x] T003 [US1] Add failing unit tests in `tests/unit/config/worker-deployment.test.ts` for unknown targets, missing env blocks, placeholder/malformed or duplicate D1 IDs, duplicate Worker names, wrong environment values, invalid hostname mode, missing DO migration/binding, missing secret names, and fail-before-network preflight behavior.
- [x] T004 [US1] Add failing runner-order tests in `tests/unit/config/worker-release.test.ts` proving the release validates local config, builds, lists secret names, and deploys only after all required names exist; assert secret values are never emitted.

### Implementation for User Story 1

- [x] T005 [US1] Add isolated `staging` and `production` sections with nonfunctional D1 ID placeholders, target-specific `ENVIRONMENT`, D1 and Durable Object bindings/migrations, workers.dev mode, required secret names, and compatibility date `2026-10-18` in `wrangler.toml`.
- [x] T006 [US1] Implement local-only target validation with actionable errors and no child process or network access in `scripts/deploy/validate-environment.mjs`.
- [x] T007 [US1] Implement staged release execution that checks remote secret names and then invokes `wrangler deploy --env <target>` in `scripts/deploy/release.mjs`.
- [x] T008 [US1] Replace the ambiguous `worker:deploy` package script with explicit `worker:preflight:staging`, `worker:preflight:production`, `worker:deploy:staging`, `worker:deploy:production`, and local `worker:dry-run` commands in `package.json`.
- [x] T009 [US1] Regenerate `worker-configuration.d.ts` from the final Wrangler config with project-local `npx wrangler types` and keep the generated file synchronized with configured bindings.

**Checkpoint**: Both local preflight commands identify the placeholder IDs without network access, and development still uses local D1.

## Phase 4: User Story 2 - Verified deployment process (Priority: P1)

**Goal**: Pull requests expose complete quality gates and maintainers have repeatable staging, migration, smoke-check, and recovery instructions.

**Independent Test**: Inspect the workflow for all required jobs and no deployment step; follow `docs/cloudflare-deployment.md` to identify target, D1 migration state, secrets, hostname, smoke checks, and separate code/data recovery steps.

### Tests for User Story 2

- [x] T010 [US2] Add failing workflow contract tests in `tests/unit/config/ci-workflow.test.ts` requiring coverage, typecheck, lint, npm audit, build, local Wrangler dry-run, and no Cloudflare deployment command.

### Implementation for User Story 2

- [x] T011 [US2] Update `.github/workflows/agentic-factory-dod.yml` to install the locked npm dependencies and run `npm run test:coverage`, `npm run typecheck`, `npm run lint`, `npm audit`, `npm run build`, and `npm run worker:dry-run` without Cloudflare credentials or deployment.
- [x] T012 [US2] Add `docs/cloudflare-deployment.md` with isolated D1/Worker setup, per-environment secret provisioning, pending migration review/application, workers.dev smoke checks, compatibility-date policy, and exact target-specific commands.
- [x] T013 [US2] Add the rollback and recovery section to `docs/cloudflare-deployment.md`, distinguishing Worker version rollback from D1 Time Travel restore, stating the 7-day Workers Free retention and supported-storage check, with staging rehearsal and destructive-restore cautions.
- [x] T014 [US2] Link the deployment/recovery runbook and local release validation commands from `README.md` without changing local development instructions.

**Checkpoint**: CI runs the full repository gates but never deploys; a maintainer can tell what Cloudflare inputs remain absent.

## Phase 5: User Story 3 - Diagnose production failures safely (Priority: P2)

**Goal**: Unexpected failures are useful to maintainers and generic to users, with privacy-safe structured logs and source-mapped Worker traces.

**Independent Test**: Force uncaught, login-configuration, read, write, and real-time binding failures; assert generic 500/503 responses where appropriate and structured logs without request data or secrets.

### Tests for User Story 3

- [x] T015 [US3] Update `tests/unit/server/test_server_api.test.ts` and add failing cases in `tests/unit/server/test_generic_server_errors.test.ts` for generic 500 responses from uncaught, login, read, write, and real-time binding failures; assert private API responses remain `no-store` and intentional 4xx business errors stay readable.
- [x] T016 [US3] Add failing tests in `tests/unit/server/test_request_logging.test.ts` for JSON request/error log fields, path without query, and exclusion of bodies, authorization, cookies, plates, and session data.

### Implementation for User Story 3

- [x] T017 [US3] Implement shared structured internal error logging and a generic 500 envelope in `src/server/routes/http-errors.ts`; update `src/server/index.ts`, `src/server/routes/auth.ts`, `src/server/routes/realtime.ts`, `src/server/middleware/auth.ts`, and route error helpers to avoid returning internal exception messages.
- [x] T018 [US3] Add a structured request logging middleware in `src/server/middleware/request-logging.ts` and use it from `src/server/index.ts` instead of Hono's unstructured logger, excluding query strings and request/response bodies.
- [x] T019 [US3] Configure production/staging sampling, Workers Logs, Traces, and Wrangler Worker source-map upload in `wrangler.toml`; ensure maps are generated for the Worker bundle and stay out of public `dist` assets.

**Checkpoint**: All expected user-facing business conflicts stay readable while unexpected server errors remain generic and diagnosable.

## Phase 6: Polish and cross-cutting validation

**Purpose**: Close traceability, validate the complete feature, and identify remaining account-specific blockers.

- [x] T020 [P] Update `specs/012-cloudflare-production-readiness/quickstart.md` with final command names and expected missing-ID/secret behavior.
- [x] T021 [P] Update `history/adr/ADR-019-cloudflare-release-environments.md` and `history/prompts/PHR-016-cloudflare-production-readiness.prompt.md` with final outcomes and checks, keeping external prerequisites explicit.
- [x] T022 Run `npm run test:coverage`, `npm run typecheck`, `npm run lint`, `npm audit`, `npm run build`, `npm run worker:dry-run`, and `git diff --check`; confirm both preflight commands fail closed on the placeholder IDs without network access, then record actual outcomes in PHR-016.
- [x] T023 Add `docs/cloudflare-release-checklist.md`, link it from the runbook, and list unresolved Cloudflare inputs (staging/production D1 IDs, required secret names/values, Workers hostname/custom domain, account access) without marking the deployment production-ready.

## Dependencies & Execution Order

### Phase Dependencies

- **Setup**: complete before implementation; local-only inspection.
- **Foundational**: no code changes required.
- **US1**: configuration/release safety is the MVP and precedes CI release packaging.
- **US2**: depends on the final command interface from US1.
- **US3**: depends on named environment configuration from US1; code changes remain separately testable.
- **Polish**: depends on US1, US2, and US3.

### User Story Dependencies

- **US1 (P1)**: independent MVP; establish target isolation and release preflight first.
- **US2 (P1)**: depends on US1's stable script names; no Cloudflare deployment required.
- **US3 (P2)**: depends on named environments for telemetry config; no app business logic changes.

### Parallel Opportunities

- After T002-T004 have each been demonstrated red, their test files are independent and can be authored in parallel before any production change.
- T012-T013 share `docs/cloudflare-deployment.md` and remain sequential; T014 only links the final path.
- T015 and T016 modify separate test files and can be authored in parallel. T017 and T018 touch `src/server/index.ts`, so implementation remains sequential.
- T020 and T021 touch separate documentation/history files and can run in parallel after behavior stabilizes.

## Implementation Strategy

1. Deliver **US1 first**: fail-closed environment selection and explicit deploy targets. This is the highest-risk release blocker.
2. Deliver **US2 next**: make CI catch regressions and document how to provision/recover a staged release.
3. Deliver **US3**: close the server error disclosure and add telemetry before any real traffic.
4. Run all required local gates and leave the repository uncommitted. Cloudflare account setup, remote migration, DNS, and deployment require a later authorized operation.
