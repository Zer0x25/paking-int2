# ADR-002: Arquitectura y Stack Tecnológico para el Sistema Inteligente de Gestión de Estacionamientos (paking-int2)

* **Estado**: Aceptado
* **Fecha**: 2026-10-15
* **Decisores**: Arquitecto de Software & Humano Líder del Proyecto

## Contexto y Declaración del Problema
Se requiere desarrollar una aplicación web privada, responsive y tipo PWA para la gestión dinámica de estacionamientos compartidos en complejos con múltiples unidades de negocio (ej. centros de convenciones con hotel, eventos, restaurante y gimnasio). 

Los requerimientos operativos exigen:
1. Alta disponibilidad y funcionamiento continuo ante caídas de conectividad (offline-first para operadores en garitas o accesos).
2. Asignación dinámica de espacios con prioridades comerciales (hotel con cupos garantizados incluidos, eventos con cuotas por contrato y remanente distribuido dinámicamente).
3. Respeto estricto a las cuotas del **Cloudflare Free Tier** (minimizando peticiones, consumo de CPU y escrituras en base de datos).
4. Seguridad con autenticación JWT y RBAC (Administrador y Operador).
5. Trazabilidad completa y control de concurrencia optimista entre múltiples operadores.

## Decisión de Arquitectura y Stack

Se define la siguiente arquitectura desacoplada basada en principios Hexagonales y Offline-First:

### 1. Núcleo de Dominio (Library-First & Hexagonal)
- **Tecnología**: TypeScript puro con **Zod** para esquemas declarativos.
- **Ubicación**: `src/core/` (o paquete de dominio desacoplado).
- **Responsabilidad**: Reglas de negocio puras (algoritmo de priorización dinámica, cálculo de disponibilidad, restricciones horarias de eventos y cuotas), independientes de la UI, de la base de datos y de APIs externas.

### 2. Frontend / PWA (Offline-First)
- **Tecnología**: **Vite + React + TypeScript + `vite-plugin-pwa`**.
- **Persistencia Local**: **IndexedDB** (usando `idb` / Dexie) para almacenamiento de catálogos locales, registros de entradas/salidas y cola de sincronización incremental (*outbox pattern*).
- **Concurrencia**: Control de versiones de registro (optimistic locking con timestamps de mutación) para evitar sobreescrituras accidentales entre terminales.
- **Hosting**: Cloudflare Pages / Workers Static Assets.

### 3. Backend & API
- **Tecnología**: **Cloudflare Workers** con **Hono** (framework ultraligero de latencia submilisegundo).
- **Base de Datos**: **Cloudflare D1** (SQLite distribuido) gobernado mediante **Drizzle ORM** para migraciones y consultas tipadas seguras.
- **Optimización Free Tier**:
  - Batching de escrituras y lecturas (`db.batch`).
  - Sincronización incremental delta (solo enviar y recibir mutaciones posteriores al último punto de sincronización).
  - Cache en Edge / cliente para configuraciones estáticas.
- **Seguridad**: JWT en cabeceras `Authorization: Bearer <token>`, roles RBAC (`admin`, `operator`), contraseñas hasheadas con PBKDF2/WebCrypto nativo.

### 4. Estrategia de Pruebas (TDD Red/Green)
- **Test Runner**: **Vitest** con `@cloudflare/vitest-pool-workers` para pruebas de integración de endpoints D1 y pruebas unitarias rápidas en el núcleo de dominio.
- **Cobertura**: Obligatoria $\ge 85\%$ en todo el código de producción.

## Alternativas Descartadas
1. **Backend con Docker / Node.js tradicional (Express/NestJS en VPS o Cloud Run)**:
   - *Descartada porque*: Implica costes fijos mensuales de infraestructura y mayor complejidad de mantenimiento operativo en comparación con la infraestructura serverless de Cloudflare Workers + D1 en capa gratuita.
2. **Supabase / Firebase**:
   - *Descartada porque*: Introduce dependencias externas de terceros y potenciales costes cuando el ecosistema nativo de Cloudflare Workers + D1 resuelve tanto el backend de API como la base de datos de forma integrada y optimizada.
3. **Persistencia Web puramente Online (sin IndexedDB)**:
   - *Descartada porque*: En garitas o subterráneos de estacionamientos la conectividad celular/WiFi puede ser intermitente, lo que bloquearía el registro de vehículos e impediría la operación fluida del negocio.

## Consecuencias
* **Positivas**:
  - Cero costes de infraestructura dentro del Cloudflare Free Tier.
  - Funcionamiento ininterrumpido en garitas y accesos sin cobertura de red.
  - Latencia ultra-baja (Edge computing en Cloudflare) p95 < 200ms.
  - Dominio desacoplado y 100% testeable de forma independiente antes de tocar la UI o la base de datos.
* **Compromisos / Retos**:
  - Requiere diseñar cuidadosamente la resolución de conflictos en la cola de sincronización incremental offline.
  - Las operaciones en D1 deben agruparse en lotes para no agotar los límites diarios de consultas del Free Tier.
