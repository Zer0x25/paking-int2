# Contrato local de enrutamiento SPA y API

El mismo origen sirve artefactos de interfaz y API. Los casos distinguen navegaciones de navegador de solicitudes fetch.

| Solicitud | Respuesta esperada | Responsable |
|---|---|---|
| `GET /` con navegación HTML | `200`, HTML de la aplicación | Workers Static Assets |
| `GET /dashboard` con navegación HTML | `200`, mismo punto de entrada SPA | Workers Static Assets |
| `GET /assets/<archivo-generado>` | `200`, bytes y tipo del archivo generado | Workers Static Assets |
| `GET /api/health` como solicitud de cliente | `200`, JSON de salud del Worker | Hono en el Worker |
| `GET /api/ruta-inexistente` como solicitud de cliente | `404` de API, nunca el HTML de la SPA | Hono en el Worker |
| `GET /favicon.svg` | `200`, SVG de marca válido | Workers Static Assets |
| `GET /favicon.ico` | `200`, icono ICO válido | Workers Static Assets |
| `GET /apple-touch-icon.png` | `200`, PNG de 180×180 | Workers Static Assets |
| `GET /mask-icon.svg` | `200`, SVG monocromático válido | Workers Static Assets |
| `GET /icon-192.png` | `200`, PNG de 192×192 | Workers Static Assets |
| `GET /icon-512.png` | `200`, PNG de 512×512 | Workers Static Assets |
| Ruta de asset no encontrada sin navegación HTML | `404`, nunca fallback SPA | Workers Static Assets / Worker según el request |

## Reglas

- El fallback `single-page-application` aplica a navegación HTML que no encuentra un archivo.
- Las solicitudes fetch a `/api/*` no deben enviar `Sec-Fetch-Mode: navigate`; llegan al Worker y mantienen sus códigos y cuerpos HTTP.
- No configurar ejecución Worker-first para todos los assets; no se necesita autenticación del HTML estático ni transformación en runtime.
- No incluir respuestas API, datos de D1 ni secretos en el build estático.
- Cada ruta de icono referenciada por `index.html` o `vite.config.ts` debe existir bajo `public/` y formar parte de `dist/`.
- Las variantes PNG deben tener las dimensiones indicadas; los recursos SVG e ICO deben conservar sus firmas de formato.
