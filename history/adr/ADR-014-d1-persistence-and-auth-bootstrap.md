# ADR-014: Persistencia D1 local y bootstrap seguro de cuentas

- **Estado**: Aceptado
- **Fecha**: 2026-10-17
- **Feature**: [009-d1-persistence](../../specs/009-d1-persistence/spec.md)

## Contexto

El Worker conserva catálogos, reservas, sesiones y auditorías en arreglos dentro de módulos. Esa información desaparece al reiniciar o cambiar de instancia. La PWA ya mantiene datos offline y una cola de mutaciones en IndexedDB, pero el servidor no ofrece persistencia central durable ni recepción idempotente. La autenticación también incluye cuentas de muestra en texto claro y un secreto JWT versionado.

## Decisión

- Usar el binding D1 ya configurado en Wrangler y Drizzle para persistir todos los registros del servidor.
- Administrar cambios de esquema con migraciones SQL de Wrangler. En esta iteración, aplicarlas solo al D1 local y conservar la base local existente.
- Mantener IndexedDB como caché y outbox offline. Guardar cada mutación confirmada, su auditoría y su recibo de idempotencia en una transacción D1.
- Serializar las invariantes de capacidad mediante compare-and-swap de versión por recinto, con precondiciones incluidas en el primer statement y escrituras posteriores condicionadas por esa versión.
- Sembrar el catálogo no sensible únicamente durante la inicialización local vacía; no reemplazar valores editados.
- Leer las credenciales locales de administrador/operador y el secreto JWT desde `.dev.vars`, ignorado por Git. Persistir solo identidad y rol en D1; validar la contraseña contra la configuración local y no guardar contraseña ni hash. Eliminar credenciales y secretos de respaldo del código versionado y de los accesos rápidos visibles.
- Excluir de este cambio la creación o migración de D1 productivo, credenciales productivas y despliegue.

Esta decisión es solo para desarrollo local. No reemplaza la decisión PBKDF2/WebCrypto de ADR-002 para una futura autenticación productiva; esa autenticación requiere una decisión separada compatible con el presupuesto de CPU del destino.

## Alternativas consideradas

- **Mantener los arreglos del Worker y guardar solo en el navegador**: rechazado porque el reinicio del Worker pierde el estado central y otros terminales no lo comparten.
- **Usar otra base de datos o agregar un servidor Node**: rechazado porque D1 ya forma parte del diseño del proyecto y añade menos infraestructura para el destino Cloudflare.
- **Sembrar datos y contraseñas en SQL versionado o en `[vars]` de Wrangler**: rechazado porque introduce credenciales, secretos o valores de desarrollo expuestos en el repositorio.
- **Persistir hashes Argon2id y afirmar compatibilidad con Workers Free**: rechazado en esta iteración porque el límite de CPU del plan Free exige evidencia que un test local no proporciona.
- **Reemplazar D1 sin conservar el outbox offline**: rechazado porque bloquearía la operación de garita ante pérdida de conexión.

## Consecuencias

- Configuración, garita, auditoría, dashboard y autenticación consultan una fuente central durable después de reiniciar el Worker.
- Los reintentos offline necesitan recibos persistentes y transacciones cuidadosas para no duplicar sesiones o auditorías.
- El arranque local requiere `.dev.vars` y una inicialización de migraciones/catálogo; el primer login crea identidad/rol idempotentemente y no habrá secreto JWT implícito.
- La autenticación resultante es solo para desarrollo local; definir autenticación productiva es trabajo futuro.
- La decisión no autoriza recursos ni cambios en producción.

## Fuentes técnicas

- [Cloudflare D1 batch API](https://developers.cloudflare.com/d1/worker-api/d1-database/)
- [Wrangler D1 migrations](https://developers.cloudflare.com/d1/wrangler-commands/)
- [Cloudflare local development variables](https://developers.cloudflare.com/workers/local-development/environment-variables/)
- [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Cloudflare Workers Vitest coverage known issues](https://developers.cloudflare.com/workers/testing/vitest-integration/known-issues/)
