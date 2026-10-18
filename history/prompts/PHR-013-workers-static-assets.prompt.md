---
id: PHR-013
stage: feature-design-and-implementation
date: 2026-10-17
branch: 010-workers-static-assets
command: continue migration from Workers Sites to Workers Static Assets
model: Codex GPT-6
---

# PHR-013: Migración a Workers Static Assets

## Prompt del usuario

> entonecs estamos trabajando sobre una base antigua de cloudflare? assets es el nuevo estandar?
>
> eso es lo que queria del principio, entones debemos actualizar la base para que podamos hacer esta migracion

## Decisiones de alcance

- El usuario confirma actualizar la base para migrar desde el mecanismo antiguo Workers Sites a Workers Static Assets.
- Mantener Vite HMR y su proxy a Worker 8787; compilar la interfaz antes del Worker local y del flujo de despliegue.
- Mantener `compatibility_date` y activar solamente la opción necesaria para el enrutamiento de navegación SPA.
- D1, `.dev.vars`, contratos API, reglas de negocio y datos persistidos permanecen fuera del cambio.
- Verificar localmente con Wrangler, pruebas y dry run; no crear recursos remotos ni desplegar.

## Artefactos de diseño

- Especificación aprobada: `specs/010-workers-static-assets/spec.md`.
- Plan e investigación de fuentes oficiales: `specs/010-workers-static-assets/plan.md`, `research.md`.
- Contrato y quickstart: `specs/010-workers-static-assets/contracts/worker-assets-routing.md`, `quickstart.md`.
- ADR-016 aceptado para esta migración autorizada: `history/adr/ADR-016-workers-static-assets.md`.
- Estado inicial: branch `010-workers-static-assets`, checkout limpio antes de crear artefactos.

## Verificación y resultado

- La especificación, clarificación (sin preguntas funcionales pendientes), plan, checklist, tareas y análisis de consistencia se completaron antes de producción. La decisión arquitectónica quedó en ADR-016.
- El análisis cruzado previo al cambio no encontró contradicciones ni requisitos/criterios sin tarea o verificación asociada. El checklist reviewer-owned `checklists/worker-routing.md` conserva sus 8 puntos sin marcar; no se alteraron los marcadores de revisión.
- TDD de configuración: antes de cambiar `wrangler.toml` y `package.json`, `vitest run tests/unit/config/workers-assets.test.ts` falló en 2 de 3 aserciones por `[site]` y falta de build previo; tras el cambio pasó 3/3.
- `npm run build`, `npm test` (26 archivos/153 pruebas unitarias y 7/25 pruebas Worker), `npm run typecheck`, `npm run lint` y `npm audit` finalizaron con código 0. Audit reportó cero vulnerabilidades.
- `npm run test:coverage`: unitarios 94.35% sentencias, 88.76% ramas, 90.98% funciones y 95.29% líneas; Workers 89.87%, 85.19%, 90.47% y 92.65% respectivamente. Los umbrales configurados de 85% se superaron.
- Wrangler `worker:dev` generó primero `dist/` e inició el Worker en 8787 con D1 local y secretos de `.dev.vars` ocultos. Vite permaneció en 5173.
- Validación HTTP local: `/` 200 HTML; `/dashboard` 200 HTML con navegación de navegador; asset JavaScript 200 `text/javascript` (286499 bytes); `/api/health` 200 JSON; ruta API desconocida y archivo ausente 404 sin HTML. Vite 5173 respondió 200 en `/` y su proxy devolvió 200 JSON en `/api/health`.
- La primera sonda de navegación con Node `fetch` devolvió 404 porque ese cliente no simuló una navegación de navegador. La ruta se verificó después con Chrome real y una solicitud con `Sec-Fetch-Mode: navigate`; ambas dieron 200.
- El navegador real abrió `http://localhost:8787/dashboard` y mostró el shell/login de Smart Parking. Las solicitudes estáticas no produjeron entradas del logger Hono; las de `/api/*` sí.
- `npm run worker:deploy -- --dry-run` compiló de nuevo y Wrangler leyó 8 archivos de `dist/`; mostró total de bundle 502.88 KiB (95.63 KiB gzip) y salió por `--dry-run`, sin despliegue.
- Cloudflare documenta que Static Assets se sirve gratis y sin límite de solicitudes; las llamadas que llegan al Worker siguen sujetas a la cuota de Workers. Por eso la entrega de la SPA queda fuera del presupuesto de invocaciones, pero el polling actual de la API continúa contando.
- Hallazgo separado: el manifiesto PWA y el HTML referencian `/icon-192.png`, `/icon-512.png` y `/favicon.svg`, pero no hay archivos fuente para ellos. Workers Static Assets los devuelve 404. No se amplió la migración de hosting para crear iconografía.
- Se dejó el Worker local disponible en 8787 para seguir iterando. No se desplegó, no se accedió a D1 remoto, no se modificó `.dev.vars`, y no se hizo commit ni push.
