---
id: PHR-010
stage: spec-and-implementation
date: 2026-10-17
branch: 007-compact-header-controls
command: interactive product design request
model: Codex GPT-6
---

# PHR-010: Controles compactos para tema y conexión

## Prompt del usuario

> 1. Se entiende como funciona. Pero mi mejora sería solo un botón que cambia entre claro y oscuro. Se carga de forma predeterminada al sistema. (Si el sistema es claro. Se carga como claro. O el contrario)
>
> 2. Los colores están bien. Se ve correctamente.
>
> 3.por lo que alcance a notar se ve correctamente.
>
> 4. A 375px. Aún no la pruebo en un dispositivo móvil en el navegador emulando , se ve correctamente.
>
> Mientras reviso el resto ayúdame con el selector claro oscuro. Y lo otro tengo un áviso de conección que cruza la pantalla se podría simplificar a un indicar Icono a un costado del boton que dejaremos como selector claro oscuro. En la cabecera

## Decisiones confirmadas

- Un botón con icono alterna entre tema claro y oscuro.
- El tema inicial sigue la preferencia del sistema hasta que la persona alterna manualmente; la elección manual se persiste en el navegador.
- El estado de conexión sale del área de contenido y aparece junto al tema en la cabecera autenticada.
- Se conserva el contador de mutaciones pendientes y la sincronización manual se puede iniciar desde el mismo icono cuando hay conexión y pendientes.
- Se conserva la sincronización automática existente al recuperar conectividad.
- La persona revisora confirmó los primeros cuatro puntos del checklist UX de la feature 006; dejó constancia de que 375 px se observó en emulación de navegador y no en un teléfono físico.

## Artefactos

- Especificación, plan, tareas, contrato de interfaz, checklist UX y guía: `specs/007-compact-header-controls/`.
- Decisión técnica: `history/adr/ADR-011-compact-header-controls.md`.
- Código: `ThemeSelector.tsx`, `SyncStatusBar.tsx`, `App.tsx` e `index.css`.

## Verificación

- No se añadieron ni ejecutaron pruebas, lint, chequeo de tipos, build o comprobaciones de navegador durante esta solicitud.
- El checklist UX de esta feature queda disponible para la revisión visual de la persona usuaria.
- El árbol de trabajo no se ha commiteado.
