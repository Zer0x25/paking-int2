# ADR-004: Ciclo de vida de reservas contractuales de eventos

* **Estado**: Aceptado
* **Fecha**: 2026-10-17
* **Decisores**: Líder del Proyecto y equipo de implementación

## Contexto y Declaración del Problema

Configuración mostraba una sola reserva de ejemplo y no permitía crear, editar ni cancelar reservas para eventos futuros. Para planificar eventos, los administradores necesitan gestionar rangos de fecha y hora sin comprometer más espacios simultáneos que la capacidad física disponible.

## Decisión

1. Permitir cualquier cantidad de reservas, limitadas por la disponibilidad física durante los intervalos coincidentes, no por un tope arbitrario de registros.
2. Modelar inicio y término como marcas de tiempo; el término debe ser posterior al inicio y puede caer al día siguiente.
3. Aplicar los cupos reservados al cálculo de admisión solo durante el intervalo programado del evento.
4. Permitir edición versionada y representar “Eliminar” como cancelación lógica, conservando la reserva y el historial de cambios.
5. Mantener una reserva en el inventario activo hasta las 23:59 del día calendario siguiente a su fecha de término; ocultarla al comenzar el día posterior, según la zona horaria local de la instalación.
6. Reutilizar el almacén en memoria que actualmente usan los catálogos de Configuración en desarrollo. Los registros creados se pierden al reiniciar el Worker; la persistencia durable en D1 queda pendiente de una migración coherente para el conjunto de configuración.

## Alternativas Consideradas

### Límite fijo de reservas

Descartado porque bloquearía la planificación de eventos sin relación con el aforo real del recinto.

### Eliminación física de reservas canceladas o vencidas

Descartada porque eliminaría la referencia que permite conservar auditoría e historial.

### Ocultar al terminar el último día del evento

Descartada porque no deja el día adicional solicitado para eventos que terminan tarde o atraviesan medianoche.

## Consecuencias

* Se pueden programar eventos por adelantado y editar o cancelar sus reservas desde Configuración.
* Las reglas de capacidad consideran intervalos superpuestos y cuotas garantizadas.
* Las reservas vencidas y canceladas dejan la lista activa, pero permanecen en el almacén de desarrollo.
* Reiniciar el Worker local borra las reservas creadas durante esa sesión de desarrollo.
