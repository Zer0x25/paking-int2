---
id: PHR-004
stage: implementation-and-verification
date: 2026-10-17
branch: 004-operational-view-separation
command: interactive implementation request
model: Codex GPT-6
---

# PHR-004: Separación de Garita Operativa y Dashboard

## Prompt exacto del usuario

> ook, entonces trabajemos e el diesñpo de la interfaz,, e la garita operativo repito las fichas que ya tengo en el dashboard, asi que no tiene sentdo tenerlas dupliadas, para una operacion limpia, seraparasmo las vistas como ya estan, entre garita operativa y dhasboras, sin repetir

## Especificación y decisiones

- Se creó la feature `004-operational-view-separation` y se revisó sin preguntas de aclaración; el objetivo estaba confirmado por la solicitud y por la comparación de las dos vistas en navegador.
- Garita Operativa conserva los formularios de entrada y salida y deja de mostrar los indicadores y desgloses del Dashboard.
- Dashboard conserva ocupación global, vehículos adentro, disponibilidad, reserva flotante, distribución por áreas y asignación por unidad de negocio.
- El indicador de conexión/sincronización permanece compartido; roles, Configuración, refresco de métricas, formularios, reglas y API no cambian.
- Una utilidad pura expresa las secciones visibles por pestaña para evitar duplicaciones y probar el límite entre vistas.

## Resultado

La composición de pestañas ahora mantiene las operaciones de garita separadas del monitoreo. El navegador local quedó en Garita Operativa, mostrando ambos formularios y sin fichas duplicadas.

## Pruebas y verificación

- TDD Red: la prueba nueva falló al no existir `@client/utils/operational-view`.
- Pruebas focalizadas: 3 pasaron.
- Suite completa con cobertura: 111 pruebas en 15 archivos, todas pasaron; cobertura global 95,12% en líneas y 86,59% en ramas.
- `npm run typecheck`: correcto.
- `npm run build`: correcto; se generaron bundle y service worker.
- `git diff --check`: correcto.
- Navegador real: Garita muestra entrada/salida, no muestra monitoreo; Dashboard mantiene todas las fichas y desgloses y no muestra formularios.
- Checklist de requisitos: 16/16; checklist UX: 8/8.
- Análisis pre-código: sin brechas ni conflictos entre spec, plan y tareas. Convergencia post-implementación revisada sin tareas faltantes.

## Archivos de la feature

- `specs/004-operational-view-separation/`
- `src/client/App.tsx`
- `src/client/utils/operational-view.ts`
- `tests/unit/client/test_operational_view.test.ts`

No se creó commit ni se hizo push.
