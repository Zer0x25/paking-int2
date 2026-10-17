---
id: PHR-006
stage: specification-and-planning
date: 2026-10-17
branch: 006-responsive-design-system
command: interactive implementation request
model: Codex GPT-6
---

# PHR-006: Sistema visual adaptable

## Prompt del usuario

> commit, y continua con el diseño, crea un system desing, y la app debe funcionar con claro / oscuro, y vistas movies, es decir emn panallas pequeñas de movil partirendo ed la base 375px, como pequeña,

## Aclaraciones recibidas

- El tema inicial debe seguir al sistema; la persona puede elegir Sistema, Claro u Oscuro y recordar su elección.
- La adaptación móvil cubre Garita, Dashboard y Configuración.

## Decisiones de producto y arquitectura

- Se conserva la preferencia visual en el navegador actual, sin añadir APIs ni datos de negocio.
- Se usan tokens CSS semánticos compartidos, un selector de tema en login y navegación autenticada, y breakpoints responsive para las vistas acordadas.
- El tema efectivo se aplica antes de exponer la primera vista; se conservan operación offline, permisos y flujos existentes.
- 44×44 CSS px es el objetivo ergonómico de controles principales; no se atribuye al mínimo AA de WCAG.
- Commit previo relacionado: `1b4e70b feat(gate): unify vehicle entry and exit` en `005-gate-operations`. No se crea un commit para esta nueva feature sin una instrucción explícita posterior.

## Artefactos creados

- `specs/006-responsive-design-system/spec.md`
- `specs/006-responsive-design-system/plan.md`
- `specs/006-responsive-design-system/research.md`
- `specs/006-responsive-design-system/data-model.md`
- `specs/006-responsive-design-system/contracts/ui-system.md`
- `specs/006-responsive-design-system/quickstart.md`
- `specs/006-responsive-design-system/design-system.md`
- `specs/006-responsive-design-system/checklists/requirements.md`
- `specs/006-responsive-design-system/checklists/ux-requirements.md`
- `history/adr/ADR-008-responsive-design-system-and-theme.md`

## Estado de la transición

La especificación está aprobada y aclarada. Continúa la generación de tareas por historia, análisis de consistencia y luego implementación TDD; la revisión UX permanece sin marcar por el agente.
