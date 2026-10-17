# Implementation Plan: Controles compactos para tema y conexión

**Branch**: `007-compact-header-controls` | **Date**: 2026-10-17 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/007-compact-header-controls/spec.md`

## Summary

Reemplazar el selector Sistema/Claro/Oscuro por un solo botón accesible de alternancia claro/oscuro, manteniendo el inicio basado en el sistema y la persistencia de elecciones explícitas. Reubicar el aviso de conectividad desde el contenido al encabezado como un indicador compacto que conserva el estado de conexión, el contador pendiente y la sincronización manual y automática.

## Technical Context

**Language/Version**: TypeScript 5.7, React 18

**Primary Dependencies**: Vite 6, React, IndexedDB (`idb`), Vitest existente

**Storage**: `localStorage` para preferencia visual; IndexedDB para la cola offline existente.

**Testing**: Vitest cliente y Workers están configurados. La suite no se modificará ni ejecutará durante esta solicitud.

**Target Platform**: Navegadores modernos de escritorio y móvil, PWA.

**Project Type**: Aplicación web frontend con backend Cloudflare Worker existente.

**Performance Goals**: Actualizar tema y estado en la interfaz sin recargas; no agregar dependencias ni llamadas de red para el cambio visual.

**Constraints**: Preservar la inicialización de tema antes del render, la sincronización offline existente, los controles accesibles y el diseño móvil de 375 px.

**Scale/Scope**: Botón de tema en acceso y aplicación autenticada; indicador de red solo en la cabecera autenticada.

## Constitution Check

- **SDD**: Conforme; especificación clara, plan, tareas y análisis preceden al cambio de código.
- **Arquitectura hexagonal/offline-first**: Conforme; no se cambia lógica de dominio, API, persistencia operativa ni transporte de sincronización.
- **Seguridad y validación**: Sin cambios de entradas externas ni permisos.
- **Accesibilidad**: El botón y el estado exponen nombres accesibles, foco y estados sin depender solo del color.
- **TDD**: La constitución solicita pruebas first, pero las instrucciones de esta sesión prohíben agregar o ejecutar pruebas salvo que el usuario lo solicite. El código queda sujeto a verificación posterior; no se declarará que pasó la suite.

## Design

### Approach

1. Mantener `system | light | dark` como estado interno para conservar compatibilidad con el bootstrap inicial. El nuevo botón deriva el tema actual de `effectiveTheme` y guarda explícitamente el contrario al ser pulsado.
2. Mantener el listener de cambios del sistema mientras la preferencia siga siendo `system`; una vez pulsado el botón, se conserva la elección manual.
3. Reutilizar el componente de estado de sincronización y su lógica de outbox; cambiar su presentación a un indicador compacto en la cabecera.
4. El indicador muestra red y conteo pendiente. Si hay red y pendientes, su activación dispara la sincronización manual existente; la reconexión conserva el intento automático.
5. Usar SVG inline accesible y estilos semánticos existentes, sin instalar librerías de iconos.

### Constitution Check After Design

- No se añade otra capa ni dependencia. No se modifica el modelo de datos ni el contrato API.
- La excepción de no añadir/ejecutar pruebas se registra arriba por la instrucción de sesión; la verificación de lint, tipos, navegador y cobertura queda pendiente de una solicitud de verificación.

## Project Structure

### Documentation (this feature)

```text
specs/007-compact-header-controls/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/ui-controls.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code

```text
src/client/
├── App.tsx
├── components/
│   ├── LoginView.tsx
│   ├── SyncStatusBar.tsx
│   ├── ThemeProvider.tsx
│   └── ThemeSelector.tsx
└── index.css
```

**Structure Decision**: Se conserva la aplicación web existente y se modifica el marco visual compartido; no se crean paquetes ni módulos nuevos.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|---------------------------------------|
| TDD no ejecutado en esta sesión | La instrucción de sesión prohíbe añadir o correr pruebas si no se solicitaron explícitamente. | No se aplica una alternativa de código; se deja constancia y se informa que la suite no fue verificada. |
