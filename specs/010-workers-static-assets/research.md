# Research: Workers Static Assets

**Fecha**: 2026-10-17
**Feature**: [010-workers-static-assets](spec.md)

## Decisión: usar Workers Static Assets en el Worker actual

- **Decisión**: Reemplazar `[site]` por `[assets]`, apuntar al directorio `./dist` y configurar fallback `single-page-application`.
- **Rationale**: Cloudflare marca Workers Sites como deprecado en Wrangler v4 y recomienda Workers Static Assets para aplicaciones full-stack. Assets publica el código Worker y los archivos estáticos como una unidad; los archivos existentes pueden servirse sin lógica dinámica. La interfaz y Hono mantienen el mismo origen.
- **Alternativas consideradas**:
  - Mantener Workers Sites: descartado porque está deprecado y se apoya en KV para la entrega de archivos.
  - Separar la SPA en Cloudflare Pages: descartado porque dividiría la entrega del Worker actual y agregaría otra configuración sin resolver la prueba integrada solicitada.
  - Migrar al plugin Cloudflare Vite: descartado en esta iteración; cambiaría el flujo de desarrollo/build más de lo necesario. El servidor Vite actual ya cubre HMR y Wrangler puede probar el artefacto final.

Fuente primaria: [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/), [Workers Sites](https://developers.cloudflare.com/workers/configuration/sites/).

## Decisión: usar fallback SPA con ejecución de API en Hono

- **Decisión**: Dejar que Assets resuelva los archivos existentes y las navegaciones HTML; una solicitud fetch a `/api/*` sin archivo coincidente llega al Worker. No agregar `run_worker_first` global ni binding de assets.
- **Rationale**: La SPA y el backend ya comparten las rutas de mismo origen. Cloudflare especifica que en modo SPA las navegaciones no coincidentes reciben `index.html`, mientras que las solicitudes de cliente (por ejemplo `fetch('/api/...')`) llegan al Worker. El flag `assets_navigation_prefers_asset_serving` aplica esta resolución con la fecha de compatibilidad existente y evita invocar lógica del Worker para navegaciones estáticas.
- **Costos Free Tier**: Cloudflare indica que las solicitudes servidas directamente como Static Assets son gratis y sin límite de solicitudes; las que invocan el script Worker siguen sujetas a la facturación/cuota de Workers. Esta migración reduce el costo de entrega de archivos, pero no el costo de polling ni otras rutas API.
- **Alternativas consideradas**:
  - `run_worker_first = true`: descartado porque invocaría el Worker antes de cada archivo y anularía el ahorro previsto de solicitudes estáticas.
  - Actualizar `compatibility_date`: descartado para reducir los cambios de runtime no relacionados. Se activa únicamente el flag requerido.
  - Agregar `binding = "ASSETS"`: descartado porque el código actual no necesita llamar a Assets manualmente ni transformar sus respuestas.

Fuente primaria: [SPA routing](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/), [Worker script routing](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/), [compatibility flags](https://developers.cloudflare.com/workers/configuration/compatibility-flags/).

Fuente primaria de costos: [Static Assets billing and limitations](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/).

## Decisión: compilar antes de ejecutar Wrangler local o publicar

- **Decisión**: Los comandos `worker:dev` y `worker:deploy` ejecutan `npm run build` antes de Wrangler.
- **Rationale**: Assets toma sus archivos desde `dist/`; si el directorio no existe o está obsoleto, la interfaz y el Worker no representan la versión actual. Compilar de forma automática convierte el contrato en una operación reproducible.
- **Alternativas consideradas**:
  - Pedir build manual antes de cada inicio o deploy: descartado porque es fácil de omitir.
  - Cambiar el comando de Vite `dev`: descartado; el servidor HMR y el proxy API permanecen como workflow existente.

## Compatibilidad y alcance local

- Configuración soportada por Wrangler instalado `4.151.1`, verificada contra su esquema local y `wrangler dev --help`.
- Validar localmente con `wrangler dev` y D1 local; nunca pasar `--remote`.
- El `deploy --dry-run` solo valida empaquetado y no prueba la configuración remota. No ejecutar el deploy real en este cambio.
