# Implementation Plan: Flujo inteligente de patente en Garita

**Branch**: `014-smart-gate-flow` | **Date**: 2026-10-18 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/014-smart-gate-flow/spec.md`

## Summary

Garita inferirá la única operación disponible a partir de la patente normalizada y las sesiones activas que ya están cargadas para el recinto. Una patente activa mostrará sus datos y una acción explícita de salida; una patente válida sin sesión activa ofrecerá continuar con la confirmación existente de entrada. Mientras se escribe, el cliente filtrará localmente un máximo de cinco coincidencias por prefijo, con selección por teclado y tecnologías de asistencia. No se agregan consultas por tecla, endpoints, tablas ni dependencias.

## Technical Context

**Language/Version**: TypeScript 5.7, React 18

**Primary Dependencies**: Vitest 4, React Testing Library 16, IndexedDB (`idb`), funciones de dominio existentes para normalizar y validar patentes

**Storage**: Sin cambios; sesiones activas existentes de la lista de Garita y caché IndexedDB actual

**Testing**: Vitest + jsdom/React Testing Library para pruebas de interacción; typecheck, ESLint, build y flujo de navegador local

**Target Platform**: PWA operativa de escritorio y móvil, viewport mínimo 375 px; navegador compatible con la aplicación existente

**Project Type**: Aplicación web con cliente React/Vite y Worker/API existentes

**Performance Goals**: Respuesta de sugerencias en el mismo ciclo de render del cliente; cero solicitudes de red adicionales por tecla; hasta cinco opciones visibles

**Constraints**: Reutilizar sesiones activas y reglas de salida ya existentes; respetar modo offline, caché local, reconciliación y conflictos; no permitir salida implícita ni entrada duplicada visible

**Scale/Scope**: Un panel de garita, su hoja de estilos, pruebas del asistente y artefactos de especificación; sin cambios al servidor, D1, sincronización ni esquema

## Constitution Check

**Pre-Phase 0 gate**

- Spec aprobada por el usuario y clarificada en `spec.md`; análisis Spec Kit se ejecutará antes de producción.
- El flujo pertenece a la interfaz de Garita. La validación y normalización de patente permanecen en el módulo de dominio puro.
- Se preservan persistencia y operación offline-first mediante IndexedDB y la cola de mutaciones existente.
- Se redactarán primero pruebas basadas en `spec.md` y el contrato de interfaz; deben fallar antes de editar producción.
- La búsqueda usa el estado local de sesiones activas; no introduce lecturas D1 por tecla ni entradas externas nuevas que requieran esquemas Zod.
- Se mantienen autenticación, autorización, auditoría y contratos API existentes; no se cambian endpoints.
- Verificación prevista: pruebas enfocadas, `npm test`, `npm run test:coverage` (umbrales de 85% para unitarias y Workers), `npm run typecheck`, `npm run lint`, `npm run build`, y comprobación visual del flujo en navegador local.

**Post-design gate**: Pass. El plan no crea un módulo de dominio nuevo, API, persistencia ni dependencia. Los cambios se limitan a la presentación de datos ya validados y a handlers existentes de entrada/salida. La auditoría no encontró una decisión arquitectónica nueva que requiera ADR; el historial de sesión se registrará en un PHR.

## Project Structure

### Documentation (this feature)

```text
specs/014-smart-gate-flow/
├── plan.md
├── research.md
├── data-model.md
├── contracts/
│   └── gate-flow-ui.md
├── quickstart.md
├── checklists/
│   ├── requirements.md
│   └── ux.md
└── tasks.md
```

### Source Code

```text
src/client/components/VehicleGatePanel.tsx
src/client/index.css
tests/unit/client/test_gate_entry_wizard.test.tsx
history/prompts/PHR-023-smart-gate-flow.prompt.md
```

**Structure Decision**: Cambios incrementales en el panel de operación y en estilos compartidos del cliente. Las pruebas de integración del componente se mantienen en el archivo existente de flujo guiado de Garita. Sin nueva estructura de runtime.

## Phase 0: Research

Decisiones detalladas y alternativas en [research.md](research.md). No quedan incógnitas de producto pendientes.

## Phase 1: Design & Contracts

- [data-model.md](data-model.md) documenta el estado derivado del panel y las transiciones; no hay cambios persistidos.
- [contracts/gate-flow-ui.md](contracts/gate-flow-ui.md) establece el comportamiento observable y accesible de búsqueda y decisión.
- [quickstart.md](quickstart.md) define cómo validar localmente los flujos de entrada y salida.
- No se requiere contrato de API ni migración porque se consumen las sesiones activas ya cargadas.

## Complexity Tracking

No hay excepciones a la Constitución que requieran Complexity Tracking.
