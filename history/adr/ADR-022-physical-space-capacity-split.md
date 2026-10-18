# ADR-022: Distribución de capacidad física Estándar y Accesible

- **Estado**: Aceptado
- **Fecha**: 2026-10-18
- **Feature**: [013-accessible-space-allocation](../../specs/013-accessible-space-allocation/spec.md)

## Contexto

La capacidad actual se mantiene como un total por recinto y por área. Las categorías de espacio del recinto ya existen y las sesiones vehiculares las referencian, pero las áreas solo almacenan capacidad agregada. Se necesita reservar plazas Accesibles sin confundirlas con las cuotas garantizadas, contractuales o dinámicas de las unidades de negocio. Los registros existentes deben conservar sus referencias e historial.

## Decisión

1. Mantener `space_categories.allocated_slots` como fuente de capacidad por categoría del recinto. `STD` y `ACC` suman el aforo total; `VIP` y `OTHER` permanecen disponibles para referencias históricas, pero no aceptan nuevas entradas.
2. Agregar `standard_capacity` y `accessible_capacity` a `parking_areas`. El campo existente `allocated_capacity` se conserva como total derivado y todas las escrituras actualizan los tres valores juntos.
3. Migrar sin cambiar el total del recinto ni las capacidades agregadas de las áreas. La capacidad inicial ACC cubre como mínimo la ocupación activa ACC y la capacidad STD cubre como mínimo la ocupación activa no-ACC. El reparto de áreas reserva ACC para sus sesiones activas y evita que las asignaciones STD superen el pool STD. Mantener intactas las sesiones y categorías históricas.
4. Validar en el dominio y el backend las dos dimensiones: tipo físico y cuota de unidad. Aplicar la misma regla a entradas online y a mutaciones offline al sincronizar.
5. Guardar cambios de capacidad con el compare-and-swap, batch y auditoría ya usados por el recinto. La actualización del total y sus categorías es atómica.

## Alternativas consideradas

### Combinar tipo de espacio con cuota de negocio

Descartada porque la cuota expresa quién tiene acceso y el tipo expresa qué clase de plaza física ocupa. Unirlas altera la semántica de eventos, hotel y asignación dinámica.

### Tabla genérica de asignación categoría-área

Descartada para esta versión de dos categorías: añade joins y rutas de escritura sin valor funcional actual. Se reconsiderará si se aprueban categorías físicas adicionales.

### Agregar una segunda capacidad accesible al recinto

Descartada porque duplicaría el origen del aforo. La capacidad del recinto permanece en el catálogo de categorías existente.

## Consecuencias

- Se preservan los identificadores de categorías y sesiones existentes.
- Los formularios muestran el total y el reparto por tipo; las áreas muestran su reparto y buffer flotante por tipo.
- Las lecturas de catálogo siguen en el batch actual y no aumenta el polling.
- La aplicación debe mantener `allocated_capacity = standard_capacity + accessible_capacity` en todas las escrituras.
- La migración requiere pruebas Worker que cubran backfill y conservación de datos, incluidas sesiones activas de ambas categorías.
