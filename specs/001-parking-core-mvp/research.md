# Technical Research & Architecture Decisions: Sistema Inteligente de Gestión de Estacionamientos (MVP)

**Feature**: `001-parking-core-mvp`  
**Date**: 2026-10-15  
**Spec**: [spec.md](./spec.md)

---

## 1. Núcleo de Dominio Desacoplado (Hexagonal & Library-First)

- **Decision**: Crear un módulo de dominio puro en `packages/core` (o `src/core`) en TypeScript que encapsula las entidades, reglas de negocio y cálculo de prioridades sin dependencias de I/O, Web, DOM o SQLite.
- **Rationale**: Cumple el Principio I de la Constitución (Library-First). Permite probar con TDD el 100% de la lógica de negocio (asignación dinámica, protección de cupos de hotel/eventos, saturación de áreas comerciales) de forma instantánea en memoria sin necesidad de levantar emuladores de Workers o navegadores.
- **Alternatives considered**:
  - *Lógica mezclada en controladores Hono o componentes React*: Descartada por violación constitucional y acoplamiento severo que dificulta pruebas y reutilización.

---

## 2. Backend & Edge Runtime: Cloudflare Workers + Hono

- **Decision**: Utilizar Cloudflare Workers con el microframework Hono y tipado estricto.
- **Rationale**:
  - Hono es el estándar de facto para Cloudflare Workers: overhead prácticamente nulo (<15kB), enrutamiento ultrarrápido (RegExpRouter), middleware nativo de CORS, JWT y validación Zod (`@hono/zod-validator`).
  - Cumple el objetivo no funcional de latencia p95 < 200ms (típicamente < 30ms en el Edge).
- **Alternatives considered**:
  - *Itty-router*: Demasiado minimalista; carece de middleware robusto para Zod y OpenAPI.
  - *Express/NestJS*: No son compatibles nativamente con el runtime V8 isolates de Cloudflare Workers.

---

## 3. Persistencia Central & ORM: Cloudflare D1 + Drizzle ORM

- **Decision**: Base de datos Cloudflare D1 (SQLite distribuido) con Drizzle ORM para consultas tipadas y migraciones automatizadas.
- **Rationale**:
  - D1 está integrado directamente en la infraestructura serverless de Cloudflare y cubierto por el Free Tier.
  - Drizzle ORM genera SQL nativo sin overhead en tiempo de ejecución, genera schemas TypeScript directos y soporta `db.batch()` nativo en D1, reduciendo drásticamente el consumo de operaciones de lectura/escritura.
- **Alternatives considered**:
  - *Prisma*: Genera un binario/Wasm pesado para Workers que eleva el tiempo de arranque y memoria.
  - *Kysely*: Buena opción, pero Drizzle ofrece mejor integración con migraciones y generación de esquemas SQLite para D1.

---

## 4. Persistencia Local & Modo Offline-First: IndexedDB + Outbox Pattern

- **Decision**: Frontend PWA con almacenamiento local estructurado en IndexedDB utilizando `idb` (wrapper ligero de Web APIs) y un patrón Outbox para la cola de sincronización incremental.
- **Rationale**:
  - Permite a los operadores en garitas o subterráneos continuar registrando ingresos y salidas vehiculares sin conexión de red.
  - La cola Outbox en IndexedDB guarda mutaciones pendientes con timestamps e IDs únicos universales (UUID v4 / nanoid).
  - Al recuperar la conexión (evento `online` del navegador o chequeo periódico), el cliente envía un lote de transacciones a `/api/sync/delta`, resolviendo colisiones mediante versionado lógico y reglas de negocio.
- **Alternatives considered**:
  - *LocalStorage*: Límite de 5MB, síncrono y bloqueante del hilo principal; inadecuado para almacenamiento robusto de auditoría y catálogos.
  - *CRDTs pesados (Yjs / Automerge)*: Excesiva complejidad para el modelo de datos de estacionamiento donde la regla de estado vehicular ("adentro/afuera") es discreta.

---

## 5. Estrategia de Optimización Cloudflare Free Tier

- **Decision**:
  1. **Batching de operaciones**: Uso de `db.batch([...])` en D1 para insertar sesiones y actualizar contadores en una sola transacción/petición.
  2. **Delta Syncing**: Los clientes sólo solicitan cambios ocurridos después de su `last_sync_timestamp`, minimizando las filas leídas en D1.
  3. **Caché en Cliente**: Catálogos estáticos (instalaciones, unidades de negocio, tipos de espacios) se almacenan en IndexedDB y se revalidan con cabeceras ETag / versión.

---

## 6. Testing & DoD Determinista: Vitest

- **Decision**: Vitest con entorno node para pruebas unitarias de dominio y `@cloudflare/vitest-pool-workers` para pruebas de integración con D1 en memoria (Miniflare).
- **Rationale**:
  - Ejecución ultrarrápida compatible con ES modules y TypeScript.
  - Cobertura integrada con `@vitest/coverage-v8` para verificar el umbral obligatorio $\ge 85\%$.
