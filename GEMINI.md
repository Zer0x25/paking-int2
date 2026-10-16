# Contexto para Google Gemini y Antigravity (GEMINI.md)
# Proyecto: Sistema Inteligente de Gestión de Estacionamientos (paking-int2)

Aplicación web privada, responsive y tipo PWA Offline-First para la administración y asignación dinámica de estacionamientos compartidos en complejos multi-negocio (hotel, eventos, restaurante, gimnasio).
Stack: TypeScript, Cloudflare Workers + Hono + D1 en backend; Vite + React + IndexedDB en frontend PWA.

Este repositorio es una **Fábrica de Software Agéntica Gobernada**.

- **Constitución Suprema**: `.specify/memory/constitution.md`
- **Metodología**: Spec-Driven Development (SDD) con `specify-cli`.
- **Skills disponibles**: Revisa `.agents/skills/` para `$speckit-init`, `$speckit-constitution`, `$speckit-specify`, `$speckit-clarify`, `$speckit-plan`, `$speckit-checklist`, `$speckit-tasks`, `$speckit-analyze`, `$speckit-implement`, `$speckit-converge`, `$speckit-feedback`.
- **Inicialización de Nuevos Proyectos**: Si el repositorio es nuevo o instanciado desde la plantilla, ejecuta `$speckit-init` para realizar la entrevista de descubrimiento y adaptar la Constitución.
- **Mejora del Template Maestro**: Ante cualquier bug, inconsistencia o fricción del arnés de la plantilla, invoca `$speckit-feedback` para registrarlo en `feedback/TEMPLATE_IMPROVEMENTS.md`.
- **Gobernanza de Herramientas**: Modo de solo lectura en análisis, modo append-only en convergencia, y prohibición estricta de operaciones destructivas en consola.
- **TDD**: Red/Green estricto con cobertura >= 85% (Vitest).
