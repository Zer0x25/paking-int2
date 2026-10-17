# ADR-007: Pruebas de rutas en el runtime de Cloudflare Workers

* **Estado**: Aceptado
* **Fecha**: 2026-10-17
* **Decisores**: Líder del Proyecto y equipo de implementación

## Contexto y Declaración del Problema

Las pruebas de las rutas Hono se ejecutaban desde Node y no demostraban su comportamiento dentro de `workerd`, aunque la aplicación se despliega sobre Cloudflare Workers. La Constitución II exige conservar las pruebas de dominio en Vitest y probar las rutas en el runtime Workers. La integración anterior `@cloudflare/vitest-pool-workers` fue reemplazada por `@cloudflare/vitest-plugin` y requiere Vitest 4.1 o superior.

## Decisión

1. Mantener una configuración Vitest Node para pruebas de dominio, API, IndexedDB y componentes, y separar una configuración Workers para pruebas de integración bajo `tests/workers/`.
2. Usar `@cloudflare/vitest-plugin` con Wrangler y `cloudflare:test`/`cloudflare:workers` para ejecutar la aplicación Hono dentro de `workerd`.
3. Actualizar Vitest, cobertura V8 y Wrangler como dependencias de desarrollo compatibles. No se agregan dependencias de ejecución.
4. Incluir ambas configuraciones en los comandos `test`, `test:coverage` y `typecheck`, manteniendo la cobertura mínima del 85% en el conjunto Node.
5. Verificar con una prueba de integración autenticación, entrada, consulta de activas, corrección, salida rápida y sincronización delta de operaciones offline.

## Alternativas Consideradas

### Seguir probando Hono solo desde Node

Descartada porque no satisface la Constitución II ni verifica bindings, imports o comportamiento del runtime de Workers.

### Conservar `@cloudflare/vitest-pool-workers` con Vitest 2

Descartada porque la integración actual oficial usa `@cloudflare/vitest-plugin` y la versión antigua auditada incorporaba vulnerabilidades críticas.

### Migrar a D1 durante esta feature

Descartada porque la aplicación aún usa almacenamiento de desarrollo en memoria para sus catálogos y sesiones. La excepción de persistencia está delimitada en `specs/005-gate-operations/plan.md`; esta ADR solo cubre la fidelidad del runtime de pruebas.

## Consecuencias

* La suite comprueba las rutas operativas tanto en Node como en el runtime real de Workers.
* El typecheck de las pruebas Workers usa un `tsconfig` independiente para no mezclar tipos de Cloudflare con los del navegador.
* Los comandos de desarrollo y la instalación de producción no incorporan dependencias nuevas de runtime.
* Vitest y la integración Cloudflare requieren versiones actuales compatibles; una futura actualización debe respetar ese requisito.

## Referencias

* [Cloudflare: migrar a Vitest plugin](https://developers.cloudflare.com/workers/testing/vitest-integration/migration-guides/migrate-to-vitest-plugin/)
* [Cloudflare: escribir la primera prueba Workers](https://developers.cloudflare.com/workers/testing/vitest-integration/write-your-first-test/)
