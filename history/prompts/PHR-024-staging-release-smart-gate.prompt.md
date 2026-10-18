---
id: PHR-024
stage: release-verification
date: 2026-10-18
branch: main
command: user-authorized staging deployment and smoke verification
model: Codex GPT-6
---

# PHR-024: Despliegue y verificación del flujo inteligente en staging

## Solicitud

> El usuario autorizó desplegar el código actual a staging y probarlo.

## Estado previo

- Repositorio limpio y sincronizado: `main` en `5330aea3f114efd06ac5252439dd4d49b198edd8`.
- Preflight de staging aprobado; `.dev.vars.staging` presente con permisos `0600`. No se imprimieron ni transmitieron valores de secretos fuera del login al Worker de staging.
- Sin cambios de migración D1 desde el último release. `wrangler d1 migrations list paking-db-staging --remote --env staging` informó `No migrations to apply`.

## Validación local

- `npm run test:coverage`: frontend 229 pruebas, 93.92% de statements; Workers 41 pruebas, 91.09% de statements.
- `npm run typecheck`, `npm run lint`, `npm audit`, `npm run build` y `npx wrangler deploy --dry-run --env staging` pasaron. `npm audit` informó cero vulnerabilidades.
- Dry-run resolvió `paking-int2-worker-staging`, D1 `paking-db-staging`, Durable Object `FACILITY_EVENTS` y `ENVIRONMENT=staging`.

## Despliegue y smoke checks remotos

- `npm run worker:deploy:staging` completó correctamente para `paking-int2-worker-staging`.
- Cloudflare confirmó la versión `34c12096-dd51-4e8b-8b35-5899820ded66` al 100%, despliegue `6ba0dbbc-b28d-467f-8294-224f034d6a31`, creado el `2026-10-18T21:52:30Z`.
- `/` y la navegación directa del navegador a `/dashboard` mostraron la aplicación SPA y el formulario de acceso.
- `/api/health` respondió 200 con `Cache-Control: no-store`; una lectura de sesiones sin autenticar respondió 401 con `no-store`.
- Login de administrador y operador exitoso. La lectura del catálogo y unidades dio 200 para administrador; la lectura de unidades protegida por rol dio 403 para operador.
- Se verificó el ciclo de garita con dos patentes sintéticas: registro de entrada (201), presencia de la sesión en activos, salida completada (200) y ausencia posterior de la lista activa. Los registros históricos/audit permanecen en D1 con `deviceId=codex-staging-smoke`; patentes: `ZD-PY-GF`, `HS-EW-75`.
- Un primer comparador del smoke test esperaba guiones en el valor almacenado. La app almacena la forma canónica sin guiones; se corrigió la aserción y se repitió el ciclo completo con resultado correcto.

## Pendiente

- No se validaron todavía aislamiento entre recintos, sincronización offline de IndexedDB/outbox, invalidación entre dispositivos, mutations de configuración, Logs/Traces y errores source-mapped, ni recuperación de D1/rollback.
- Este registro y la lista de verificación se publican en un commit de documentación separado.
