# ADR-012: Flujo guiado de operación de garita

- **Estado**: Aceptado
- **Fecha**: 2026-10-17
- **Feature**: [008-gate-entry-wizard](../../specs/008-gate-entry-wizard/spec.md)

## Contexto

La tarjeta de garita presenta el selector de movimiento, la patente y todos los campos de destino juntos. La persona usuaria pidió empezar solo con la patente y una acción Registrar, elegir luego Entrada o Salida y revisar los datos de destino antes de una entrada.

## Decisión

1. Mantener el flujo como estado temporal local de la tarjeta existente con tres pasos: patente, movimiento y revisión de entrada.
2. Reutilizar validación/normalización de patente y los handlers online/offline ya existentes.
3. Al elegir Salida, ejecutar la salida con la patente que ya se ingresó.
4. Para Entrada, exigir una confirmación explícita de unidad, tipo de espacio y área/sector; permitir volver y corregir sin perder selecciones.
5. No crear entidades, endpoints ni dependencias nuevos.

## Alternativas consideradas

- Cambiar la API o el modelo de sesión: rechazado porque el requerimiento es de secuencia de interfaz y la lógica operativa existente cubre ambos movimientos.
- Crear una entidad persistente para el borrador: rechazado porque el borrador vive durante una sola interacción local y no produce efectos antes de confirmar.
- Mantener todos los campos visibles: rechazado porque no reduce la carga inicial ni introduce la revisión pedida.

## Consecuencias

- La operación comienza con una sola entrada y una acción clara.
- Una sesión de entrada solo se crea después de revisar y confirmar el destino.
- La salida no vuelve a solicitar la patente.
- El flujo preserva el comportamiento offline y las acciones existentes de la lista activa.
- El estado del asistente no sobrevive una recarga de página; no contiene una sesión confirmada ni es necesario sincronizarlo.
