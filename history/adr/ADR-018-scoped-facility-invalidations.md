# ADR-018: Invalidaciones por alcance y lecturas D1 específicas

- **Estado**: Aceptado
- **Fecha**: 2026-10-18
- **Feature**: [011-secure-event-driven-updates](../../specs/011-secure-event-driven-updates/spec.md)
- **Relacionado**: [ADR-017](./ADR-017-authenticated-event-driven-refresh.md)

## Contexto

La medición local detectó que una actualización de Garita volvía a consultar catálogos y sesiones aunque solo cambiara una sesión. Además, la ruta de catálogos reutilizaba `loadFacilitySnapshot`, que ejecuta una consulta D1 adicional de todas las sesiones activas que no aparecen en su respuesta.

## Decisión

- La consulta de catálogos usa un lote D1 específico con instalación, categorías, unidades, áreas y eventos; no consulta `parking_sessions`.
- Las invalidaciones llevan una etiqueta fija `scope` (`parking` o `configuration`) y el contrato pasa a `schemaVersion: 2`.
- Garita recarga solo sesiones ante un cambio operacional y solo catálogos ante un cambio de configuración. Dashboard recarga sus métricas ante cualquiera de los dos. Configuración ignora cambios operacionales.
- Al reconectar, el cliente vuelve a cargar todos los datos requeridos por su vista activa, porque puede haber perdido avisos.
- Durante la actualización, el Durable Object envía también el formato de invalidación v1 sin alcance para las pestañas antiguas que sigan abiertas. La forma v2 no contiene datos de registros.
- Las lecturas continúan protegidas por JWT y recinto; no se agregan tablas, migraciones D1 ni solicitudes adicionales a Durable Objects.

## Consecuencias

- Una invalidación operacional en Garita elimina la solicitud de catálogos y evita leer dos veces las sesiones activas.
- Las lecturas de catálogos eliminan por completo el recorrido de sesiones activas.
- Las etiquetas son metadatos de una lista cerrada, no incluyen patentes, identidad, credenciales ni contenido operacional.
- La compatibilidad v1 añade un mensaje saliente pequeño por evento mientras haya clientes antiguos. El evento v2 permite a los clientes nuevos seleccionar la lectura necesaria.

## Referencias

- [Cloudflare Durable Objects WebSocket best practices](https://developers.cloudflare.com/durable-objects/best-practices/websockets/)
