# Tasks: Controles compactos para tema y conexión

**Input**: Design documents from `specs/007-compact-header-controls/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/ui-controls.md`, `quickstart.md`

**Tests**: No se agregan ni ejecutan pruebas durante esta solicitud. La verificación automatizada queda pendiente.

## Phase 1: User Story 1 - Cambiar entre tema claro y oscuro (Priority: P1)

**Goal**: Reemplazar el selector de tres opciones por un botón accesible de alternancia que respeta el sistema como valor inicial.

- [x] T001 [US1] Actualizar `src/client/components/ThemeSelector.tsx` para mostrar un botón con icono y alternar el tema efectivo entre claro/oscuro.
- [x] T002 [US1] Ajustar `src/client/index.css` para el botón accesible en acceso y cabecera, conservando foco, estados y 44×44 px.

## Phase 2: User Story 2 - Consultar conexión y sincronizar desde la cabecera (Priority: P1)

**Goal**: Reemplazar el banner por un indicador compacto junto al tema, sin perder el estado ni la sincronización.

- [x] T003 [US2] Adaptar `src/client/components/SyncStatusBar.tsx` a un indicador de conexión con nombre accesible, contador y activación manual de sync cuando existan pendientes y conexión.
- [x] T004 [US2] Mover el indicador de `src/client/App.tsx` al grupo de controles de cabecera y mantenerlo ausente en el inicio de sesión.
- [x] T005 [US2] Añadir iconos, contador, foco y estados de red/sincronización compactos en `src/client/index.css` sin mostrar el banner ancho.

## Phase 3: Polish y documentación

- [x] T006 Actualizar `specs/007-compact-header-controls/quickstart.md` y registrar la decisión de diseño en `history/adr/ADR-011-compact-header-controls.md`.
- [x] T007 Registrar en `history/prompts/PHR-010-compact-header-controls.prompt.md` que las pruebas, lint, tipos, build y navegador quedan fuera de esta solicitud.

## Dependencies & Execution Order

- T001 precede T002; T003 precede T004/T005 para ubicar el nuevo contrato visual.
- T006/T007 se completan tras los cambios de interfaz.
