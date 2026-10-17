---
id: PHR-001
stage: implementation-and-verification
date: 2026-10-17
branch: main
command: interactive implementation request
model: Codex GPT-6
---

# PHR-001: Dashboard refresh and parking area lifecycle

## Prompt exacto del usuario

> hay un reload que tien un gliht visual, flashea la pagina, en dashboard ese reload, vuevle la pagina al incio,  y lo toro aprovechemos el prompt y te comento queno puedo ni editar ni borar areas

## Aclaración del usuario

> Sí, todos los campos (Recommended)

La aclaración responde a qué campos debe incluir el editor: nombre, código, descripción, régimen/unidad de negocio y capacidad.

## Respuesta y resultado

Se mantuvo montado el contenido del dashboard durante las consultas periódicas para evitar el flash y el salto de scroll. Se implementó la edición versionada de todos los campos del área y la baja lógica confirmada; la baja se rechaza si el área tiene ocupación, el registro queda visible como inactivo y su capacidad vuelve al buffer. Se verificó el flujo en navegador con datos locales descartables y luego se reinició el Worker para dejar la vista sin esos datos de QA.

## Archivos leídos o modificados

- `src/client/components/OperationalDashboard.tsx`
- `src/client/components/FacilityConfigView.tsx`
- `src/client/utils/dashboard-render-state.ts`
- `src/core/rules/areaAllocationRules.ts`
- `src/core/types/schema.ts`
- `src/server/routes/facilities.ts`
- `tests/unit/client/test_dashboard_render_state.test.ts`
- `tests/unit/core/test_area_allocation.test.ts`
- `tests/unit/server/test_area_api.test.ts`
- `specs/002-facility-area-setup/spec.md`
- `specs/002-facility-area-setup/tasks.md`
- `specs/002-facility-area-setup/contracts/api-facilities-areas.md`
- `specs/002-facility-area-setup/quickstart.md`
- `history/adr/ADR-003-parking-area-lifecycle.md`
- `history/adr/README.md`
- `vitest.config.ts`
- `vite.config.ts`

## Pruebas y verificaciones

- `npm test`: suite completa.
- `npm run test:coverage`: suite completa y cobertura de ramas mínima del 85%.
- `npm run typecheck`: comprobación TypeScript.
- Navegador: scroll del dashboard conservado durante polling; edición de todos los campos; baja lógica confirmada y liberación de capacidad. El navegador quedó en Configuración.

## Decisiones

- La baja es lógica para preservar referencias históricas; no se puede desactivar un área ocupada.
- Los códigos siguen reservados aunque el área esté inactiva.
- No se creó commit ni se publicó el cambio.
