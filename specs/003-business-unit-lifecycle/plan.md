# Implementation Plan: Gestión del ciclo de vida de unidades de negocio

**Branch**: `003-business-unit-lifecycle` | **Date**: 2026-10-17 | **Spec**: [spec.md](spec.md)

**Input**: Approved specification in this directory.

## Summary

Habilitar creación, edición de los cuatro campos existentes y retiro lógico de unidades de negocio. La causa del fallo de creación es que la pantalla modifica directamente el arreglo recibido por props, sin persistir en el servidor ni notificar un cambio de estado a React. Se añadirá una API administrativa validada y versionada, reglas puras de dominio, catálogo operativo de unidades activas, historial administrativo y un formulario conectado a las rutas. El retiro protege referencias activas y mantiene las históricas.

## Technical Context

**Language/Version**: TypeScript 5.7, strict mode
**Primary Dependencies**: React 18, Vite 6, Hono 4, Zod 3.23, Cloudflare Workers
**Storage**: Almacén en memoria del Worker en el entorno actual de desarrollo; D1 no se amplía en esta iteración
**Testing**: Vitest; pruebas de dominio y API, compilación y verificación en navegador real
**Target Platform**: Cloudflare Workers y navegadores modernos / PWA
**Project Type**: Aplicación web con dominio puro, API y cliente React
**Performance Goals**: Guardar y reflejar una unidad en menos de 2 segundos en desarrollo local
**Constraints**: Código único dentro de la instalación; validación de cuota; control de concurrencia por versión; mutaciones solo para administradores; conservar historia y auditoría
**Scale/Scope**: Gestión de las unidades de negocio de una instalación en la pantalla Configuración

## Constitution Check

| Principio | Estado | Evidencia / tratamiento |
|---|---|---|
| Dominio puro y arquitectura hexagonal | PASS | Validación y transiciones de unidad vivirán en `src/core/rules/businessUnitRules.ts`, sin Hono ni React. |
| Offline-first | EXCEPCIÓN DOCUMENTADA | Este cambio sigue el patrón actual de configuración de desarrollo, que guarda instalaciones, áreas y reservas en el Worker en memoria. El outbox actual solo sincroniza entradas y salidas; añadir una cola de catálogo separada produciría un segundo modelo de sincronización. Se conserva el comportamiento existente y se deja la persistencia local/D1 de configuración para una entrega coherente de sincronización. |
| TDD Red/Green | PASS | Pruebas de dominio y rutas precederán los cambios de producción y se comprobará el fallo inicial. |
| Validación estricta con Zod | PASS | Entradas de creación, edición y retiro se validarán en el límite de la API. |
| RBAC y auditoría | PASS | Listado y mutaciones de administración requieren JWT de administrador; cada mutación conserva actor, fecha y valores. |
| Definition of Done | PASS | Suite, cobertura, typecheck, build, diff y navegador real. |

## Project Structure

```text
specs/003-business-unit-lifecycle/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/api-business-units.md
├── checklists/requirements.md
└── tasks.md

src/core/
├── types/schema.ts
└── rules/businessUnitRules.ts
src/server/
├── services/allocation-service.ts
└── routes/facilities.ts
src/client/components/
├── BusinessUnitManager.tsx
└── FacilityConfigView.tsx
tests/unit/
├── core/test_business_unit.test.ts
└── server/test_business_unit_api.test.ts
```

**Structure Decision**: Mantener el layout hexagonal existente. El almacén compartido de unidades reside en el servicio de asignación para que administración, admisión y dashboard lean el mismo catálogo; los endpoints permanecen en la ruta de instalaciones.

## Delivery Phases

1. Definir esquemas estrictos y contratos de dominio para crear, editar y retirar con control de versión.
2. Añadir pruebas rojas del dominio y API; confirmar permisos, unicidad, auditoría y dependencias antes de programar la solución.
3. Implementar las reglas puras y rutas administrativas con almacenamiento compartido en desarrollo.
4. Reemplazar la mutación local de props por formularios conectados al API, inventario inactivo y confirmación accesible.
5. Ejecutar criterios de aceptación en navegador, suite completa, cobertura, typecheck y build.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Configuración en línea y en memoria, sin cola offline ni escritura D1 | Todas las entidades de configuración actuales comparten ese límite en el entorno dev; la solicitud es habilitar su CRUD existente. | Implementar una cola parcial solo para unidades mientras áreas/eventos no comparten sincronización causaría conflictos y datos divergentes; una solución offline exige consolidar la sincronización de configuración. |
