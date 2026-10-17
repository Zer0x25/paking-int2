# Tasks: Operación unificada de Garita

**Input**: Design documents from `specs/005-gate-operations/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/parking-operations.md`

## Phase 1: TDD Red — contratos observables

**Purpose**: Definir comportamiento desde la especificación y demostrar fallos antes de cambiar producción.

- [x] T001 [P] [US4] Agregar pruebas de formato/patente para seis caracteres, agrupación, entradas compactas/con guiones, longitud inválida y duplicidad en `tests/unit/core/test_parking_session.test.ts`.
- [x] T002 [P] [US2,US3] Agregar pruebas API de listado ordenado, autenticación, salida por ID, versión obsoleta, corrección activa, duplicados y auditoría en `tests/unit/server/test_parking_operations.test.ts`.
- [x] T003 [P] [US2,US3] Agregar pruebas de mutaciones de salida/corrección offline, lectura de sesiones activas y resolución del outbox en `tests/unit/client/test_gate_sessions.test.ts` y `tests/unit/client/test_outbox_sync.test.ts`.
- [x] T004 [P] [US1,US2,US3,US4] Agregar pruebas del selector Entrada/Salida, lista vacía/activa, salida rápida, edición activa y formato visible en `tests/unit/client/test_vehicle_gate_panel.test.tsx`.
- [x] T005 Demostrar rojo ejecutando las pruebas nuevas antes de editar producción y registrar el resultado en el PHR.

## Phase 2: Dominio y esquemas

**Purpose**: Establecer formato canónico y transiciones seguras por sesión.

- [x] T006 [US4] Implementar normalización compacta, presentación `XX-XX-XX`, aceptación exacta de seis alfanuméricos y validación compartida en `src/core/models/parking-session.ts` y `src/core/types/schema.ts`.
- [x] T007 [US3] Implementar regla pura para corregir patente activa, rechazar duplicados y verificar `expectedVersion` sin modificar hora ni asignaciones en `src/core/models/parking-session.ts`.
- [x] T008 [US4] Ejecutar pruebas de dominio y confirmar verde para las combinaciones alfanuméricas y transiciones de versión.

## Phase 3: Sesiones API, permisos y auditoría

**Purpose**: Ofrecer salidas/correcciones por sesión, proteger los recursos operativos y registrar cambios.

- [x] T009 [US2,US3] Añadir esquema/versionado para salida por ID y corrección de patente en `src/core/types/schema.ts`.
- [x] T010 [US2,US3] Proteger las rutas de sesión con autenticación operativa, devolver solo sesiones activas ordenadas y añadir salida por ID/corrección versionada en `src/server/routes/parking.ts`.
- [x] T011 [US2,US3] Registrar altas, salidas y correcciones con actor, antes/después y fecha en el store de auditoría de sesiones de `src/server/routes/parking.ts`.
- [x] T012 [US1,US2,US3] Actualizar pruebas de `tests/unit/server/test_server_api.test.ts` para autenticar operaciones existentes y cubrir entradas con formato compacto y guionado.
- [x] T013 Ejecutar pruebas API nuevas/existentes y confirmar roles, conflictos, unicidad, auditoría y estado de sesiones.

## Phase 4: Continuidad offline

**Purpose**: Mantener la lista y las mutaciones coherentes al operar sin red.

- [x] T014 [US2,US3] Añadir lectura de sesiones activas y actualización local por ID en `src/client/db/indexed-db.ts`, conservando compatibilidad con patentes compactas almacenadas.
- [x] T015 [US3] Añadir `VEHICLE_PLATE_UPDATE` y validación estricta de payload a la sincronización en `src/core/types/schema.ts`.
- [x] T016 [US2,US3] Aplicar autenticación y procesar entrada, salida por ID y corrección en `src/server/routes/sync.ts`; conservar resolución por patente de mutaciones históricas.
- [x] T017 [US2,US3] Mostrar y reconciliar lista online/offline con mutaciones pendientes en el cliente; ordenar el outbox por fecha para aplicar entrada antes que correcciones/salidas, actualizar callbacks tras sincronizar y retirar de la caché las sesiones activas que el servidor ya no devuelve.
- [x] T018 Ejecutar pruebas de IndexedDB/outbox/sincronización y confirmar entradas pendientes visibles, salidas pendientes ocultas y correcciones reintentables.

## Phase 5: Ficha unificada y lista operativa

**Purpose**: Completar el flujo visual de la persona operadora.

- [x] T019 [US1,US4] Crear `VehicleGatePanel` con modo Entrada/Salida, formateo incremental, validación y mensajes en `src/client/components/VehicleGatePanel.tsx`.
- [x] T020 [US2,US3] Añadir lista activa ordenada, contexto de unidad/área, estado vacío/carga/error, acción de salida por ID y edición inline limitada a sesiones activas en `src/client/components/VehicleGatePanel.tsx`.
- [x] T021 [US1,US2] Sustituir ambos formularios por la ficha única, pasar catálogos y refrescar lista/Dashboard en `src/client/App.tsx`.
- [x] T022 [US1,US2,US3,US4] Ajustar estilos responsive, teclado y etiquetas accesibles en `src/client/components/VehicleGatePanel.tsx` y `src/client/index.css`.
- [x] T023 Ejecutar pruebas de interfaz y confirmar modo, validación, estados y acciones de fila.

## Phase 6: Verificación y cierre

**Purpose**: Confirmar cumplimiento del contrato y entregar evidencia revisable.

- [x] T024 Revisar contraste spec/plan/contratos/tareas con `$speckit-converge` en bucle append-only y resolver cualquier tarea faltante.
- [x] T025 Ejecutar `npm run test:coverage`, `npm run typecheck`, `npm run build` y `git diff --check`; mantener cobertura >=85% y resolver regresiones introducidas.
- [x] T026 Verificar en navegador real entrada, formato, corrección activa, rechazo duplicado, salida por fila, salida manual y operaciones offline con sincronización posterior; comprobar recarga offline del shell en Vite preview con Service Worker.
- [x] T027 Revisar las checklists, registrar el estado y documentar resultados, limitaciones y archivos en `history/prompts/PHR-005-gate-operations.prompt.md`.

## Dependencias

- T001–T004 preceden cualquier cambio de producción; T005 confirma fase Roja.
- T006–T008 establecen dominio antes de exponer nuevas rutas.
- T009–T013 dependen de los contratos de dominio y concluyen APIs/auditoría.
- T014–T018 preservan sincronización antes de conectar la UI.
- T019–T023 montan y verifican la interfaz sobre contratos estabilizados.
- T024–T027 cierran convergencia, verificaciones y evidencia visual.

## Phase 7: Convergence

- [x] T028 [CRITICAL] Añadir integración de Vitest Workers-pool para ejecutar las rutas operativas de Garita en el runtime Cloudflare Worker, conservando las pruebas puras del dominio por separado, per Constitution II (contradicts).
