# ADR-009: ESLint como gate de calidad local

* **Estado**: Aceptado
* **Fecha**: 2026-10-17
* **Decisores**: Líder del Proyecto y equipo de implementación

## Contexto y Declaración del Problema

La Constitución del repositorio exige que TypeScript y un linter terminen sin errores. El proyecto ya ejecuta typecheck y Vitest, pero no tiene linter instalado ni script de lint. Sin esa herramienta, el gate indicado no se puede verificar.

## Decisión

Instalar ESLint como dependencia de desarrollo, usar la configuración flat oficial con reglas recomendadas de ESLint y `typescript-eslint`, declarar entornos de navegador y Node, e incorporar el comando repetible `npm run lint`. La configuración cubre fuentes TypeScript, TSX y JavaScript del repositorio e ignora artefactos generados, dependencias y estado local de Spec Kit.

## Alternativas Consideradas

### Mantener el gate pendiente

Descartada porque dejaría sin verificación una regla de calidad obligatoria del proyecto.

### Usar solo TypeScript como linter

Descartada porque `tsc --noEmit` valida tipos y no reemplaza las reglas de ESLint requeridas por la Constitución.

### Adoptar Biome o Prettier

Descartada para esta entrega porque el usuario pidió explícitamente ESLint y no se necesita cambiar el formateador para cerrar el gate del linter.

## Consecuencias

* Se agregan dependencias de desarrollo y configuración de lint sin afectar el bundle de producción.
* El gate de lint se puede ejecutar localmente con un solo comando y se incorpora al quickstart de la feature.
* Los hallazgos existentes se deben corregir o justificar con reglas concretas; no se deshabilita globalmente el lint para obtener un resultado verde.

## Referencias

* [ESLint: Getting Started](https://eslint.org/docs/latest/use/getting-started)
* [typescript-eslint: Getting Started](https://typescript-eslint.io/getting-started/)
