# Implementation Plan: Operación unificada de Garita

**Branch**: `005-gate-operations` | **Date**: 2026-10-17 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/005-gate-operations/spec.md`

## Summary

Reemplazar las dos tarjetas independientes de entrada y salida por una ficha de operación con controles Entrada/Salida; añadir una lista de sesiones activas con salida por fila y corrección de patente mientras siga activa. Validar seis caracteres alfanuméricos, normalizar a mayúsculas y representar la patente con grupos `XX-XX-XX`. Mantener la operación offline, la sincronización, la auditoría y las vistas actuales.

## Technical Context

**Language/Version**: TypeScript 5.7, React 18

**Primary Dependencies**: Hono 4, Zod 3, Vite 6, React 18, idb 8, Vitest 4.1.11, `@cloudflare/vitest-plugin` y Wrangler 4.151; sin nuevas dependencias de ejecución

**Storage**: Repositorio de sesiones en memoria del Worker de desarrollo; IndexedDB y outbox local para operación offline

**Testing**: Vitest en Node para dominio, APIs, sincronización y componentes; Vitest Workers integration para las rutas ejecutadas dentro de `workerd`; typecheck/build; navegador real para el flujo completo

**Target Platform**: PWA responsive en navegadores de escritorio y móviles compatibles

**Project Type**: Cliente React y API Hono para Cloudflare Workers

**Performance Goals**: Mostrar el listado al montar la vista, actualizarlo después de las operaciones y refrescar datos compartidos dentro del intervalo de actualización operativo ya usado por la aplicación.

**Constraints**: Sin dependencias nuevas de ejecución; mantener Vitest y la integración oficial de Workers en versiones compatibles. Respetar formato, duplicidad por instalación, RBAC, auditoría, concurrencia optimista y operación offline-first.

**Scale/Scope**: Garita Operativa, dominio de patentes/sesiones, rutas de sesiones activas, salida/corrección por ID, IndexedDB/outbox y pruebas relacionadas. Dashboard y Configuración mantienen sus vistas.

## Constitution Check

- **Especificación previa**: Pasa. La solicitud y las dos aclaraciones fijan la ficha unificada, el formato de patente y el alcance de edición.
- **TDD Red/Green**: Pasa como plan. Se agregarán primero pruebas de validación, APIs, mutaciones offline y vista; se demostrará su fallo antes de tocar producción.
- **Arquitectura hexagonal y offline-first**: Pasa. Normalización/validación permanece en `src/core`; la interfaz usa IndexedDB y outbox cuando no hay conexión.
- **Zod y seguridad**: Pasa como objetivo. Las entradas API se validan con Zod y las rutas operacionales usan la autenticación/rol existentes.
- **Auditoría**: Pasa como objetivo. Las mutaciones de sesiones conservan usuario, acción, antes/después y fecha en el registro operativo de desarrollo.
- **ADR**: ADR-006 registra el formato canónico y las operaciones identificadas por sesión; ADR-007 documenta la integración de pruebas dentro de Workers detectada durante convergencia.
- **Verificación**: Suite con cobertura >=85%, typecheck, build, diff check y verificación de entrada/salida/corrección en navegador.

La feature mantiene una excepción acotada a desarrollo y pruebas para reutilizar el repositorio en memoria que usa el resto de la aplicación. El alcance no declara la aplicación lista para producción con persistencia D1; el motivo y el límite quedan registrados en `Complexity Tracking`.

La auditoría de convergencia detectó que las pruebas de rutas solo ejercitaban Hono desde Node. Se añade una configuración Workers separada y se actualiza el runner al plugin oficial compatible con Vitest 4; las pruebas de dominio/componentes permanecen en Node. La decisión y la excepción al plan inicial de no agregar dependencias quedan registradas en ADR-007.

## Diseño técnico

1. Añadir en el dominio helpers puros para normalizar, formatear y validar patentes exactamente de seis caracteres alfanuméricos. El valor canónico persistido continúa compacto y en mayúsculas; la presentación visible agrega guiones cada dos caracteres, para no invalidar registros locales existentes.
2. Componer `VehicleGatePanel` como una ficha única con controles segmentados Entrada/Salida. Reutilizar selección de unidad, categoría y área para entrada; conservar salida manual por patente.
3. Añadir a la lista operativa el fetch de sesiones activas, orden por hora descendente, contexto de unidad/área, estado vacío, carga/error y reintento. Consultar servidor online y sesiones locales offline; combinar caché con mutaciones pendientes para evitar ocultar entradas locales o resucitar salidas pendientes.
4. Añadir salida directa por `sessionId` y corrección por ID con `expectedVersion`; validar instalación, estado activo, formato y unicidad antes de actualizar.
5. Mantener las operaciones offline: registrar salida con ID cuando provenga de la lista, actualizar la sesión local al corregir, encolar `VEHICLE_PLATE_UPDATE`, y procesar ID/placa en la sincronización delta.
6. Proteger rutas de sesión/sincronización con autenticación existente y registrar entrada, salida y corrección en el audit store en memoria ya usado por otras funciones del Worker de desarrollo.
7. Refrescar la lista y Dashboard después de cada mutación y al completar la sincronización.

## Contratos de API

- `GET /api/parking-sessions/active?facilityId=...`: sesiones activas de la instalación.
- `POST /api/parking-sessions/entry`: conservar entrada actual; validar seis caracteres alfanuméricos.
- `POST /api/parking-sessions/exit`: conservar cierre manual por patente.
- `POST /api/parking-sessions/:sessionId/exit`: cerrar la sesión activa seleccionada, usando `facilityId`, `exitTime` opcional y `expectedVersion`.
- `PATCH /api/parking-sessions/:sessionId/plate`: corregir patente activa, con `facilityId`, patente y `expectedVersion`.
- `POST /api/sync/delta`: admitir mutación offline `VEHICLE_PLATE_UPDATE` e identificar salida por `sessionId` si está disponible.

## Project Structure

### Documentación de la feature

- `specs/005-gate-operations/spec.md`
- `specs/005-gate-operations/plan.md`
- `specs/005-gate-operations/research.md`
- `specs/005-gate-operations/data-model.md`
- `specs/005-gate-operations/contracts/parking-operations.md`
- `specs/005-gate-operations/quickstart.md`
- `specs/005-gate-operations/tasks.md`

### Código fuente

- `src/core/models/parking-session.ts`: normalización y reglas de unicidad/actualización.
- `src/core/types/schema.ts`: validación de sesión y tipo de mutación offline.
- `src/server/routes/parking.ts`: consulta, salida por ID, actualización y auditoría.
- `src/server/routes/sync.ts`: aplicación de salida/corrección offline.
- `src/client/components/VehicleGatePanel.tsx`: modo de operación y lista activa.
- `src/client/db/indexed-db.ts`: consulta/actualización de sesiones locales.
- `src/client/App.tsx`: sustituir las dos tarjetas en la vista Garita.
- `tests/unit/core/`, `tests/unit/server/`, `tests/unit/client/`: pruebas TDD.
- `vitest.workers.config.ts` y `tests/workers/`: integración de rutas usando el runtime Workers.

**Structure Decision**: Mantener la arquitectura cliente/Worker actual y reutilizar modelo, sesiones, permisos y almacenamiento offline existentes.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| Constitution I: las sesiones y su auditoría siguen en `mockSessionsRepo`/store en memoria en el alcance de desarrollo, en vez de usar D1 con Drizzle. | Esta iteración se limita a completar la operación de Garita sobre el repositorio compartido que ya usa el Worker de desarrollo; la configuración, catálogos y asignación tampoco usan actualmente un almacén D1 conectado. | Persistir solo las sesiones en D1 ahora crearía dos fuentes de verdad entre sesiones, catálogos y asignación, sin completar la persistencia de la aplicación. Antes de producción debe reemplazarse el agregado compartido por D1/Drizzle de forma coherente. Esta excepción no aprueba despliegue productivo con almacenamiento en memoria. |
| Plan inicial: Vitest 2 y sin dependencias nuevas. | Constitution II exige pruebas de rutas dentro del runtime Workers. Se actualizan herramientas de desarrollo a Vitest 4.1.11, `@cloudflare/vitest-plugin` y Wrangler 4.151; no se agrega ninguna dependencia de ejecución. | El paquete anterior `@cloudflare/vitest-pool-workers` está obsoleto y su versión compatible con Vitest 2 incorpora dependencias vulnerables. Se conserva un proyecto Node para pruebas rápidas y se separa el proyecto Workers sin mezclar sus entornos. |
