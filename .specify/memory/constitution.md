# Constitución de Ingeniería y Gobernanza Agéntica
# Proyecto: Sistema Inteligente de Gestión de Estacionamientos (paking-int2)

## Principios Fundamentales

### I. Arquitectura y Especificación (Library-First, Hexagonal & Offline-First)
- **MUST**: NINGÚN agente o desarrollador debe generar código de producción sin una especificación previa (`specs/###-feature/spec.md`) validada mediante `$speckit-clarify` y analizada con `$speckit-analyze`.
- **MUST (Library-First & Hexagonal)**: El núcleo de negocio (reglas de asignación de espacios, cálculo de prioridades dinámicas para hotel/eventos/áreas comerciales, validación de cuotas horarias y control de cupos garantizados) DEBE residir en un módulo de dominio puro (`packages/core` o `src/core`), completamente desacoplado del framework web, de Cloudflare Workers, del DOM y de IndexedDB.
- **MUST (Offline-First)**: El cliente (PWA en Vite + React + TypeScript) debe operar de forma autónoma con persistencia local en IndexedDB (`idb`/`dexie`). Las operaciones de entrada/salida y consulta de disponibilidad deben funcionar offline y sincronizarse incrementalmente hacia el backend mediante una cola de mutaciones con resolución de concurrencia optimista.
- **MUST**: La arquitectura de backend se basa en Cloudflare Workers con TypeScript y Hono, persistiendo en Cloudflare D1 (SQLite distribuido) con Drizzle ORM. Se prohíben bibliotecas puramente cosméticas u organizacionales sin propósito funcional claro.

### II. Test-First Riguroso (TDD Red/Green - NO NEGOCIABLE)
- **MUST**: El ciclo TDD es obligatorio: se redactan pruebas de aceptación/unitarias a partir de `spec.md` y `contracts/` ANTES de escribir código de producción.
- **MUST**: Las pruebas deben fallar de forma demostrable (Fase Roja) antes de habilitar la fase verde (`$speckit-implement`).
- **MUST**: La suite de pruebas debe ejecutarse con **Vitest** (incluyendo pruebas de Workers con `@cloudflare/vitest-pool-workers` y pruebas de lógica de dominio pura).
- **MUST**: La cobertura de pruebas de producción DEBE mantenerse en un umbral mínimo de >= 85%.
- **MUST**: El agente que escribe las pruebas unitarias opera bajo frontera estructural de contexto: tiene prohibido leer o acceder a la implementación de producción para evitar pruebas tautológicas.

### III. Seguridad, Esquemas Estrictos y Optimización Cloudflare Free Tier
- **MUST**: Todas las entradas externas, APIs, cargas útiles JSON, mutaciones de IndexedDB y eventos DEBEN validarse mediante esquemas declarativos estrictos utilizando **Zod**.
- **MUST (Cloudflare Free Tier Awareness)**: El diseño de base de datos y APIs debe minimizar lecturas, escrituras y peticiones hacia Cloudflare D1 mediante:
  1. Batching de sentencias SQL (`db.batch(...)`).
  2. Sincronización incremental delta (solo transferir registros modificados tras el último timestamp).
  3. Uso de caché local en IndexedDB para catálogos y configuración que cambian con poca frecuencia.
- **MUST (Seguridad & RBAC)**: Autenticación mediante tokens JWT y control de acceso basado en roles (Administrador vs. Operador). Toda operación operacional (ingreso/salida de vehículo, reserva, cambio de cupos) debe contar con trazabilidad de autoría (audit log).
- **MUST**: Queda estrictamente prohibido incluir secretos, tokens, credenciales o API Keys en archivos versionados. Se exige el uso de variables de entorno y secretos de Wrangler (`wrangler secret`).
- **MUST**: Prohibición mecánica de comandos destructivos en la consola (`rm -rf`, `git push --force`, `--no-verify`).

### IV. Definition of Done (DoD) Ineludible
- **MUST**: Ningún cambio se fusiona a la rama `main` sin superar el pipeline determinista:
  1. Linter y formateador limpios (`tsc --noEmit`, ESLint/Biome/Prettier con exit code = 0).
  2. Chequeo de tipos estáticos de TypeScript sin errores (`strict: true`).
  3. Suite de tests unitarios, de integración y cobertura >= 85%.
  4. Ausencia total de marcadores pendientes `TODO:` o `FIXME:`.
  5. Auditoría de dependencias (`npm audit`) sin vulnerabilidades críticas.

### V. Convergencia Autónoma y Verificación E2E
- **MUST**: Tras implementar tareas de `tasks.md`, `$speckit-converge` debe ejecutarse en bucle para auditar código frente a `spec.md` y `plan.md`.
- **MUST**: `$speckit-converge` opera de forma estrictamente *append-only* sobre `tasks.md`; tiene prohibido editar o eliminar código fuente de la aplicación.
- **MUST**: La verificación de criterios de aceptación de interfaz debe validarse contra un navegador real (vía browser subagent o Playwright) y no únicamente contra mocks.

## Gestión de Complejidad y Excepciones
- Si un requerimiento técnico o compromiso de latencia exige violar algún principio constitucional, el agente DEBE documentarlo formalmente en la tabla `Complexity Tracking` dentro de `plan.md` justificando:
  1. *Violation*: Principio o regla afectada.
  2. *Why Needed*: Razón técnica o de negocio indispensable.
  3. *Simpler Alternative Rejected Because*: Por qué se descartó la solución canónica.

## Gobernanza y Decisiones de Arquitectura (ADR)
- Esta Constitución prevalece sobre cualquier instrucción conversacional no estructurada.
- Cada decisión arquitectónicamente significativa detectada durante `$speckit-plan` DEBE registrarse inmutablemente bajo `history/adr/ADR-###.md` en formato MADR.
- Toda sesión de interacción y transición de etapa debe quedar registrada en `history/prompts/` como registro forense (PHR).

---
**Versión**: 1.0.0 | **Ratificado**: 2026-10-15 | **Estado**: Vigente
