# ADR-003: Edición y baja lógica de áreas de estacionamiento

* **Estado**: Aceptado
* **Fecha**: 2026-10-17
* **Decisores**: Líder del Proyecto y equipo de implementación

## Contexto y Declaración del Problema

Los administradores necesitan corregir los datos de un área existente y retirar áreas que dejaron de operar. Las sesiones y los registros de auditoría pueden conservar referencias al identificador del área, por lo que borrar físicamente el registro rompería el historial. Además, las asignaciones de capacidad deben seguir respetando la capacidad total del recinto y la ocupación actual.

## Decisión

1. Permitir editar nombre, código, descripción, unidad de negocio asociada y capacidad en una sola operación con validación de versión optimista.
2. Mantener único el código del área en toda la instalación, incluyendo áreas inactivas, para preservar identificadores históricos.
3. Representar la eliminación como desactivación lógica tras confirmación explícita. Solo se permite cuando no hay sesiones activas en el área.
4. Conservar las áreas inactivas en el inventario administrativo, excluirlas de los catálogos operativos y liberar su capacidad al buffer flotante.

## Alternativas Consideradas

### Borrado físico del registro

Descartado porque eliminaría la referencia estable que necesitan las sesiones y la auditoría histórica.

### Desactivar un área ocupada y esperar a que se vacíe

Descartado porque dejaría ambigua la disponibilidad para nuevas entradas. La operación se rechaza hasta que no queden vehículos activos.

## Consecuencias

* Las áreas retiradas siguen disponibles para consulta histórica y no consumen capacidad operativa.
* Los códigos no se pueden reutilizar dentro de la misma instalación.
* El cliente puede mostrar errores de capacidad y de concurrencia sin perder las referencias históricas.
