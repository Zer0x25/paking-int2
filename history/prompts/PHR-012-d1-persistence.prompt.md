---
id: PHR-012
stage: feature-design
date: 2026-10-17
branch: 009-d1-persistence
command: interactive continuation of D1 integration
model: Codex GPT-6
---

# PHR-012: Persistencia local en D1

## Prompt del usuario

> que sigue la integracion de la DB?
>
> continua

## Aclaraciones del usuario

- Bootstrap local: usar `.dev.vars`, ignorado por Git.
- Autenticación local: validar credenciales desde `.dev.vars`; guardar en D1 la identidad y el rol, pero no guardar contraseñas ni hashes.

## Decisiones de diseño

- Sustituir los almacenes en memoria del Worker por repositorios D1/Drizzle y migraciones SQL de Wrangler aplicadas únicamente a D1 local.
- Mantener IndexedDB y su outbox como persistencia offline; las operaciones confirmadas y sus auditorías/recibos se guardan de forma atómica e idempotente.
- Sembrar el catálogo de desarrollo solo cuando esté vacío; no resetear ni sobrescribir la base local existente.
- Leer `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `OPERATOR_USERNAME`, `OPERATOR_PASSWORD` y `JWT_SECRET` desde `.dev.vars`; retirar defaults de código y accesos rápidos con credenciales.
- No crear ni migrar una base productiva, cambiar credenciales productivas ni desplegar.
- La autenticación productiva queda para una decisión aparte. Cloudflare documenta 10 ms de CPU por solicitud en Workers Free; los límites y la cobertura local no bastan para afirmar que un KDF de contraseña sería compatible con ese plan.
- La cobertura de pruebas Workers usará instrumentación Istanbul; Cloudflare documenta que la cobertura V8 nativa no está soportada por su integración Vitest.

## Artefactos preparados

- Especificación Draft, clarificaciones y criterios medibles: `specs/009-d1-persistence/spec.md`.
- Plan, decisiones investigadas, modelo de datos, contratos, quickstart, checklist de requisitos y 52 tareas: `specs/009-d1-persistence/`.
- ADR-014 propuesto e indexado; queda pendiente de aceptación junto con el diseño.
- Análisis cruzado: 15 requisitos funcionales y 7 criterios de éxito con tareas asociadas; 100% de cobertura de tareas, sin hallazgos críticos ni referencias fuera de ruta no previstas.
- La tarea T001 es una puerta de aprobación explícita y precede cualquier prueba roja o cambio de código.

## Aprobación del diseño

- El usuario aprobó explícitamente la especificación y el plan para comenzar TDD el 2026-10-17. Se aceptó ADR-014 y la tarea T001 antes de redactar pruebas o código.

## Estado y siguiente paso

- No se modificó código de producción y no se ejecutaron pruebas.
- La verificación de preparación de Spec Kit devolvió la feature `009-d1-persistence`; `git diff --check` no reportó errores.
- La especificación permanece Draft hasta que el usuario apruebe el diseño. Después, las pruebas se redactarán primero en un contexto separado que reciba solo especificación y contratos, según la Constitución del repositorio.
- No se creó un `.dev.vars` real ni se registraron valores de credenciales; la plantilla solo documentará nombres de variables vacíos para que el usuario configure los suyos localmente.
- No se hizo commit.

## Worker test-author RED checkpoint

- Command: `npx vitest run --config vitest.workers.config.ts tests/workers/d1-foundation.worker.test.ts`
- Result before production changes: exit code 1; 1 test file and 4 tests failed.
- Evidence: no migration SQL files were present for the test fixture to apply; the `facilities` table was absent; installing an audit failure trigger failed because `audit_logs` was absent; and a facility create returned HTTP 201 after the Worker test environment's `PARKING_DB` binding was set to `undefined`, demonstrating the current memory fallback.
- Harness limitation: Worker Vitest did not expose `.dev.vars` values in its `env` binding, so foundation tests avoid credential-dependent login. The write-failure route assertion is blocked until the migration creates `audit_logs`; rerun after the migration lands.

## Sync and authentication test-author RED checkpoint

- Command: `npx vitest run --config vitest.workers.config.ts tests/workers/sync-persistence.worker.test.ts tests/workers/auth-persistence.worker.test.ts`
- Result before route implementation: exit code 1; 2 test files, 7 tests total; 6 failed and 1 passed.
- Sync tests cover durable delta receipts and replay, changed-payload ID reuse, stale versions, business conflicts, and audit rollback. All three stopped at the configured operator login, which returned HTTP 401 because the current login does not accept the ephemeral Worker test bindings; no sync mutation assertion was reached.
- Auth tests cover both-role bootstrap, repeat login, password-free D1 identity, invalid-login indistinguishability, each missing local variable, missing D1, and role checks. The wrong-password/unknown-user equivalence test passed; bootstrap, missing-configuration diagnostics, and missing-D1 fail-closed assertions failed against current behavior. The role checks were not reached after missing-D1 login returned 401.
- Test credentials and signing keys are generated ephemerally in the Worker test runtime; no `.dev.vars` values were read or emitted.

## Foundation and persistence test-author update

- Updated `tests/workers/support/d1-fixture.ts` to apply complete migration statements through D1 `exec`, and corrected the `cloudflare:workers` default-export bridge typing. `npm run typecheck` passed (`tsc --noEmit && tsc --noEmit -p tsconfig.workers.json`, exit 0).
- Foundation rerun: `npx vitest run --config vitest.workers.config.ts tests/workers/d1-foundation.worker.test.ts` returned exit 1 with 2 tests passing and 2 failing. The schema/index smoke and non-destructive migration replay passed; the missing-D1 write and forced audit-write failure still returned HTTP 201, exposing the memory fallback.
- Sync rerun after using an ephemeral HS256 operator token: `npx vitest run --config vitest.workers.config.ts tests/workers/sync-persistence.worker.test.ts` returned exit 1; all 3 tests reached business assertions and failed. Identical replay did not return the stored successful result, the successful-looking operation had no `parking_sessions` D1 row, and an audit-trigger failure still returned HTTP 200. These were no longer blocked by login HTTP 401.
- Configuration/session RED command: `npx vitest run --config vitest.workers.config.ts tests/workers/configuration-persistence.worker.test.ts tests/workers/session-persistence.worker.test.ts` returned exit 1 (2 files, 4 tests, all 4 failed). Authentication succeeded using test-runtime-generated HS256 tokens and Worker responses were HTTP 200/201/409 as expected by the contracts; failures were business assertions:
  - Configuration facility update returned HTTP 200 but the facility row was absent from D1 (`persistedFacility` was null).
  - A triggered audit insert failure during a configuration write still returned HTTP 201 instead of a server error.
  - Session entry returned HTTP 201 but its D1 row was absent (`persistedEntry` was null).
  - A second distinct active session was accepted with HTTP 201 when facility capacity was already full; expected HTTP 409.
- Category coverage follows the available public API: the test checks repeated facility catalog reads and a fixture category, but there is no category mutation endpoint in the approved contract, so create/update/status mutation coverage is unavailable and no endpoint was invented. The first persistence assertion currently stops that test before the catalog-read assertions; those assertions will run once facility writes persist.
- T004 CLI initialization remains a testability gap: no safe public CLI behavior/help contract was available for a non-destructive initializer test, so no initializer test was added.
- Auth rerun: `npx vitest run --config vitest.workers.config.ts tests/workers/auth-persistence.worker.test.ts` returned exit 1 (4 tests: 1 passed, 3 failed). The test harness reached `/api/auth/login` with generated ephemeral credentials; the configured-identity success assertion received HTTP 401 instead of 200, missing-variable diagnostics returned the generic login error instead of naming `ADMIN_USERNAME`, and login with `PARKING_DB` removed returned 401 instead of failing with HTTP 5xx. These are contract assertions against the auth feature behavior, not a Worker token/login-helper setup failure; the role authorization continuation was not reached after the expected fail-closed assertion failed.
- Final test-author typecheck rerun after the fixture and test updates: `npm run typecheck` passed (exit 0).

## Resultados de implementación y verificación — 2026-10-17

- Se completó la persistencia del Worker en Cloudflare D1 mediante migración SQL, repositorios Drizzle tipados, escrituras transaccionales/versionadas y recibos idempotentes para sincronización. IndexedDB y su cola offline permanecen en el cliente.
- La autenticación local valida las cinco variables documentadas en `.dev.vars`, guarda identidad y rol en D1 y no persiste contraseñas ni hashes. El archivo real `.dev.vars` no existe en este checkout; no se crearon ni registraron secretos.
- Inicialización local probada en un directorio D1 temporal nuevo: aplicó `0001_initial_persistence.sql` y el catálogo base. Al repetirla no reaplicó migraciones ni reemplazó una modificación previa de la instalación (nombre actualizado y versión 2 preservados). No se tocó el estado Wrangler existente ni se usó `--remote`.
- `npm run test:coverage`: unitarias, 24 archivos y 143 pruebas; 94.35% sentencias, 88.76% ramas, 90.98% funciones y 95.29% líneas. Worker, 7 archivos y 25 pruebas; 89.87% sentencias, 85.19% ramas, 90.47% funciones y 92.65% líneas. Ambos proyectos superaron los umbrales configurados de 85%.
- Verificación final: `npm run build`, `npm run typecheck`, `npm run lint`, `npm audit` y `git diff --check` finalizaron con código 0. `npm audit` reportó cero vulnerabilidades; no quedan marcadores `TODO:` o `FIXME:` en `src`.
- Revisión de navegador en `http://localhost:5173/`: la app cargó y mostró la garita. La cabecera informa que falta `JWT_SECRET` en `.dev.vars` y que se muestran datos locales; por eso no se pudo completar el ingreso real de administrador/operador ni verificar en navegador las vistas autenticadas, persistencia tras reinicio y sincronización offline. Las rutas y restricciones de ambos roles sí tienen cobertura automatizada Worker.
- Convergencia: revisados 15 requisitos funcionales, 7 criterios de éxito, 12 escenarios de aceptación, 7 casos límite y controles constitucionales. Resultado: un hallazgo parcial de severidad alta, únicamente la verificación autenticada en navegador condicionada a credenciales locales privadas. Se agregó append-only T053 en fase 8 de `tasks.md` para completar esa comprobación después de configurar `.dev.vars`.
- Los cambios permanecen sin commit. No se creó ni modificó base productiva, no se cambiaron credenciales productivas y no se desplegó la app.
