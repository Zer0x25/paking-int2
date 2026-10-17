# Implementation Plan: Sistema visual adaptable para Smart Parking

**Branch**: `006-responsive-design-system` | **Date**: 2026-10-17 | **Spec**: [spec.md](spec.md)

**Input**: [Feature specification](spec.md)

## Summary

Definir y aplicar un sistema visual compartido con temas Sistema/Claro/Oscuro, preferencia local persistente, tokens semánticos y patrones accesibles. Adaptar navegación, Garita, Dashboard y Configuración a un ancho base de 375 px sin perder flujos de negocio ni escritorio. Se añade ESLint como herramienta de desarrollo porque el repositorio lo exige como gate de calidad.

## Technical Context

**Language/Version**: TypeScript 5.7, React 18, CSS

**Primary Dependencies**: Vite 6, React 18, Vitest 4.1; ESLint, `@eslint/js`, `typescript-eslint` y `globals` como herramientas de desarrollo

**Storage**: `localStorage` para la preferencia visual; no se modifica D1, IndexedDB operativo ni el outbox

**Testing**: Vitest para preferencia/control de tema; `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test:coverage`; navegador real en 375 px y escritorio

**Target Platform**: PWA en navegadores móviles y de escritorio ya soportados

**Project Type**: Aplicación web React con cliente offline-first y API Worker existente

**Performance Goals**: Aplicar el tema efectivo antes de mostrar la primera vista para evitar un destello perceptible; cambio de tema inmediato sin navegación ni recarga

**Constraints**: Mantener operación offline; no añadir dependencias de ejecución; contraste normal >=4.5:1, contraste de texto grande y elementos gráficos necesarios >=3:1; área táctil primaria >=44x44 px; conservar comportamiento actual

**Scale/Scope**: Tokens y patrones base; inicio de sesión y marco global; vistas Garita, Dashboard y Configuración en 375 px, anchuras intermedias y escritorio

## Constitution Check

- **I. Especificación, arquitectura y offline-first**: Pasa. `spec.md` fue aclarada con la persona usuaria. Preferencia visual local no altera el dominio; la app sigue disponible offline.
- **II. TDD y cobertura**: Pasa como diseño. Se probará primero la resolución, persistencia y cambio de tema; cambios UI y layout se validarán en navegador real. Se conserva Vitest y el gate de cobertura >=85%.
- **III. Seguridad y validación**: Pasa. No se añaden endpoints ni datos remotos; la preferencia local se limita a un enum allowlist y el sistema cae a `system` ante valores desconocidos.
- **IV. Definition of Done**: Pasa como plan. Se incorpora ESLint con flat config para TypeScript/TSX y JavaScript; se ejecutan lint, cobertura, typecheck, build y navegador.
- **V. Convergencia y E2E**: Pasa como plan. Se auditan spec/plan/tasks después de implementar y se verifica cada vista en navegador real.
- **ADR**: ADR-008 registra la preferencia del sistema, selección local y tokens CSS semánticos. ADR-009 registra ESLint como gate de desarrollo obligatorio.

## Diseño

1. Centralizar tokens de color semánticos para fondo, superficies, texto, borde, foco, acento y estados. Mantener el acento morado existente, con valores distintos por tema que cumplan los contrastes del spec.
2. Crear una preferencia `system | light | dark`. Resolver `system` con `prefers-color-scheme`, reaccionar a cambios del dispositivo mientras esté seleccionada esa opción y conservar una selección explícita en `localStorage`.
3. Aplicar el tema antes del primer render con un bootstrap pequeño y defensivo. Un control accesible reutilizable expone Sistema, Claro y Oscuro tanto en la sesión autenticada como en el inicio de sesión.
4. Sustituir superficies, bordes y estados de color hard-coded en las vistas dentro del alcance por roles semánticos. Mantener una jerarquía común para encabezados, tarjetas, botones, campos, mensajes y datos operativos.
5. Ajustar el encabezado, navegación, listas, dashboards, formularios y configuración mediante reglas responsive: una columna o tarjetas apiladas cuando el ancho no sostenga columnas; acciones completas y visibles; scroll vertical normal.
6. Mantener `prefers-reduced-motion`, foco visible, nombres accesibles y colores de controles del navegador sincronizados con el tema.

## Project Structure

### Documentación de la feature

```text
specs/006-responsive-design-system/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── design-system.md
├── contracts/ui-system.md
├── quickstart.md
├── checklists/
└── tasks.md
```

### Código

```text
eslint.config.mjs
package.json
index.html
src/client/App.tsx
src/client/index.css
src/client/styles/design-tokens.css
src/client/utils/theme-preference.ts
src/client/components/ThemeSelector.tsx
src/client/components/LoginView.tsx
src/client/components/VehicleGatePanel.tsx
src/client/components/OperationalDashboard.tsx
src/client/components/FacilityConfigView.tsx
src/client/components/BusinessUnitManager.tsx
src/client/components/EventBookingsManager.tsx
src/client/components/SyncStatusBar.tsx
tests/unit/client/test_theme_preference.test.ts
tests/unit/client/test_theme_selector.test.tsx
```

**Structure Decision**: Se conserva la aplicación cliente existente. Los tokens y la resolución de tema quedan en módulos cliente compartidos; los componentes existentes consumen los mismos roles y reglas responsive. No se crea un servicio, API ni paquete visual aparte. ESLint se incorpora solo como herramienta de desarrollo para cumplir el gate del repositorio.

## Verificación del Diseño

- Pruebas unitarias para preferencia por defecto, valores guardados válidos/inválidos, selección explícita y cambio del sistema.
- Pruebas de componente para etiquetas, opciones, selección inicial y cambio inmediato del control.
- Navegador real: login y las tres vistas a 375x812; verificación extra a 320 px para reflujo y a 1280 px para escritorio; repetir tema claro y oscuro.
- Revisar ausencia de overflow horizontal, acciones cortadas, foco no visible, contraste insuficiente y controles menores al tamaño acordado.
- Ejecutar `npm run lint`, `npm run test:coverage`, `npm run typecheck`, `npm run build`, `npm audit` y `git diff --check`.

## Complexity Tracking

No hay violaciones a la Constitución ni dependencias nuevas de ejecución. Se añaden dependencias de desarrollo para ESLint porque el gate constitucional exige un linter configurado. El objetivo táctil de 44x44 px es un criterio interno de comodidad más estricto que el mínimo AA de WCAG 2.2; la investigación registra el motivo y la fuente.
