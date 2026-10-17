# Implementation Plan: Flujo guiado de garita

**Branch**: `008-gate-entry-wizard` | **Date**: 2026-10-17 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/008-gate-entry-wizard/spec.md`

## Summary

Convertir el formulario actual de garita en una secuencia por pasos: ingresar y validar la patente, elegir el movimiento y, para una entrada, confirmar unidad, tipo de espacio y área/sector antes de crear la sesión. Se reutilizan los handlers online/offline y la lista activa; no se modifica el dominio ni la API.

## Technical Context

**Language/Version**: TypeScript 5.7, React 18, CSS

**Primary Dependencies**: Vite 6, React 18, IndexedDB (`idb`) y Vitest. Para montar pruebas de componentes se añadieron `@testing-library/react` y `jsdom` como dependencias de desarrollo; no se agregaron dependencias de ejecución.

**Storage**: Sin cambios. Las sesiones y mutaciones offline usan IndexedDB y los endpoints actuales.

**Testing**: Vitest. Escribir primero pruebas por historia, demostrar la fase roja, implementar y ejecutar las pruebas junto con la cobertura del proyecto. React Testing Library y jsdom se usan para las pruebas de interacción del componente.

**Target Platform**: Navegadores modernos de escritorio y móvil, PWA instalada o web.

**Project Type**: Aplicación web React offline-first con API Cloudflare Worker existente.

**Performance Goals**: Cambio de paso inmediato, sin navegación ni solicitudes de red hasta que el operador complete la acción elegida.

**Constraints**: Mantener formato de patente, validaciones de sesiones, funcionamiento online/offline, outbox, comprobante, lista activa, edición de patente activa y salida rápida; conservar accesibilidad y ancho móvil base de 375 px.

**Scale/Scope**: Flujo de la tarjeta de operación en Garita y sus estilos. No se agregan entidades persistentes, endpoints ni dependencias de ejecución.

## Clarification Review

La entrevista de aclaración no encontró decisiones funcionales pendientes. La especificación fija que Salida se ejecuta al seleccionarla tras validar la patente, mientras Entrada abre una revisión explícita y la opción automática/flotante cuenta como una selección válida de sector.

## Constitution Check

- **I. Especificación y arquitectura hexagonal/offline-first**: Conforme. La especificación precede al código; no se mueve lógica de dominio a la vista, no se cambia API ni persistencia y se conserva el fallback offline.
- **II. TDD y cobertura**: Conforme. La persona usuaria autorizó explícitamente agregar y ejecutar pruebas; los casos se derivan primero de la especificación y se demuestra la fase roja antes del código. La suite debe mantener cobertura >=85%.
- **III. Seguridad, esquemas y Cloudflare**: Conforme. Se reutilizan la normalización y validación actuales; no se aceptan nuevos datos externos ni se agregan endpoints.
- **IV. Definition of Done**: Se ejecutarán lint, chequeo de tipos, suite/cobertura y build según los comandos configurados en el proyecto.
- **V. Convergencia y E2E**: Tras implementar, se comparará el código con spec/plan/tasks y se recorrerán los criterios de aceptación en navegador real.
- **ADR**: ADR-012 registra el estado temporal del flujo y la reutilización de los handlers existentes.

## Design

1. Representar la navegación de la tarjeta con tres estados locales: `plate`, `movement` y `entry-details`. La patente y las selecciones siguen en estado React; no se crean sesiones hasta confirmar Entrada o ejecutar Salida.
2. En `plate`, mostrar solo patente y Registrar. Reusar `isValidLicensePlate`, `formatLicensePlateInput` y `normalizeLicensePlate`; bloquear el avance si la patente no es válida.
3. En `movement`, mostrar la patente normalizada y botones Entrada/Salida. Salida invoca la lógica existente de salida manual con la patente retenida. Un botón Volver permite corregirla.
4. En `entry-details`, mostrar patente, unidad, tipo, área/sector y la opción de asignación automática/flotante. Confirmar entrada llama al handler existente con las selecciones vigentes; Volver mantiene sus valores.
5. Al concluir una operación correctamente, limpiar patente, mensaje de la operación y comprobante apropiadamente y volver a `plate`. Si hay error, conservar el paso y valores editables.
6. Mantener la lista de activos y sus acciones sin cambios funcionales. Estilar pasos, botones y resumen con tokens actuales, controles accesibles y reflujo móvil.
7. Para identificadores creados desde navegador, usar `crypto.randomUUID()` cuando exista y construir un UUID v4 con `crypto.getRandomValues()` cuando no exista; centralizar la generación segura y reutilizarla en las operaciones cliente.

### Constitution Check After Design

- No se cambia el modelo persistido, contratos HTTP, autorización ni cola offline.
- La generación de UUID local usa Web Crypto; no introduce dependencias ni identificadores inseguros.
- TDD y la comprobación en navegador real se ejecutarán como parte de esta entrega.

## Project Structure

### Documentation (this feature)

```text
specs/008-gate-entry-wizard/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/gate-entry-flow.md
├── checklists/
└── tasks.md
```

### Source Code

```text
src/
├── client/
│   ├── components/VehicleGatePanel.tsx
│   └── index.css
└── core/utils/uuid.ts
```

**Structure Decision**: Se mantiene el flujo en la tarjeta actual `VehicleGatePanel`, donde ya se concentran los handlers de ingreso, salida manual, salida rápida, lista de sesiones y estados online/offline. Los formularios separados no son necesarios para este camino.

## Complexity Tracking

No hay excepciones a la Constitución ni cambios de arquitectura que requieran complejidad adicional.
