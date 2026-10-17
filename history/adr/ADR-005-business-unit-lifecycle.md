# ADR-005: Ciclo de vida de unidades de negocio

* **Estado**: Aceptado
* **Fecha**: 2026-10-17
* **Decisores**: Líder del Proyecto y equipo de implementación

## Contexto y Declaración del Problema

La pantalla de configuración no podía crear unidades de forma efectiva, y no ofrecía edición ni retiro. Las unidades son referenciadas por áreas exclusivas, reservas y sesiones, y el motor de asignación debe leer el mismo catálogo que administra el usuario.

## Decisión

1. Mantener las unidades en un almacén compartido del servicio de asignación durante el desarrollo, en vez de mutar props de React o mantener catálogos separados entre API y operación.
2. Gestionar las unidades desde endpoints protegidos para administradores, con validación Zod, versiones optimistas y auditoría de actor, acción, valores y fecha.
3. Retirar lógicamente las unidades: conservar ID, código, referencias e historial; impedir reutilizar su código dentro de la instalación.
4. Rechazar el retiro mientras existan sesiones activas, áreas activas exclusivas o reservas vigentes asociadas.
5. Exponer las unidades activas a los selectores y al motor operativo; el inventario de configuración incluye activas e inactivas.
6. Conservar el límite actual de persistencia de desarrollo en memoria. La administración de unidades no introduce una cola offline o persistencia D1 aislada del resto del catálogo.

## Alternativas Consideradas

### Mutar el arreglo recibido por props

Descartada porque no cambia el estado del propietario de React, no activa un render fiable y no persiste en el backend.

### Borrado físico

Descartado porque eliminaría la entidad que da contexto a áreas, reservas y sesiones históricas.

### Retiro sin validar dependencias

Descartado porque podría ocultar una unidad que todavía necesita una sesión, área exclusiva o reserva vigente.

### Persistencia parcial solo para unidades

Descartada porque el almacenamiento de desarrollo de áreas, instalaciones y reservas también es en memoria; persistir una entidad aislada dejaría los datos inconsistentes al reiniciar.

## Consecuencias

* El formulario usa una respuesta del servidor y vuelve a cargar el inventario; no modifica props directamente.
* Un administrador puede actualizar los cuatro campos visibles y retirar unidades que ya no tienen dependencias activas.
* Un conflicto de versión o dependencia se comunica y mantiene la unidad intacta.
* Al reiniciar el Worker de desarrollo, las unidades nuevas o editadas se pierden; la persistencia durable requiere una migración conjunta de configuración.
