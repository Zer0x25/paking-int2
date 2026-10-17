# API Contract: Operaciones de Garita

Base `/api/parking-sessions`. Las rutas requieren un JWT válido y permiten los roles operativos existentes. Las entradas JSON se validan con Zod. Las mutaciones responden con la sesión resultante y registran autoría.

## GET `/active?facilityId=...`

Devuelve `{ "sessions": ParkingSession[], "count": number }` en orden de entrada descendente. Requiere `facilityId`. 400 si falta la instalación; 401 sin token válido.

## POST `/entry`

Conserva la forma existente: `id?`, `facilityId`, `businessUnitId`, `spaceCategoryId`, `parkingAreaId?`, `licensePlate`, `entryTime?`, `deviceId?`.

La patente debe tener seis caracteres alfanuméricos, con guiones opcionales. La respuesta 201 devuelve sesión con patente compacta en mayúsculas y ticket. 400 para entrada inválida; 409 si ya existe una sesión activa con la patente en esa instalación o el motor de cupos rechaza el ingreso.

## POST `/exit`

Conserva salida manual por patente: `facilityId`, `licensePlate`, `exitTime?`, `deviceId?`. 200 devuelve sesión completada y duración; 400 cuerpo inválido; 404 sesión activa no encontrada.

## POST `/:sessionId/exit`

Body:

```json
{
  "facilityId": "fac-default-01",
  "expectedVersion": 1,
  "exitTime": "2026-10-17T14:00:00.000Z"
}
```

200 devuelve `{ "session": ParkingSession, "durationMinutes": number }`; 400 cuerpo inválido; 404 sesión inexistente, de otra instalación o ya cerrada; 409 versión obsoleta.

## PATCH `/:sessionId/plate`

Body:

```json
{
  "facilityId": "fac-default-01",
  "licensePlate": "AA-1A-11",
  "expectedVersion": 1
}
```

200 devuelve `{ "session": ParkingSession }`; 400 patente/cuerpo inválido; 404 sesión inexistente, de otra instalación o completada; 409 patente activa duplicada o versión obsoleta.

## POST `/api/sync/delta`

Se conserva el contrato y se admite el tipo `VEHICLE_PLATE_UPDATE`. La salida identifica la sesión mediante `sessionId` cuando se incluye; las mutaciones históricas sin ID mantienen la resolución por patente. Una mutación en conflicto queda reportada con su razón en la respuesta delta.

## Auditoría

Las altas, cierres y correcciones registran usuario, acción, instalación/sesión, antes/después y fecha UTC. Sin JWT: 401. El rol operador y administrador puede efectuar operaciones de garita conforme al control RBAC actual.
