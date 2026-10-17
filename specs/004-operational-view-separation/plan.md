# Implementation Plan: Separación de Garita Operativa y Dashboard

**Branch**: `004-operational-view-separation` | **Date**: 2026-10-17 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from specs/004-operational-view-separation/spec.md

## Summary

Garita Operativa mostrará únicamente los formularios de entrada y salida; Dashboard conservará las fichas generales y los desgloses por área y unidad de negocio. Se aplicará una regla explícita de composición de vistas en el cliente. Se mantendrán el indicador compartido de sincronización, la actualización de métricas, la navegación, los roles y el contenido de Configuración.

## Technical Context

**Language/Version**: TypeScript 5.7, React 18

**Primary Dependencies**: React 18, Vite 6, Vitest 2; no se agregan dependencias

**Storage**: N/A; el cambio no modifica persistencia

**Testing**: Vitest unitario, typecheck, build y verificación visual en navegador real

**Target Platform**: Navegadores compatibles con la PWA existente

**Project Type**: Aplicación web cliente/Worker

**Performance Goals**: Mantener el refresco de indicadores y la navegación actuales sin trabajo adicional de consulta al cambiar de pestaña

**Constraints**: Sin cambios en reglas de negocio, API, persistencia, permisos o diseño de las fichas de Dashboard

**Scale/Scope**: Tres pestañas existentes; solo se modifica qué secciones se montan en Garita Operativa y Dashboard

## Constitution Check

- **Especificación antes de código**: Pasa. La especificación está aprobada y no contiene marcadores de aclaración.
- **TDD**: Pasa como plan. Se escribirá primero una prueba unitaria para la selección exclusiva de secciones por pestaña y se demostrará en rojo antes del cambio de producción.
- **Arquitectura hexagonal y offline-first**: Pasa. La lógica de dominio, API, almacenamiento local y sincronización no cambian.
- **Validación, seguridad y RBAC**: Pasa. No se agregan entradas externas ni se cambian permisos.
- **Cobertura y verificación visual**: Se conservarán las pruebas existentes y se comprobará el resultado en navegador real.
- **ADR**: No se requiere una decisión arquitectónica nueva; el cambio es de composición visual dentro de la navegación existente.

No se identifican violaciones constitucionales ni excepciones que deban registrarse en Complexity Tracking.

## Diseño técnico

- Definir una función pura que asigne las secciones visibles para cada pestaña: Garita (entrada y salida), Dashboard (monitoreo) y Configuración (configuración).
- Usar esa asignación al montar las secciones en App, evitando renderizar Dashboard dentro de Garita.
- Mantener SyncStatusBar en el nivel compartido actual.
- Mantener fetchDashboard, sus llamadas posteriores a las operaciones y el intervalo vigente sin cambios.
- No introducir estado de dominio, nuevos datos, rutas API ni cambios de CSS.

## Project Structure

### Documentación de esta feature

- specs/004-operational-view-separation/spec.md
- specs/004-operational-view-separation/plan.md
- specs/004-operational-view-separation/research.md
- specs/004-operational-view-separation/data-model.md
- specs/004-operational-view-separation/contracts/view-separation.md
- specs/004-operational-view-separation/quickstart.md
- specs/004-operational-view-separation/tasks.md

### Código fuente

- src/client/App.tsx: composición de las vistas existentes
- src/client/utils/operational-view.ts: regla pura para decidir las secciones visibles
- tests/unit/client/test_operational_view.test.ts: pruebas unitarias de separación
- history/prompts/PHR-004-operational-view-separation.prompt.md: registro de la sesión

**Structure Decision**: Mantener el proyecto web existente. La regla de visibilidad vive en una utilidad del cliente para hacer exclusiva y verificable la composición de secciones sin acoplarla a React ni al DOM.
