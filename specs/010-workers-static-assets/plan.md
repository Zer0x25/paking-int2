# Implementation Plan: Publicación de la PWA con Workers Static Assets

**Branch**: `010-workers-static-assets` | **Date**: 2026-10-17 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/010-workers-static-assets/spec.md`

## Summary

Retirar la configuración heredada `[site]` y empaquetar la compilación actual de Vite en Workers Static Assets, manteniendo Hono y D1 en el Worker existente. Wrangler debe resolver navegaciones de la SPA como archivos estáticos y entregar las solicitudes API no coincidentes a Hono. Los comandos locales y de despliegue compilarán primero la interfaz. Se conservará Vite como servidor de recarga en caliente y la fecha de compatibilidad actual. La compilación incluirá todos los iconos que referencia la PWA y una prueba de contrato comprobará su existencia y formato antes de empaquetarlos.

## Technical Context

**Language/Version**: TypeScript 5.7, React 18, Wrangler 4.151.1
**Primary Dependencies**: Vite 6, Hono 4, Wrangler 4; no dependencia nueva prevista
**Storage**: D1 para persistencia central existente; IndexedDB para persistencia local existente; esta feature no modifica datos
**Testing**: Vitest unitario y `@cloudflare/vitest-pool-workers`; prueba de integración manual con Wrangler local y navegador
**Target Platform**: Cloudflare Workers con Workers Static Assets; validación local aislada
**Project Type**: Aplicación web SPA con API en Worker
**Performance Goals**: Responder archivos compilados sin pasar por la lógica Hono; sin introducir peticiones adicionales
**Constraints**: Conservar `compatibility_date = "2024-10-15"`, las rutas `/api/*`, D1 local y el proxy de Vite a 8787. No tocar recursos remotos ni desplegar.
**Scale/Scope**: Un bucket `dist/` por Worker; todas las pantallas actuales de la SPA y las rutas de API vigentes

## Constitution Check

| Principio | Estado | Evidencia / tratamiento |
|---|---|---|
| Arquitectura especificada antes de producción | PASS | Feature 010 aprobada, clarificada y analizada antes de implementar. |
| Hexagonal y Offline-First | PASS | Sin cambios al dominio, IndexedDB, outbox, D1 ni repositorios. |
| TDD Red/Green y Vitest | PASS | Añadir primero una prueba de configuración del contrato de Assets; comprobar fallo antes del cambio. Después ejecutar la prueba y un smoke test real con Wrangler local. |
| Seguridad, validación y secretos | PASS | No se agregan entradas, bindings, secretos ni operaciones de datos. `.dev.vars` permanece local. |
| Optimización Workers Free Tier | PASS | Archivos y fallback de navegación estáticos; las rutas API continúan en Hono. No se usará `run_worker_first` global. |
| Definition of Done | PASS | Ejecutar build, suites existentes, tipos, lint, audit y empaquetado `wrangler deploy --dry-run`; ningún despliegue real. |
| Navegador real | PASS | Abrir el Worker integrado local y verificar carga inicial, navegación interna y petición API desde navegador. |
| ADR y PHR | PASS | Registrar la decisión de Assets como ADR-016 y la sesión como PHR-013. |

No se identifican excepciones a la Constitución ni excepciones de complejidad que requieran justificación.

## Research Findings

Las decisiones y fuentes oficiales están detalladas en [research.md](research.md). En resumen, Workers Sites está deprecado en Wrangler v4; Workers Static Assets es la opción recomendada para una SPA con lógica de servidor. La configuración será asset-first: los archivos existentes y navegaciones SPA se sirven como estáticos y el Worker recibe las peticiones que no coincidan, incluidas las solicitudes API. Se añadirá solo la compatibilidad `assets_navigation_prefers_asset_serving`, preservando la fecha antigua sin cambiar el resto del runtime.

## Design & Contracts

- Modelo de datos: no se introducen entidades; ver [data-model.md](data-model.md).
- Contrato de rutas: [contracts/worker-assets-routing.md](contracts/worker-assets-routing.md).
- Recursos PWA: SVG de marca como fuente y variantes favicon/PNG de navegador, Apple y manifiesto; el contrato valida referencias y formatos.
- Validación manual reproducible: [quickstart.md](quickstart.md).
- Decisión arquitectónica: [ADR-016](../../history/adr/ADR-016-workers-static-assets.md).

## Project Structure

```text
wrangler.toml                         # Sustituir [site] por [assets] y fallback SPA
package.json                          # Compilar antes de Worker local y deploy
tests/unit/config/workers-assets.test.ts # Contrato automatizado de configuración/scripts
tests/unit/pwa/pwa-icons.test.ts       # Referencias, formatos y dimensiones de iconos
public/                                # Fuentes de iconos para Vite/PWA
specs/010-workers-static-assets/      # Especificación, plan, investigación y contrato
history/adr/ADR-016-workers-static-assets.md
history/prompts/PHR-013-workers-static-assets.prompt.md
```

**Structure Decision**: Mantener el proyecto y su configuración TOML existentes. No migrar a JSONC ni adoptar el plugin de Cloudflare para Vite como parte de este cambio: Vite ya sirve el flujo HMR y Wrangler debe probar el Worker y sus assets como unidad.

## Complexity Tracking

No hay violaciones constitucionales ni complejidad adicional que documentar.
