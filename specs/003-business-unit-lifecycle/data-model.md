# Data Model: Unidades de negocio

## BusinessUnit

| Field | Type | Rule |
|---|---|---|
| `id` | string | Identidad estable generada al crear |
| `facilityId` | string | Instalación propietaria |
| `name` | string | Recortado y no vacío |
| `code` | string | Recortado, mayúsculas y único dentro de la instalación; incluye inactivas |
| `quotaType` | `guaranteed \| contractual \| dynamic` | Tipo de cupo seleccionado |
| `defaultQuota` | integer | Entero no negativo |
| `priorityLevel` | integer 1–5 | Derivado del tipo: garantizada=1, contractual=2, dinámica=3 |
| `isActive` | boolean | `false` significa retiro lógico |
| `version` | positive integer | Comienza en 1 y sube en cada edición o retiro |

## Dependencias de retiro

El retiro se rechaza mientras exista al menos una de estas referencias para la unidad:

- Sesión vehicular con estado `active`.
- Área con estado activo y `businessUnitId` igual a la unidad.
- Reserva no cancelada ni completada que aún esté visible durante su período de vigencia o gracia.

Las referencias históricas se conservan y no impiden el retiro. Una clave de código retirada permanece reservada en su instalación.

## Auditoría

Cada entrada conserva `id`, `facilityId`, `businessUnitId`, `userId`, `action` (`created`, `updated`, `deactivated`), `before`, `after` y `createdAt`. Para creación, `before` es nulo; para retiro, `after` mantiene la entidad con `isActive: false` y la versión nueva.
