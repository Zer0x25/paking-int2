# Tasks: Sistema Inteligente de Gestión de Estacionamientos (MVP)

**Feature**: `001-parking-core-mvp` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Inicialización del proyecto, configuración de dependencias y herramientas de desarrollo.

- [ ] T001 Inicializar estructura monorepo modular (`src/core`, `src/server`, `src/client`, `tests`) y archivo `package.json` con scripts de compilación, ejecución y pruebas
- [ ] T002 [P] Configurar TypeScript en modo estricto en `tsconfig.json` para core, server y client
- [ ] T003 [P] Configurar entorno de pruebas unitarias y cobertura en `vitest.config.ts` con cobertura obligatoria $\ge 85\%$
- [ ] T004 [P] Configurar archivo `wrangler.toml` con binding D1 (`PARKING_DB`) y compatibilidad para Cloudflare Workers

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Infraestructura transversal y modelos base indispensables para todas las historias de usuario.

**⚠️ CRITICAL**: Ninguna historia de usuario puede implementarse hasta completar esta fase.

- [ ] T005 Implementar esquemas declarativos Zod y tipos TypeScript de dominio en `src/core/types/schema.ts`
- [ ] T006 [P] Definir esquema de tablas D1 SQLite con Drizzle ORM en `src/server/db/schema.ts`
- [ ] T007 [P] Implementar middleware de autenticación JWT y control de acceso RBAC en `src/server/middleware/auth.ts`
- [ ] T008 [P] Configurar aplicación base Hono con enrutamiento modular y manejo centralizado de errores en `src/server/index.ts`
- [ ] T009 Configurar inicializador de IndexedDB y tiendas locales (`offline_sessions`, `outbox_queue`, `catalogs_cache`) en `src/client/db/indexed-db.ts`

**Checkpoint**: Base lista: el desarrollo de historias de usuario puede comenzar.

---

## Phase 3: User Story 1 - Registro Rápido de Entrada y Salida Vehicular con Soporte Offline (Priority: P1) 🎯 MVP Core

**Goal**: Permitir el registro ágil de ingresos y salidas vehiculares con patente y unidad de destino, con persistencia local en IndexedDB y cola de sincronización asíncrona ante cortes de red.

**Independent Test**: Registrar ingresos y salidas en modo desconectado (offline) en el navegador, verificar la actualización local de contadores y validar la sincronización correcta al restablecer la red sin duplicar patentes activas.

### Tests for User Story 1 (TDD Red/Green) ⚠️
> **Escribir estas pruebas primero y verificar que fallen antes de implementar**
- [ ] T010 [P] [US1] Pruebas unitarias para validación de patente, cálculo de permanencia y unicidad de estado activo en `tests/unit/core/test_parking_session.test.ts`
- [ ] T011 [P] [US1] Pruebas unitarias para la cola de mutaciones locales (Outbox) y sincronización incremental en `tests/unit/client/test_outbox_sync.test.ts`

### Implementation for User Story 1
- [ ] T012 [US1] Implementar entidad y lógica de sesión vehicular en `src/core/models/parking-session.ts`
- [ ] T013 [US1] Implementar endpoints de registro de entrada (`POST /api/parking-sessions/entry`) y salida (`POST /api/parking-sessions/exit`) en `src/server/routes/parking.ts`
- [ ] T014 [US1] Implementar gestor de sincronización incremental y conciliación delta en `src/client/db/outbox-sync.ts`
- [ ] T015 [US1] Implementar componente de formulario de ingreso vehicular con normalización de patentes en `src/client/components/VehicleEntryForm.tsx`
- [ ] T016 [US1] Implementar componente de formulario de egreso con búsqueda de patente activa y cálculo de tiempo en `src/client/components/VehicleExitForm.tsx`
- [ ] T017 [US1] Implementar barra de estado de conectividad e indicador de sincronización en `src/client/components/SyncStatusBar.tsx`

**Checkpoint**: Al completar esta fase, el registro operativo de vehículos funciona íntegramente de forma online y offline.

---

## Phase 4: User Story 2 - Motor de Asignación y Priorización Dinámica de Cupos (Priority: P1) 🎯 MVP Allocation

**Goal**: Garantizar cupos protegidos para el Hotel y Eventos contractuales, distribuyendo dinámicamente el remanente entre Restaurante, Gimnasio y General.

**Independent Test**: Configurar una instalación con cupos asignados y verificar que las áreas dinámicas se bloqueen cuando el remanente no comprometido llega a cero, protegiendo los espacios del hotel y eventos.

### Tests for User Story 2 (TDD Red/Green) ⚠️
- [ ] T018 [P] [US2] Pruebas unitarias para el algoritmo de asignación dinámica, protección de cuotas de hotel y eventos en `tests/unit/core/test_allocation_rules.test.ts`

### Implementation for User Story 2
- [ ] T019 [US2] Implementar motor de cálculo de prioridades y disponibilidad dinámica en `src/core/rules/allocation-engine.ts`
- [ ] T020 [US2] Implementar servicio de validación de cuotas y bloqueos en `src/server/services/allocation-service.ts`
- [ ] T021 [US2] Integrar el motor de asignación al flujo de registro de entradas en `src/server/routes/parking.ts`

**Checkpoint**: El sistema garantiza el cumplimiento de cuotas protegidas y previene la saturación no autorizada de espacios.

---

## Phase 5: User Story 3 - Dashboard Operativo y Alertas de Capacidad en Tiempo Real (Priority: P2)

**Goal**: Presentar panel de control visual con ocupación global, disponibilidad por unidad de negocio y alertas al 90% (advertencia) y 100% (crítica).

**Independent Test**: Simular ingresos vehiculares y verificar que los indicadores y barras de progreso del Dashboard se actualicen en tiempo real activando las alertas visuales en los umbrales configurados.

### Tests for User Story 3 (TDD Red/Green) ⚠️
- [ ] T022 [P] [US3] Pruebas unitarias para el cálculo de métricas de ocupación y niveles de alerta en `tests/unit/core/test_dashboard_metrics.test.ts`

### Implementation for User Story 3
- [ ] T023 [US3] Implementar agregador de métricas y cálculo de porcentajes en `src/core/rules/dashboard-calculator.ts`
- [ ] T024 [US3] Implementar endpoint de métricas de ocupación (`GET /api/facilities/:id/dashboard`) en `src/server/routes/dashboard.ts`
- [ ] T025 [US3] Implementar componente de Dashboard operativo responsive con medidores de capacidad y alertas visuales en `src/client/components/OperationalDashboard.tsx`

**Checkpoint**: Visibilidad operacional en tiempo real disponible para supervisores y administradores.

---

## Phase 6: User Story 4 - Configuración Agnóstica de Instalaciones, Áreas y Categorías (Priority: P2)

**Goal**: Permitir la parametrización de instalaciones, capacidades, tipos de espacio y unidades de negocio sin modificar código fuente.

**Independent Test**: Crear una nueva instalación con categorías de estacionamiento y unidades de negocio personalizadas y comprobar que el sistema opera de inmediato bajo la nueva configuración.

### Tests for User Story 4 (TDD Red/Green) ⚠️
- [ ] T026 [P] [US4] Pruebas unitarias para validación de esquemas de instalación y categorías en `tests/unit/core/test_facility_config.test.ts`

### Implementation for User Story 4
- [ ] T027 [US4] Implementar endpoints de administración de instalaciones y unidades (`/api/facilities`) en `src/server/routes/facilities.ts`
- [ ] T028 [US4] Implementar vista de administración y configuración de recintos en `src/client/components/FacilityConfigView.tsx`

---

## Phase 7: User Story 5 - Autenticación, Roles y Trazabilidad de Auditoría (Priority: P3)

**Goal**: Controlar el acceso al sistema diferenciando roles (Administrador y Operador) y registrar bitácora inmutable de auditoría para cada acción.

**Independent Test**: Iniciar sesión con rol Operador y verificar que las opciones administrativas estén ocultas, comprobando que cada ingreso de vehículo registre el identificador del operador.

### Tests for User Story 5 (TDD Red/Green) ⚠️
- [ ] T029 [P] [US5] Pruebas unitarias para autenticación, autorización RBAC y generación de audit logs en `tests/unit/server/test_auth_audit.test.ts`

### Implementation for User Story 5
- [ ] T030 [US5] Implementar endpoints de autenticación (`POST /api/auth/login`) y servicio de bitácora en `src/server/routes/auth.ts`
- [ ] T031 [US5] Implementar pantalla de inicio de sesión y control de vistas por rol en `src/client/components/LoginView.tsx`

---

## Phase 8: Polish, Cross-Cutting & Verification

**Purpose**: Integración final del cliente PWA, verificación del Definition of Done y pruebas E2E.

- [ ] T032 Integrar vistas operacionales en el contenedor principal responsive con diseño premium en `src/client/App.tsx`
- [ ] T033 [P] Configurar Service Worker y manifiesto PWA en `vite.config.ts`
- [ ] T034 Ejecutar suite completa de Vitest y verificar cobertura obligatoria $\ge 85\%$ en todo el código
- [ ] T035 Validar los escenarios de prueba interactivos definidos en `specs/001-parking-core-mvp/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies
- **Phase 1 (Setup)**: Sin dependencias, arranca inmediatamente.
- **Phase 2 (Foundational)**: Depende de Phase 1. Bloquea todas las historias de usuario.
- **Phase 3 (User Story 1 - Core Operations)**: Depende de Phase 2. Constituye el núcleo MVP.
- **Phase 4 (User Story 2 - Allocation Engine)**: Depende de Phase 2. Se integra con Phase 3.
- **Phase 5 (User Story 3 - Dashboard)**: Depende de Phase 2 y Phase 3.
- **Phase 6 (User Story 4 - Configuration)**: Depende de Phase 2.
- **Phase 7 (User Story 5 - Auth & Audit)**: Depende de Phase 2.
- **Phase 8 (Polish & DoD Verification)**: Depende de la finalización de las historias de usuario del MVP.

---

## Implementation Strategy (MVP Incremental)

1. **Paso 1**: Completar Setup (T001-T004) y Foundational (T005-T009).
2. **Paso 2**: Implementar US1 (Registro In/Out Offline-First) y US2 (Motor de Asignación y Prioridades). **¡MVP Funcional Completo!**
3. **Paso 3**: Implementar US3 (Dashboard en tiempo real con alertas) y US4/US5 (Configuración y Auth).
4. **Paso 4**: Verificación formal de DoD (Cobertura $\ge 85\%$, linter, typecheck) y revisión interactiva.
