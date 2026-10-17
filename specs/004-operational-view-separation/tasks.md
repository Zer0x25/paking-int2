# Tasks: Separación de Garita Operativa y Dashboard

**Input**: Design documents from specs/004-operational-view-separation/
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/view-separation.md

## Phase 1: User Story 1 - Garita enfocada en operación (P1)

**Goal**: Mostrar las acciones de entrada y salida en Garita y reservar los indicadores para Dashboard.

**Independent Test**: La prueba de la regla de visibilidad excluye Dashboard de Garita y excluye los formularios de Dashboard; la verificación manual confirma el resultado real en las pestañas existentes.

- [x] T001 [P] [US1] Escribir pruebas que fallen para la selección exclusiva de secciones por pestaña en tests/unit/client/test_operational_view.test.ts.
- [x] T002 [US1] Implementar la regla pura de secciones visibles para Garita, Dashboard y Configuración en src/client/utils/operational-view.ts.
- [x] T003 [US1] Integrar la regla de visibilidad en la composición de pestañas sin cambiar SyncStatusBar ni el refresco en src/client/App.tsx.
- [x] T004 [US1] Ejecutar cobertura, typecheck y build conforme a specs/004-operational-view-separation/quickstart.md.
- [x] T005 [US1] Verificar separación, estados y navegación en navegador real conforme a specs/004-operational-view-separation/quickstart.md.
- [x] T006 [US1] Registrar decisiones, pruebas y límites de la sesión en history/prompts/PHR-004-operational-view-separation.prompt.md.

## Dependencies

- T001 debe demostrar rojo antes de T002.
- T002 precede a T003; T004 y T005 dependen de la implementación.
- T006 cierra la evidencia del trabajo y depende de las validaciones.

## Parallel Opportunities

- No hay trabajo paralelo de producción: la prueba y el helper deben coordinarse secuencialmente por TDD.

## Implementation Strategy

- Entregar la historia completa como MVP único: separar secciones, validar comportamiento automatizado y confirmar la experiencia en navegador.
