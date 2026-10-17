# Data Model: Operación unificada de Garita

## ParkingSession

Se conserva la entidad existente. La patente persistida sigue en representación compacta y mayúscula, con exactamente seis caracteres alfanuméricos. La interfaz la presenta en tres grupos de dos (`XX-XX-XX`). El estado y la versión existente se usan para impedir que se editen/cierre sesiones completadas u obsoletas.

Campos relevantes:

- `id`: identificador estable para acciones desde la lista.
- `facilityId`: instalación de la sesión.
- `licensePlate`: valor canónico compacto; se valida longitud 6 y caracteres alfanuméricos.
- `entryTime`, `exitTime`, `status`, `durationMinutes`: ciclo de la sesión.
- `businessUnitId`, `spaceCategoryId`, `parkingAreaId`: contexto operativo conservado durante correcciones de patente.
- `operatorUserId`, `deviceId`: autoría y terminal.
- `version`: aumenta al cerrar o corregir la sesión; se compara contra `expectedVersion`.

## ParkingSessionAuditEntry

Registro de auditoría en memoria para operaciones de desarrollo, siguiendo los stores existentes:

- `sessionId`, `facilityId`, `userId`, `action` (`created`, `exited`, `plate_updated`),
- `before` / `after` para cambios de patente y estado,
- `createdAt` en UTC.

## Outbox mutation

Se amplía `MutationType` con `VEHICLE_PLATE_UPDATE`. El payload contiene `sessionId`, `facilityId`, `licensePlate`, `expectedVersion`, `operatorUserId`. Las salidas locales llevan `sessionId` cuando se originan desde una fila de lista; la salida manual incluye también el ID si encuentra una sesión local.

No se agregan tablas ni migraciones. La auditoría y el almacenamiento remoto de sesiones siguen el alcance de desarrollo existente.
