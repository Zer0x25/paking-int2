# Feature Specification: Gestión del ciclo de vida de unidades de negocio

**Feature Branch**: `003-business-unit-lifecycle`
**Created**: 2026-10-17
**Status**: Approved
**Input**: User description: "lo mismo para la creacion de unidades, no puedo crear, no puedo editar, no puedo eliminar, solucionalo"

## User Scenarios & Testing

### User Story 1 - Crear unidades de negocio (Priority: P1)

Como administrador, quiero crear una unidad de negocio con nombre, código, tipo de cuota y cupos base, para incluir nuevos destinos del complejo en la operación.

**Why this priority**: La creación es la acción que hoy falta en la pantalla y habilita que las nuevas unidades puedan usarse en áreas, reservas y operación.

**Independent Test**: Crear una unidad con valores válidos y comprobar que aparece en la lista activa y en los selectores operativos.

**Acceptance Scenarios**:

1. **Given** que el administrador está autenticado y completa los cuatro campos, **When** guarda una unidad, **Then** la unidad se guarda y aparece en la lista activa.
2. **Given** que existe una unidad con el mismo código en la instalación, **When** se intenta repetir ese código, **Then** el sistema rechaza la operación y conserva la unidad existente.
3. **Given** que el usuario no tiene permisos de administrador, **When** intenta crear una unidad, **Then** el sistema rechaza la operación.
4. **Given** que los cupos garantizados ya cubren el aforo total, **When** se intenta crear otra unidad garantizada que lo excede, **Then** el sistema rechaza el alta y no guarda la unidad.

### User Story 2 - Editar una unidad de negocio (Priority: P1)

Como administrador, quiero editar el nombre, código, tipo de cuota y cupos base de una unidad existente, para mantener su configuración correcta sin perder sus referencias históricas.

**Why this priority**: La unidad debe poder mantenerse desde la misma pantalla donde se administra el recinto.

**Independent Test**: Editar una unidad existente, consultar la lista nuevamente y verificar que muestra los cuatro valores guardados.

**Acceptance Scenarios**:

1. **Given** una unidad activa, **When** el administrador guarda cambios válidos en cualquiera de sus campos, **Then** la unidad muestra los cambios y conserva sus referencias.
2. **Given** un código que ya pertenece a otra unidad de la instalación, **When** se intenta guardar el cambio, **Then** el sistema rechaza el cambio sin modificar la unidad.
3. **Given** que la unidad cambió desde que se abrió el formulario, **When** se envía una edición desactualizada, **Then** el sistema pide actualizar la lista y conserva la versión más reciente.
4. **Given** una unidad con reservas vigentes, **When** se intenta cambiarla a un tipo de cuota que deja de admitir reservas contractuales, **Then** el sistema rechaza solo ese cambio y conserva la configuración actual.

### User Story 3 - Eliminar una unidad sin borrar su historial (Priority: P1)

Como administrador, quiero retirar una unidad que ya no se usa, para que deje de aparecer en la operación diaria sin perder su historial.

**Why this priority**: Retirar unidades obsoletas mantiene simples los selectores y evita borrar información que todavía sirve para explicar áreas, reservas o sesiones previas.

**Independent Test**: Retirar una unidad sin compromisos activos, confirmar la acción y verificar que desaparece de los selectores activos mientras permanece en el historial.

**Acceptance Scenarios**:

1. **Given** una unidad sin sesiones activas, áreas activas exclusivas ni reservas vigentes, **When** el administrador confirma su retiro, **Then** deja de aparecer en los selectores activos y queda visible como inactiva en el historial.
2. **Given** una unidad que tiene sesiones, áreas exclusivas o reservas vigentes, **When** se intenta retirar, **Then** el sistema explica qué compromiso debe resolverse y mantiene la unidad activa.
3. **Given** una unidad retirada, **When** se consultan sus reservas y sesiones históricas, **Then** sus referencias y registros permanecen disponibles.
4. **Given** que el usuario cancela la confirmación de retiro, **When** vuelve a la lista, **Then** la unidad no cambia.

### Edge Cases

- Los códigos se comparan sin distinguir mayúsculas y se guardan normalizados en mayúsculas.
- Una edición de cupos base debe respetar que el valor sea un entero no negativo.
- La suma de cupos garantizados y compromisos de reservas vigentes no puede superar el aforo de la instalación.
- Un intento de editar o retirar una unidad inexistente o perteneciente a otra instalación debe rechazarse sin mutar datos.
- Una reserva vigente comprende una reserva no cancelada ni completada que aún se conserva en la lista activa, incluido su día de gracia.
- Una unidad contractual no puede dejar ese tipo de cuota mientras mantenga reservas vigentes asociadas.

## Requirements

### Functional Requirements

- **FR-001**: El administrador debe poder crear una unidad con nombre, código, tipo de cuota y cupos base.
- **FR-002**: El sistema debe validar que el nombre y el código no estén vacíos, que el código sea único dentro de la instalación, que los cupos base sean un entero no negativo y que las cuotas garantizadas más las reservas vigentes no excedan el aforo.
- **FR-003**: El administrador debe poder editar todos los campos de una unidad activa desde un formulario.
- **FR-004**: El sistema debe detectar ediciones con una versión desactualizada y evitar sobrescribir cambios posteriores.
- **FR-005**: El administrador debe poder retirar una unidad mediante confirmación; retirarla la marca inactiva, conserva su identidad e historial y la oculta de los selectores de trabajo activos.
- **FR-006**: El sistema debe impedir retirar una unidad mientras tenga sesiones activas, áreas activas exclusivas o reservas vigentes, e identificar al usuario qué compromiso debe resolver.
- **FR-007**: El sistema debe mostrar las unidades activas y el historial de unidades inactivas dentro de Configuración.
- **FR-008**: Solo los administradores autenticados pueden crear, editar o retirar unidades.
- **FR-009**: Cada creación, edición o retiro debe conservar quién realizó el cambio, cuándo ocurrió y qué valores cambiaron.
- **FR-010**: Después de una operación confirmada, la lista de configuración y los catálogos operativos deben reflejar el estado más reciente.
- **FR-011**: El sistema debe impedir que una unidad con reservas vigentes deje el tipo de cuota contractual, para que sus cupos programados sigan protegidos.

### Key Entities

- **Unidad de negocio**: destino operativo con nombre, código, tipo de cuota, cupos base y estado activo/inactivo; pertenece a una instalación.
- **Referencia operativa**: sesión activa, área exclusiva o reserva vigente que depende de una unidad y puede impedir que sea retirada.
- **Registro de auditoría**: historial de actor, fecha y datos modificados para cada cambio de una unidad.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Un administrador puede crear una unidad válida y encontrarla en la lista activa en menos de 2 minutos.
- **SC-002**: Un administrador puede modificar los cuatro campos de una unidad y confirmar los nuevos valores al volver a cargar la lista.
- **SC-003**: El 100% de códigos repetidos y retiros con compromisos vigentes se rechazan sin alterar datos.
- **SC-004**: Cada unidad retirada desaparece de los selectores operativos y conserva sus referencias en el historial.
- **SC-005**: El 100% de los intentos de mutación sin permisos de administrador son rechazados.

## Assumptions

- El rol administrador y la instalación activa existentes se reutilizan.
- "Eliminar" significa retiro lógico para conservar sesiones, áreas, reservas y auditoría relacionadas.
- Si una referencia operativa sigue vigente, el administrador primero debe resolverla antes de retirar la unidad.
- El almacenamiento de desarrollo sigue el patrón en memoria que usa actualmente la configuración; guardar por D1 no forma parte de este cambio.
