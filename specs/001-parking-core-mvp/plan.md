# Implementation Plan: Sistema Inteligente de Gestión de Estacionamientos (MVP)

**Branch**: `001-parking-core-mvp` | **Date**: 2026-10-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-parking-core-mvp/spec.md`

## Summary

Desarrollar una aplicación web responsive tipo PWA Offline-First para la administración y asignación dinámica de estacionamientos compartidos en complejos multi-negocio (Hotel, Eventos, Comercial). 
El núcleo de reglas de negocio se implementa bajo arquitectura hexagonal pura en TypeScript (*Library-First*), desacoplada del framework web. El backend se ejecuta sobre Cloudflare Workers con Hono y persistencia en Cloudflare D1 (SQLite distribuido con Drizzle ORM), optimizado para el Free Tier. El cliente frontend implementa persistencia local en IndexedDB con patrón Outbox para garantizar operatividad continua ante desconexiones de red y sincronización incremental.

## Technical Context

**Language/Version**: TypeScript 5.6+ (Strict mode activado).  
**Primary Dependencies**: 
- Backend: Hono v4, Drizzle ORM, Zod.
- Frontend: React 18/19, Vite, `@vite-pwa/plugin`, `idb` (o Dexie) para IndexedDB.  
**Storage**: Cloudflare D1 (SQLite central) y navegador IndexedDB (local offline).  
**Testing**: Vitest con `@cloudflare/vitest-pool-workers` y cobertura `@vitest/coverage-v8`.  
**Target Platform**: Cloudflare Workers (Edge) + Navegadores modernos (PWA).  
**Project Type**: Fullstack Web PWA + Serverless Edge API (Arquitectura Hexagonal).  
**Performance Goals**: Latencia de API p95 < 200ms, respuesta local en cliente < 50ms, conciliación de lotes de sincronización < 3s.  
**Constraints**: 100% de operaciones operacionales viables offline; cumplimiento estricto de cuotas del Cloudflare Free Tier (batching y delta sync).  
**Scale/Scope**: Complejo de convenciones multi-negocio (50-1000 plazas), 2-10 garitas operadoras concurrentes.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio Constitucional | Estado | Evidencia de Cumplimiento |
|-------------------------|--------|---------------------------|
| **I. Library-First & Hexagonal** | **PASS** | El motor de asignación y cálculo de prioridades reside en `src/core/`, sin dependencias de Cloudflare, HTTP ni IndexedDB. |
| **II. TDD Red/Green (Cobertura $\ge 85\%$)** | **PASS** | Suite con Vitest estructurada en `tests/unit/core/` para pruebas unitarias previas al código de producción. |
| **III. Esquemas Estrictos & Cloudflare Free Tier** | **PASS** | Validación universal con Zod; batching en D1 (`db.batch`) y sincronización delta incremental. |
| **IV. Definition of Done (DoD)** | **PASS** | Linter, comprobación de tipos `tsc --noEmit` y suite de tests limpios antes de merge. |
| **V. Convergencia Autónoma & E2E** | **PASS** | Guía de validación observable en `quickstart.md` y ejecución de `$speckit-converge`. |

## Project Structure

### Documentation (this feature)

```text
specs/001-parking-core-mvp/
├── spec.md              # Requerimientos y especificación funcional aprobada
├── plan.md              # Este plan de implementación arquitectónico
├── research.md          # Decisiones de arquitectura y stack técnico
├── data-model.md        # Esquema de entidades D1/SQLite e IndexedDB
├── contracts/           # Contratos de interfaz y esquemas OpenAPI
│   └── api-spec.json
├── checklists/          # Checklists de requerimientos y auditoría
│   └── requirements.md
└── tasks.md             # Tareas ejecutables (generadas con $speckit-tasks)
```

### Source Code (repository layout)

```text
src/
├── core/                        # Biblioteca pura de dominio (Hexagonal / Library-First)
│   ├── models/                  # Entidades (Facility, BusinessUnit, ParkingSession, EventBooking)
│   ├── rules/                   # Motor de asignación dinámica y prioridades de cupos
│   └── types/                   # Tipos TypeScript compartidos y esquemas Zod
├── server/                      # Backend API en Cloudflare Workers (Hono)
│   ├── db/                      # Esquema Drizzle y cliente D1
│   │   ├── schema.ts
│   │   └── migrations/
│   ├── middleware/              # JWT auth y RBAC
│   ├── routes/                  # Controladores REST (/auth, /parking, /dashboard, /sync)
│   └── index.ts                 # Entrypoint del Worker
├── client/                      # Frontend PWA Offline-First (Vite + React)
│   ├── components/              # Vistas operacionales: Garita (Entrada/Salida), Dashboard, Configuración
│   ├── db/                      # Gestión de IndexedDB local y sincronizador Outbox
│   ├── hooks/                   # Hooks para estado reactivo y conectividad online/offline
│   └── index.html / App.tsx     # Punto de montaje PWA
└── tests/                       # Suite de pruebas automatizadas
    ├── unit/                    # Pruebas unitarias de dominio (Core)
    ├── integration/             # Pruebas de integración de Workers + D1
    └── e2e/                     # Escenarios de sincronización y concurrencia
```

**Structure Decision**: Se adopta un diseño modular monorepo ligero dentro del repositorio para permitir que `src/core/` sea importado tanto por el backend (`src/server/`) como por el cliente PWA (`src/client/`), garantizando que la lógica de cálculo y los esquemas Zod no se dupliquen.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

*No existen violaciones constitucionales. El diseño cumple de forma canónica con todos los mandatos de la Constitución.*
