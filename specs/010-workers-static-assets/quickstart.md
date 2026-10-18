# Validación local de Workers Static Assets

Esta guía usa exclusivamente el Worker y D1 locales.

## Requisitos

- Node.js y dependencias del proyecto instaladas.
- `.dev.vars` configurado localmente para probar autenticación; no imprimirlo ni versionarlo.
- El Worker esperado en `127.0.0.1:8787` y, opcionalmente, Vite en `127.0.0.1:5173`.

## Validar el Worker integrado

1. `npm run build`
2. `npm run worker:dev`
3. Abrir `http://127.0.0.1:8787/` en un navegador. Debe aparecer la aplicación.
4. Abrir `http://127.0.0.1:8787/dashboard` directamente. Debe cargar el punto de entrada de la SPA.
5. En DevTools o con una solicitud fetch, pedir `http://127.0.0.1:8787/api/health`. Debe devolver JSON del Worker.
6. Pedir `http://127.0.0.1:8787/api/ruta-inexistente` con `Accept: application/json`. Debe ser 404 de API y no HTML.
7. Consultar un archivo `src` devuelto por `dist/index.html`; debe devolver 200 y los bytes generados.
8. Solicitar `/favicon.svg`, `/favicon.ico`, `/apple-touch-icon.png`, `/mask-icon.svg`, `/icon-192.png` y `/icon-512.png`; cada uno debe devolver 200 con MIME de imagen válido. `apple-touch-icon.png` mide 180×180, `icon-192.png` 192×192 e `icon-512.png` 512×512.
9. Abrir `/manifest.webmanifest` y confirmar que sus dos iconos existen; verificar que `dist/sw.js` precachea los seis recursos.

## Mantener el flujo con HMR

1. En otra terminal ejecutar `npm run dev`.
2. Abrir `http://127.0.0.1:5173/`; Vite conserva HMR y envía `/api/*` al Worker local en 8787.

## Comprobar empaquetado de deploy sin publicar

- Ejecutar `npm run worker:deploy -- --dry-run` después de compilar; npm reenvía `--dry-run` al comando Wrangler del script.
- Confirmar que Wrangler detecta `dist/` en el resumen de assets.
- No usar `--remote`, `wrangler deploy` sin `--dry-run`, ni modificar variables o recursos del dashboard.

El dry run confirma empaquetado, no valida recursos remotos ni reemplaza una publicación de prueba autorizada.

## Resultado observado en esta iteración

- Wrangler local en 8787: `/` y navegación directa a `/dashboard` devolvieron 200 HTML; el JavaScript compilado devolvió 200 con `text/javascript`.
- `/api/health` devolvió 200 JSON; las rutas API y de asset inexistentes devolvieron 404 sin HTML de respaldo.
- La prueba del flujo Vite en 5173 devolvió 200 para la interfaz y para el proxy `/api/health`.
- Wrangler dry run empaquetó los 8 archivos de `dist/` y terminó sin publicar.
- Resolución del hallazgo PWA: se agregaron los seis recursos anunciados por el HTML/manifiesto/configuración. La prueba de contrato detectó la ausencia de los seis antes de crearlos; después verificó fuentes, firmas SVG/ICO/PNG y dimensiones. En Wrangler local, cada recurso respondió 200 con su MIME esperado; el manifiesto, el precache, la SPA y `/api/health` también respondieron correctamente.
