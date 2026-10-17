# Tasks: Gestión del ciclo de vida de unidades de negocio

**Input**: Design documents from `specs/003-business-unit-lifecycle/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/api-business-units.md`

## Phase 1: TDD Red — contratos observables

**Purpose**: Definir primero el comportamiento de dominio y API y demostrar que falla antes de la implementación.

- [x] T001 [P] Escribir pruebas unitarias para crear, normalizar, editar, versionar, duplicar y retirar unidades con referencias activas en `tests/unit/core/test_business_unit.test.ts`.
- [x] T002 [P] Escribir pruebas API para autenticación, listado completo, alta, edición de los cuatro campos, aforo, duplicados, versiones, dependencias, retiro lógico y auditoría en `tests/unit/server/test_business_unit_api.test.ts`.
- [x] T003 Ejecutar las pruebas nuevas y registrar la fase roja antes de modificar producción.

## Phase 2: Dominio y contratos

**Purpose**: Añadir esquemas de entrada estrictos e invariantes puras.

- [x] T004 Añadir versión, esquemas de creación/edición/retiro y validaciones de entradas para unidades en `src/core/types/schema.ts`.
- [x] T005 Implementar fábrica, unicidad por instalación, prioridad derivada, actualización optimista y retiro protegido en `src/core/rules/businessUnitRules.ts`.
- [x] T006 Ejecutar las pruebas de dominio y comprobar que avanzan a verde con versión y mensajes observables.

## Phase 3: API administrativa e integración operativa

**Purpose**: Persistir en el almacén compartido de desarrollo y publicar operaciones RBAC.

- [x] T007 Mantener el catálogo mutable y el registro de auditoría junto a los datos compartidos de asignación en `src/server/services/allocation-service.ts`.
- [x] T008 Implementar listado autenticado, creación, edición versionada y retiro lógico con validación de referencias en `src/server/routes/facilities.ts`.
- [x] T009 Ejecutar las pruebas API y comprobar los flujos CRUD, autorización, concurrencia, dependencias e historial.
- [x] T010 Hacer que admisión, dashboard y catálogos operativos consuman las unidades activas del almacén compartido en `src/server/services/allocation-service.ts` y `src/server/routes/dashboard.ts`.

## Phase 4: Gestión desde Configuración

**Purpose**: Reemplazar la mutación de props por flujos visibles que confirmen el resultado del servidor.

- [x] T011 Crear formulario de alta y edición de cuatro campos, lista activa, historial inactivo, manejo de errores y confirmación de retiro en `src/client/components/BusinessUnitManager.tsx`.
- [x] T012 Integrar el administrador en `src/client/components/FacilityConfigView.tsx`, refrescar los catálogos después de cada mutación y asegurar que los selectores operativos solo reciban unidades activas.
- [x] T013 Actualizar contratos, quickstart y ADR para registrar protección de referencias, auditoría y límite del almacén de desarrollo.

## Phase 5: Verificación y cierre

- [x] T014 Ejecutar suite completa, cobertura mínima constitucional, typecheck, build y `git diff --check`; resolver fallos introducidos por el cambio.
- [x] T015 Verificar en navegador real alta, edición de los cuatro campos, retiro confirmado, unidad protegida por dependencia y actualización de los selectores activos.
- [x] T016 Crear el PHR de esta sesión con decisiones, pruebas, límites observados y archivos modificados en `history/prompts/`.

## Dependencies

- T001 y T002 se escriben antes de cambiar producción; T003 demuestra Red.
- T004–T006 establecen dominio y verde.
- T007–T010 dependen de esquemas y reglas; T009 verifica rutas después de T008.
- T011–T012 dependen de las rutas de API disponibles.
- T013–T016 cierran documentación, controles y navegador después de la implementación.
