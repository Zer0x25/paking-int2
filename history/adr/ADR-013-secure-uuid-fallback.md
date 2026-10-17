# ADR-013: Respaldo seguro para generar UUID en navegador

- **Estado**: Aceptado
- **Fecha**: 2026-10-17
- **Feature**: [008-gate-entry-wizard](../../specs/008-gate-entry-wizard/spec.md)

## Contexto

Al confirmar una entrada desde un navegador móvil, la aplicación podía detenerse con `crypto.randomUUID is not a function`. Algunos runtimes implementan `crypto.getRandomValues()` pero aún no incluyen el método de conveniencia `randomUUID()`.

## Decisión

Centralizar la generación de identificadores en `src/core/utils/uuid.ts`: preferir `crypto.randomUUID()` y, si el método falta, generar UUID v4 desde 16 bytes de `crypto.getRandomValues()`, fijando los bits de versión y variante RFC 4122. La misma función se usa en operaciones cliente online/offline.

## Alternativas consideradas

- Usar `Math.random()` o marcas de tiempo: rechazado porque no ofrece aleatoriedad criptográfica y puede colisionar entre terminales offline.
- Mantener llamadas directas a `crypto.randomUUID()`: rechazado porque reproduce el error en runtimes móviles que no exponen ese método.
- Añadir una dependencia de UUID: rechazada porque Web Crypto ya proporciona el generador seguro requerido.

## Consecuencias

- La entrada y las otras operaciones locales pueden generar identificadores en más navegadores compatibles con Web Crypto.
- No se agregan dependencias ni se cambian los contratos de API o de persistencia.
- Si tampoco existe `crypto.getRandomValues()`, la operación falla con un mensaje explícito y no genera un ID inseguro.
