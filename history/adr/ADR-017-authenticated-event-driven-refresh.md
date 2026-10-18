# ADR-017: Rutas protegidas y refresco por eventos autenticados

- **Estado**: Aceptado
- **Fecha**: 2026-10-17
- **Feature**: [011-secure-event-driven-updates](../../specs/011-secure-event-driven-updates/spec.md)

## Contexto

El Worker sirve rutas de operación y configuración junto con la PWA. Varias lecturas de datos aún no exigen una sesión, algunas escrituras de configuración dependen de rutas sin rol administrativo, y el cliente solicita el Dashboard cada seis segundos aunque el usuario esté en Garita o haya cerrado sesión. Garita también actualiza periódicamente la lista. Además, Workbox mantiene las respuestas privadas de `/api/*` en una caché compartida por URL durante 24 horas, que no distingue usuarios o recintos. Reducir únicamente la frecuencia no da cambios inmediatos entre equipos distintos.

## Decisión

- Exigir JWT en todas las rutas de datos, excepto salud e inicio de sesión; validar rol administrador en escrituras de configuración y comparar el recinto solicitado con el recinto firmado en la sesión.
- Quitar la caché compartida de respuestas `/api/*`; conservar los catálogos offline explícitamente en IndexedDB con claves por recinto y cargarlos solo después de autenticar.
- La PWA solicita datos después de autenticarse y únicamente al activar la vista correspondiente.
- Enviar avisos de invalidación por un Durable Object determinista por recinto con WebSocket Hibernation. El objeto no almacena información de negocio; cada equipo vuelve a leer datos usando rutas protegidas.
- Publicar después de una mutación D1 confirmada. Los avisos no incluyen patentes, usuarios, credenciales ni contenido de registros.
- Revalidar la vista activa al conectar/reconectar y al volver a abrir una vista; eliminar los sondeos basados en intervalos.
- Usar SQLite-backed Durable Objects, el único backend de Durable Objects disponible en Workers Free.

## Alternativas consideradas

- **Reducir la frecuencia de polling**: descartado porque mantiene solicitudes aunque los datos no cambien y retrasa las actualizaciones entre equipos.
- **BroadcastChannel del navegador**: descartado porque no entrega eventos entre equipos independientes.
- **Registro de conexiones en memoria del Worker**: descartado porque el Worker puede ejecutarse en distintos isolates y reiniciarse; no es un coordinador fiable.
- **Enviar el registro actualizado en el evento**: descartado para minimizar exposición; los clientes autorizan una consulta normal al recibir el aviso.
- **Mantener caché privada de API en Workbox con `Vary: Authorization`**: descartado porque el navegador seguiría guardando respuestas ligadas a credenciales y un fallback offline podría mostrar datos tras expirar la sesión; las operaciones offline usan almacenamiento local por recinto.

## Consecuencias

- El número de solicitudes de lectura pasa a depender de las vistas activas y de cambios confirmados, no del tiempo transcurrido.
- La PWA deja de recuperar datos privados desde una caché común del service worker; los catálogos y áreas offline se leen desde IndexedDB solo después de establecer el recinto autenticado.
- La conexión WebSocket autenticada se mantiene abierta por pestaña; el modo hibernable permite al Durable Object dormir en inactividad.
- Las llamadas al Durable Object consumen sus propios límites Free: a la fecha de esta decisión, 100.000 solicitudes diarias y 13.000 GB-s diarios. Cada conexión y llamada RPC de publicación cuenta como solicitud; las transmisiones WebSocket salientes no agregan solicitudes facturables. El piloto debe observar estos límites.
- Un error de notificación no revierte una escritura D1 confirmada; la revalidación al reconectar recupera el estado actual.
- Este ADR no autoriza crear recursos remotos, migrar datos productivos ni desplegar.

## Referencias

- [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)
- [Use WebSockets](https://developers.cloudflare.com/durable-objects/best-practices/websockets/)
- [Build a WebSocket server with Hibernation](https://developers.cloudflare.com/durable-objects/examples/websocket-hibernation-server/)
