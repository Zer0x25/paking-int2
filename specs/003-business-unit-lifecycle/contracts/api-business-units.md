# API Contract: Unidades de negocio

Base: `/api/facilities/:facilityId/business-units`. Las rutas requieren `Authorization: Bearer <JWT>` con rol `admin`. Todas las mutaciones reciben JSON y validan su cuerpo con Zod.

## GET `/api/facilities/:facilityId/business-units`

Devuelve `{ "businessUnits": BusinessUnit[] }` para la instalación, incluyendo activas e inactivas. 404 si la instalación no existe.

## POST `/api/facilities/:facilityId/business-units`

Body:

```json
{
  "name": "Spa & Club",
  "code": "SPA",
  "quotaType": "dynamic",
  "defaultQuota": 10
}
```

201 `{ "businessUnit": BusinessUnit }`; 400 cuerpo inválido; 404 instalación inexistente; 409 código duplicado o cuotas garantizadas y reservas vigentes que excedan el aforo.

## PUT `/api/facilities/:facilityId/business-units/:businessUnitId`

Body: los cuatro campos del formulario y la versión esperada.

```json
{
  "name": "Spa & Club",
  "code": "SPA",
  "quotaType": "guaranteed",
  "defaultQuota": 12,
  "version": 1
}
```

200 `{ "businessUnit": BusinessUnit }`; 400 cuerpo inválido; 404 entidad inexistente o de otra instalación; 409 código duplicado, compromiso de cupo inválido, reservas vigentes al cambiar el tipo de cuota o conflicto de versión.

## PATCH `/api/facilities/:facilityId/business-units/:businessUnitId/status`

Body: `{ "isActive": false, "version": 1 }`.

200 `{ "businessUnit": BusinessUnit }`; 400 cuerpo inválido; 404 entidad inexistente o de otra instalación; 409 unidad ya inactiva, versión desactualizada o dependencias activas. El error identifica los compromisos que deben resolverse.

## Catálogo operativo

`GET /api/facilities/:facilityId/catalogs` devuelve en `businessUnits` solo las unidades activas. El inventario administrativo anterior conserva inactivas.

## Seguridad y auditoría

Sin JWT válido la respuesta es 401; un usuario sin rol de administrador recibe 403. Las mutaciones conservan actor, acción, valores previos y posteriores, y fecha UTC en el registro de auditoría de desarrollo.
