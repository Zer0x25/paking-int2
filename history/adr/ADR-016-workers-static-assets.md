# ADR-016: Migrar de Workers Sites a Workers Static Assets

- **Estado**: Aceptado
- **Fecha**: 2026-10-17
- **Feature**: [010-workers-static-assets](../../specs/010-workers-static-assets/spec.md)

## Contexto

La aplicación tiene una SPA React/Vite que compila a `dist/` y un Worker Hono que expone todas las rutas dinámicas bajo `/api/*`, con D1 como binding. La configuración actual usa `[site]`, mecanismo heredado que Cloudflare deprecó en Wrangler v4. Vite ofrece el flujo HMR en 5173 y su proxy apunta al Worker local en 8787. El proyecto necesita validar el artefacto integrado antes de un eventual despliegue al plan Free.

## Decisión

- Usar Workers Static Assets dentro del Worker actual con `directory = "./dist"` y `not_found_handling = "single-page-application"`.
- Conservar `compatibility_date = "2024-10-15"` y añadir `assets_navigation_prefers_asset_serving`, para no activar cambios de runtime no relacionados y servir las navegaciones SPA estáticamente.
- Mantener enrutamiento asset-first predeterminado. Los archivos existentes se sirven sin Hono; las solicitudes fetch que no coincidan con un archivo, incluidas `/api/*`, pasan al Worker.
- No configurar `run_worker_first` ni `binding = "ASSETS"`: la aplicación no requiere autorización previa del documento HTML, transformación de assets ni lectura manual desde el Worker.
- Hacer que `worker:dev` y `worker:deploy` generen `dist/` con `npm run build` antes de iniciar Wrangler.
- Mantener `npm run dev` y el proxy API existentes para preservar HMR.
- Validar con Wrangler local y `deploy --dry-run`; no ejecutar un despliegue remoto ni tocar recursos productivos en esta decisión.

## Alternativas consideradas

- **Mantener `[site]`**: descartado porque Workers Sites está deprecado en Wrangler v4 y se apoya en Workers KV.
- **Separar la interfaz en Pages**: descartado porque introduciría dos servicios y otro origen de configuración sin aportar valor a la prueba integrada solicitada.
- **Ejecutar el Worker primero en todas las rutas**: descartado porque llevaría archivos estáticos por Hono y podría incrementar invocaciones sin necesidad.
- **Migrar al plugin Cloudflare Vite**: diferido; el proyecto ya separa el HMR de Vite y el Worker Wrangler. La migración al plugin sería un cambio de flujo más amplio.
- **Subir la fecha de compatibilidad a la actual**: descartado para esta feature; habilitar un único flag reduce el alcance del cambio de runtime.

## Consecuencias

- Localmente, `http://127.0.0.1:8787/` sirve la compilación junto con `/api/*`; Vite sigue disponible en 5173 para HMR.
- En un despliegue futuro, el Worker y los archivos estáticos se publicarán como una unidad. Las navegaciones y assets no necesitan invocar la lógica dinámica del Worker; las llamadas API siguen siendo Worker requests.
- El HTML estático es el shell de la aplicación y no contiene datos de negocio ni secretos. El acceso a datos sigue controlado por las rutas autenticadas.
- La compilación debe ejecutarse antes de iniciar Wrangler para evitar servir o publicar un `dist/` ausente o desactualizado.
- Este ADR no autoriza ni ejecuta la publicación remota.

## Referencias

- [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/)
- [Workers Sites (deprecation notice)](https://developers.cloudflare.com/workers/configuration/sites/)
- [SPA routing](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/)
- [Compatibility flags](https://developers.cloudflare.com/workers/configuration/compatibility-flags/)

## Addendum: completar recursos PWA

- **Fecha**: 2026-10-17
- **Motivo**: La verificación local encontró que el HTML y el manifiesto anunciaban iconos inexistentes.
- **Decisión**: Mantener un SVG de marca como fuente y publicar variantes SVG, PNG e ICO bajo `public/`; validar referencias, firmas y dimensiones antes de empaquetar.
- **Consecuencia**: Los navegadores, la instalación PWA y el service worker reciben los recursos configurados. No se agrega una dependencia de ejecución ni se cambia el enrutamiento de Workers Static Assets.
- **Validación**: Seis iconos servidos desde Wrangler local con 200 y MIME de imagen; manifiesto y precache incluyen sus archivos.
