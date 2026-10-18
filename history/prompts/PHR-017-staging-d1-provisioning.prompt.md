---
id: PHR-017
stage: staging-provisioning
date: 2026-10-18
branch: 012-cloudflare-production-readiness
command: user-authorized push and continuation to the next Cloudflare deployment step
model: Codex GPT-6
---

# PHR-017: Provisionamiento inicial de staging en Cloudflare

## Prompt del usuario

> OK, ENONCE PRIMEOR PUSH, Y PASAMOS CON EL SUIGUIEBT PASO

## Decisiones y límites

- Publicar el commit existente de preparación Cloudflare antes de continuar.
- Continuar únicamente con staging; producción, DNS y secrets de producción quedan intactos.
- No compartir ni escribir valores secretos en Git, el historial, argumentos o salidas.
- Usar la ubicación automática recomendada por Cloudflare para la D1 nueva.

## Acciones y evidencia

- Se publicó `e443158` en `origin/012-cloudflare-production-readiness`; el push dejó configurado el upstream.
- El hook local DoD pasó: 38 archivos/202 pruebas unitarias y 9 archivos/33 pruebas Workers.
- Se verificó la cuenta Cloudflare conectada y su rol de miembro. Wrangler usa un User API Token; no se inspeccionó el conjunto granular de permisos del token.
- Se creó la base remota vacía `paking-db-staging` y se sustituyó su marcador por el UUID asignado en `wrangler.toml`.
- `npm run worker:preflight:staging` pasó para `paking-int2-worker-staging`; el chequeo indica que no hizo llamadas a Cloudflare. `workers.dev` quedó configurado como hostname inicial de staging.
- Se revisó `0001_initial_persistence.sql`: crea tablas e índices, sin instrucciones destructivas ni inserción de datos.
- Wrangler aplicó exclusivamente `0001_initial_persistence.sql` a `paking-db-staging`; la consulta posterior confirmó las tablas de aplicación y `wrangler d1 migrations list` confirmó que no quedan migraciones pendientes.
- La verificación de continuación confirmó la migración `0001_initial_persistence.sql` en `d1_migrations` y ausencia de migraciones pendientes. La lista de Workers no incluye `paking-int2-worker-staging`.
- Se actualizó el checklist y el quickstart para reflejar que el preflight es local, la D1 de staging ya está lista y aún no existe el Worker remoto.
- `git diff --check` pasó. Los cambios de configuración y documentación quedan locales, sin commit ni push.

## Estado de salida

- Staging D1 y su esquema están preparados; producción no se tocó.
- El Worker de staging ya está desplegado en `https://paking-int2-worker-staging.jmella-hs.workers.dev`; no se tocó producción.
- Wrangler confirmó los cinco nombres como `secret_text`. `/api/health` respondió HTTP 200 y `Cache-Control: no-store`.
- No se ejecutaron aún smoke checks de login, RBAC, flujos de garita, offline sync, logs/traces, ni recuperación D1. El checklist mantiene esos puntos pendientes.
- Los permisos granulares del token Wrangler no se verificaron.

## Seguimiento: solicitud de carga de secretos desde archivo local

- Se encontró `.dev.vars` con los cinco nombres requeridos. No se imprimieron ni registraron sus valores.
- El archivo corresponde al entorno de desarrollo y contiene una contraseña de operador demasiado corta para el Worker de staging expuesto en `workers.dev`; no se reutilizaron esos valores.
- Se corrigieron los permisos locales del archivo de `664` a `600`.
- `wrangler secret list --env staging` confirmó que `paking-int2-worker-staging` no existe. Cloudflare requiere crear el Worker antes de cargar secretos; para el primer Worker, `wrangler deploy --secrets-file` publica código y secretos en el mismo despliegue.
- Se crearon `.dev.vars.staging` y `.dev.vars.production` como plantillas vacías, con los cinco nombres requeridos, permisos `600` y exclusión confirmada por `.gitignore`. No contienen valores ni se incluyeron en Git.
- Después de la solicitud, el usuario completó `.dev.vars.staging` con credenciales de staging. Se comprobó que contiene exactamente los cinco campos requeridos, no están vacíos, el JWT tiene 64 caracteres y el archivo mantiene permisos `600`; no se imprimieron sus valores.
- Se desplegó con `npx wrangler deploy --env staging --secrets-file .dev.vars.staging`, creando el Worker y publicando la app y secretos en el mismo release. Cloudflare asignó la versión `21ec2b55-d396-4233-a7d1-035a7179147e`.
- `npx wrangler secret list --env staging --format json` confirmó los cinco nombres con tipo `secret_text`; el endpoint `/api/health` respondió 200 con `Cache-Control: no-store`.
- Producción sigue intacta; `.dev.vars.production` permanece como plantilla local vacía. No se hizo commit ni push.
