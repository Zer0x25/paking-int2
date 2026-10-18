# ADR-021: Categoría estándar inicial para recintos nuevos

- **Estado**: Aceptado
- **Fecha**: 2026-10-18
- **Feature**: [002-facility-area-setup](../../specs/002-facility-area-setup/spec.md)

## Contexto

La creación del recinto inicial asignaba su identidad, pero no generaba filas en `space_categories`. Garita exige una categoría para admitir vehículos y la instalación creada desde cero no tenía una pantalla de configuración de categorías. El operador podía seleccionar la unidad, pero el selector de tipo de espacio quedaba vacío y la entrada fallaba.

El tipo de cuota de una unidad define su regla de asignación de cupos; no sustituye a la categoría de espacio guardada en la sesión vehicular.

## Decisión

- Crear `STD` (“General / Estándar”) dentro del mismo batch de bootstrap que crea y asigna el recinto.
- Asignar a `STD.allocatedSlots` la capacidad total del recinto para habilitar la operación inicial.
- Aplicar una migración aditiva a los recintos activos existentes que no tengan `STD`; conservar las categorías que ya existan.
- Mantener la cuota de unidad y el tipo de espacio como conceptos separados y explicarlo junto al campo de cuota.

## Consecuencias

- Un recinto recién creado ofrece una categoría válida en Garita inmediatamente.
- Las instalaciones activas ya existentes reciben el tipo estándar al aplicar la nueva migración, sin borrar su información.
- La administración de otras categorías queda fuera de esta corrección; el tipo estándar permite iniciar la operación sin configuración adicional.
