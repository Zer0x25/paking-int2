# ADR-006: Acciones por sesión y presentación uniforme de patente

* **Estado**: Aceptado
* **Fecha**: 2026-10-17
* **Decisores**: Líder del Proyecto y equipo de implementación

## Contexto y Declaración del Problema

Garita tenía entrada y salida duplicadas en dos fichas y solo permitía cerrar sesiones escribiendo la patente. Corregir una patente mal ingresada tampoco era posible. La PWA debe seguir operando offline y conservar el historial de las sesiones cerradas.

## Decisión

1. Unificar entrada y salida manual en una ficha con selección visible de modo, y mostrar por separado la lista de vehículos activos con acciones por fila.
2. Identificar salidas rápidas y correcciones por ID de sesión y comparar una versión esperada antes de cambiar estado o patente.
3. Aceptar exactamente seis caracteres alfanuméricos con guiones opcionales, guardarlos compactos en mayúsculas para compatibilidad con IndexedDB existente y presentarlos agrupados como `XX-XX-XX`.
4. Permitir corrección solo mientras la sesión esté activa; conservar hora, destino, área e historial al modificar la patente.
5. Reutilizar IndexedDB, outbox, auditoría de desarrollo y permisos operativos existentes; nuevas correcciones offline se sincronizan como una mutación explícita.

## Alternativas Consideradas

### Resolver salida rápida solo por patente

Descartada porque la acción seleccionada en la lista corresponde a una sesión identificable, que puede haber cambiado de estado o de patente antes de procesar la solicitud.

### Guardar patentes con guiones

Descartada porque los registros y claves existentes se almacenan en forma compacta; la UI puede ofrecer el formato pedido sin migrar registros locales ni duplicar representaciones.

### Permitir correcciones en sesiones completadas

Descartada porque el usuario limitó la corrección a sesiones activas y la sesión cerrada pertenece al historial.

## Consecuencias

* La lista puede registrar una salida con un único control, sin que el operador vuelva a digitar la patente.
* La validación es uniforme en ingreso, salida y corrección; datos históricos compactos siguen comparándose.
* Una corrección incrementa versión y deja trazabilidad; los cambios offline se mantienen locales hasta sincronizar.
* La implementación sigue el almacenamiento en memoria del Worker para datos compartidos de desarrollo.
