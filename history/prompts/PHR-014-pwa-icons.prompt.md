---
id: PHR-014
stage: feature-implementation-and-verification
date: 2026-10-17
branch: 010-workers-static-assets
command: complete missing PWA icons and publish authorized feature branch
model: Codex GPT-6
---

# PHR-014: Completar los iconos de la PWA

## Prompt del usuario

> soluciona lo pendiente detectado u commit and push

## Alcance y decisión

- El usuario amplía la feature aprobada 010 para resolver los iconos configurados que faltaban en `public/`.
- Se amplió `specs/010-workers-static-assets/spec.md` con la historia de usuario, FR-012 y SC-008; tareas T015-T018 registran el contrato, implementación y verificación.
- Se conserva una fuente SVG de marca y se publican las variantes SVG, PNG e ICO que ya declaraban el HTML y la configuración PWA. No se agrega dependencia de ejecución.
- Se añadió un addendum a ADR-016 porque el empaquetado de PWA debía cubrir los iconos y sus referencias, no solo las rutas SPA/API.
- No se desplegó en Cloudflare ni se accedió a D1 remoto.

## Implementación

- `public/favicon.svg` es el icono Smart Parking con fondo navy y la P en gradiente violeta/índigo; se generaron `favicon.ico` (32×32), `apple-touch-icon.png` (180×180), `icon-192.png` y `icon-512.png` desde ese mismo SVG. `mask-icon.svg` es la variante monocromática.
- `index.html` ahora enlaza favicon SVG/ICO, Apple Touch y máscara; Vite ya configuraba los seis recursos para el precache y el manifiesto PWA ya referenciaba los PNG de 192 y 512.
- `tests/unit/pwa/pwa-icons.test.ts` deriva recursos de `index.html` y `vite.config.ts`, comprueba presencia, firmas SVG/ICO/PNG y dimensiones.

## Verificación

- TDD RED: la prueba nueva falló antes de crear iconos y mostró las seis rutas ausentes. TDD GREEN: las cuatro pruebas del contrato pasaron.
- `npm run build` y `npm run worker:deploy -- --dry-run` finalizaron correctamente. Wrangler empaquetó los 14 archivos de `dist/` (502.88 KiB; 95.63 KiB gzip) y salió por `--dry-run`.
- `npm test`: 27 archivos/157 pruebas unitarias y 7 archivos/25 pruebas Worker pasaron.
- `npm run test:coverage`: unit tests 94.35% sentencias, 88.76% ramas, 90.98% funciones, 95.29% líneas; Workers 89.87%, 85.19%, 90.47% y 92.65% respectivamente. Todos superan el 85% requerido.
- `npm run typecheck`, `npm run lint`, `npm audit` y `git diff --check` terminaron con código 0; npm audit encontró cero vulnerabilidades.
- En Wrangler local 8787, los seis iconos respondieron 200: SVG `image/svg+xml`; ICO `image/vnd.microsoft.icon`; PNG `image/png`. Los tamaños PNG fueron 180×180, 192×192 y 512×512. El manifiesto respondió 200 y conservó sus dos referencias; el service worker precachea los seis iconos.
- Wrangler local también conservó `/` y navegación directa a `/dashboard` con 200 HTML, `/api/health` con 200 JSON y una ruta API desconocida con 404 sin fallback HTML.
- Vite en 5173 respondió 200 para la raíz y los seis iconos; los enlaces del HTML coinciden con sus recursos.
- El icono se inspeccionó visualmente a 512×512. Se dejaron el Worker y Vite locales ejecutándose en 8787 y 5173.
