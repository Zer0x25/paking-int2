# Feature Specification: Operación unificada de Garita

**Feature Branch**: `005-gate-operations`

**Created**: 2026-10-17

**Status**: Approved

**Input**: User request to combine the vehicle entry and exit cards, provide Entrada/Salida controls, show active vehicles with a quick exit action, correct an active vehicle's plate, and accept all six-character alphanumeric plate combinations in `XX-XX-XX` format.

## User Scenarios & Testing

### User Story 1 - Registrar entrada o salida desde una ficha única (Priority: P1)

La persona operadora trabaja desde una sola ficha de operación y cambia entre Entrada y Salida con controles visibles. El formulario muestra los campos necesarios para la acción seleccionada. La lista activa aparece en un panel independiente debajo de la ficha.

**Why this priority**: Reduce el ruido visual y hace más rápida la tarea principal de la garita.

**Independent Test**: Cambiar entre Entrada y Salida en Garita y comprobar que una operación válida conserva sus datos actuales, registra el cambio y refresca la lista activa.

**Acceptance Scenarios**:

1. **Given** la vista Garita, **When** la persona selecciona Entrada, **Then** ve el campo de patente, destino, tipo de espacio y área disponibles, además del control para registrar la entrada.
2. **Given** la vista Garita, **When** la persona selecciona Salida, **Then** ve el campo de patente y puede registrar la salida manualmente.
3. **Given** una entrada válida, **When** la persona la confirma, **Then** se registra una sesión activa, el formulario se limpia y el vehículo aparece en la lista con su patente normalizada.
4. **Given** una patente con sesión activa, **When** la persona registra su salida manual, **Then** la sesión se completa y desaparece de la lista activa.

### User Story 2 - Consultar y cerrar vehículos desde la lista activa (Priority: P1)

La persona operadora consulta en Garita los vehículos dentro del recinto y registra la salida del vehículo elegido desde su fila, sin volver a escribir la patente.

**Why this priority**: Evita errores de digitación y hace que las salidas habituales requieran una sola acción sobre el vehículo correcto.

**Independent Test**: Registrar o cargar varias sesiones activas, elegir la acción de salida de una fila y verificar que solo esa sesión se completa y deja la lista.

**Acceptance Scenarios**:

1. **Given** sesiones activas en la instalación actual, **When** la persona abre Garita, **Then** cada fila muestra patente, hora de entrada, unidad de negocio y área asignada cuando exista.
2. **Given** una fila activa, **When** la persona selecciona Registrar salida, **Then** se completa esa sesión sin pedir que escriba la patente y la fila se retira de la lista.
3. **Given** que no hay vehículos activos, **When** se muestra la lista, **Then** aparece un estado vacío comprensible.
4. **Given** una salida desde la lista, **When** la operación concluye, **Then** los indicadores del Dashboard se actualizan con el mecanismo actual.

### User Story 3 - Corregir la patente de una sesión activa (Priority: P2)

La persona operadora puede corregir una patente digitada incorrectamente mientras el vehículo continúe dentro del recinto.

**Why this priority**: Corrige errores de entrada sin crear una salida y un nuevo ingreso ficticios ni perder la hora, destino o área originales.

**Independent Test**: Editar una patente activa, confirmar su nuevo formato, verificar que la sesión conserva sus otros datos y que una patente duplicada se rechaza.

**Acceptance Scenarios**:

1. **Given** una sesión activa, **When** la persona edita y guarda una patente válida, **Then** se actualiza la patente de esa sesión y la hora de ingreso y asignaciones permanecen iguales.
2. **Given** que la patente editada ya identifica otro vehículo activo, **When** la persona intenta guardar, **Then** se rechaza el cambio y se conserva la patente previa.
3. **Given** una sesión completada, **When** una persona consulta su historial, **Then** no puede editar la patente desde la lista operativa.
4. **Given** que la actualización se realiza sin conexión, **When** se guarda, **Then** el cambio se refleja en la lista local y queda pendiente de sincronización.

### User Story 4 - Validar y presentar patentes en formato uniforme (Priority: P1)

La persona operadora ingresa patentes formadas por seis caracteres alfanuméricos en cualquiera de sus combinaciones y el sistema las presenta en tres grupos de dos, separados por guiones.

**Why this priority**: Evita aceptar patentes incompletas o ambiguas y mantiene una lectura uniforme en los formularios, la lista y los comprobantes.

**Independent Test**: Probar combinaciones de letras y números con y sin guiones; verificar que cada valor completo se muestra como `XX-XX-XX` y que longitudes distintas se rechazan.

**Acceptance Scenarios**:

1. **Given** hasta seis caracteres alfanuméricos ingresados con o sin guiones, **When** se muestran en el campo, **Then** se convierten a mayúsculas y los guiones aparecen entre grupos completos de dos caracteres; al completar seis caracteres se presenta `XX-XX-XX`.
2. **Given** una patente con menos o más de seis caracteres alfanuméricos, **When** se intenta registrar o corregir, **Then** el sistema explica el formato esperado y no guarda el cambio.
3. **Given** una patente válida con espacios u otros caracteres que no sean letras, números o guiones, **When** se valida, **Then** se rechaza y no se registra.
4. **Given** una patente válida ya activa en la instalación, **When** se intenta registrar de nuevo, **Then** se impide duplicar la sesión.

## Edge Cases

- Una sesión puede cerrarse en otro dispositivo mientras la lista está abierta; la acción sobre una sesión ya cerrada informa el conflicto y actualiza la lista.
- Dos operadores pueden corregir simultáneamente la misma sesión; solo se acepta la actualización basada en la versión vigente.
- La lista puede recibir datos del servidor, de la caché local y de operaciones pendientes; una salida pendiente no debe reaparecer como activa y una entrada pendiente debe seguir visible.
- Si la lista falla al cargar, los formularios siguen utilizables y se muestra un mensaje de error con opción de reintento.
- Los registros cerrados permanecen en el historial; la lista operativa solo contiene sesiones activas.

## Requirements

### Functional Requirements

- **FR-001**: Garita MUST presentar Entrada y Salida como modos de una ficha de operación única.
- **FR-002**: El modo Entrada MUST conservar la selección de destino, tipo de espacio y área física existente.
- **FR-003**: El modo Salida MUST permitir localizar y cerrar una sesión mediante la patente ingresada.
- **FR-004**: Garita MUST mostrar las sesiones activas de la instalación actual con patente, hora de entrada y datos de destino disponibles.
- **FR-005**: Cada fila activa MUST permitir registrar la salida de la sesión seleccionada sin volver a escribir la patente.
- **FR-006**: El cierre desde una fila MUST identificar una sesión específica y actualizar ocupación y lista cuando termine.
- **FR-007**: Una persona operadora MUST poder corregir la patente de una sesión activa, conservando la hora de entrada y sus asignaciones.
- **FR-008**: La corrección MUST rechazarse si el vehículo ya no está activo, la versión quedó desactualizada o la nueva patente pertenece a otra sesión activa de la misma instalación.
- **FR-009**: Patentes ingresadas y corregidas MUST contener exactamente seis caracteres alfanuméricos; se aceptan con o sin guiones, se convierten a mayúsculas y se presentan como `XX-XX-XX`.
- **FR-010**: El sistema MUST rechazar patentes incompletas, excesivas o con caracteres no admitidos y explicar el formato requerido.
- **FR-011**: Las entradas, salidas y correcciones MUST seguir funcionando sin conexión mediante los datos locales y quedar disponibles para sincronización posterior.
- **FR-012**: Las operaciones de entrada, salida y corrección MUST conservar actor, fecha y valores necesarios para trazabilidad conforme a los permisos existentes.
- **FR-013**: Los errores de carga o conflicto MUST comunicarse sin ocultar ni modificar silenciosamente la sesión.
- **FR-014**: Dashboard MUST seguir recibiendo el estado actualizado de ocupación después de una entrada o salida.

### Key Entities

- **Sesión de estacionamiento**: Vehículo y periodo activo/completado en una instalación, con patente, hora, destino, área, estado y versión.
- **Mutación pendiente**: Acción operativa realizada sin conexión que se conserva hasta su sincronización.
- **Auditoría operativa**: Actor, acción, sesión, valores relevantes antes/después y fecha de la operación.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Garita muestra una sola ficha de operación con el modo activo claramente identificado.
- **SC-002**: Una salida desde la lista activa puede realizarse sin escribir la patente y retira únicamente la sesión elegida.
- **SC-003**: El 100% de las patentes válidas de seis caracteres se presenta en formato `XX-XX-XX`; ninguna patente con longitud distinta se registra.
- **SC-004**: Corregir una sesión activa conserva su hora y asignaciones y rechaza duplicados sin modificar datos previos.
- **SC-005**: En modo offline, las entradas, salidas y correcciones se reflejan en la lista local y sobreviven a una recarga de la página.
- **SC-006**: El Dashboard refleja el resultado de la última entrada o salida dentro del siguiente ciclo de actualización existente.

## Assumptions

- El alcance de edición desde la lista es solo para sesiones activas, según aclaración del usuario.
- La normalización acepta seis letras/números con o sin guiones y muestra siempre el formato agrupado `XX-XX-XX`, según aclaración del usuario.
- La lista muestra primero las sesiones más recientes y mapea unidad/área a sus nombres usando los catálogos actuales.
- La lista activa es un panel separado debajo de la ficha única de operación; cambiar de modo solo cambia los campos visibles.
- Los guiones se muestran progresivamente entre grupos completos de dos caracteres, sin cambiar el contenido canónico compacto.
- La aplicación conserva sus permisos, autenticación, almacenamiento en memoria de desarrollo y sincronización offline existentes.
