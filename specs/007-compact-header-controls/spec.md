# Feature Specification: Controles compactos para tema y conexión

**Feature Branch**: `007-compact-header-controls`

**Created**: 2026-10-17

**Status**: Approved

**Input**: El usuario solicita un único botón para alternar entre tema claro y oscuro, iniciar siguiendo la preferencia del sistema y reemplazar el aviso ancho de conexión por un indicador junto al botón de tema en la cabecera.

## User Scenarios & Testing

### User Story 1 - Cambiar entre tema claro y oscuro (Priority: P1)

La persona abre Smart Parking y ve el tema que usa su dispositivo. Si quiere cambiarlo, pulsa un solo botón con icono en la cabecera o en el acceso y la interfaz cambia entre claro y oscuro sin recargar.

**Why this priority**: El tema acompaña las condiciones de luz y preferencias de la persona sin ocupar espacio con un selector de tres opciones.

**Independent Test**: Abrir con el dispositivo en claro y oscuro, comprobar el tema inicial, alternar el botón en ambas direcciones y recargar para comprobar que la selección explícita permanece.

**Acceptance Scenarios**:

1. **Given** que no existe una elección explícita guardada, **When** se abre la aplicación, **Then** el tema coincide con la preferencia del sistema antes de mostrar la interfaz.
2. **Given** que la aplicación está en tema claro, **When** la persona pulsa el botón, **Then** pasa a oscuro sin recargar y el botón ofrece volver a claro.
3. **Given** que la aplicación está en tema oscuro, **When** la persona pulsa el botón, **Then** pasa a claro sin recargar y el botón ofrece volver a oscuro.
4. **Given** que la persona ya alternó el tema, **When** vuelve a abrir la aplicación o cambia la preferencia del dispositivo, **Then** se conserva el tema que eligió hasta que lo cambie de nuevo.
5. **Given** que la persona usa el inicio de sesión o una vista autenticada, **When** usa el botón, **Then** ve el mismo control y el mismo comportamiento.

### User Story 2 - Consultar conexión y sincronizar desde la cabecera (Priority: P1)

La persona ve de inmediato si el navegador tiene conexión y si hay cambios operativos pendientes, junto al botón de tema. El aviso que cruzaba el contenido deja de ocupar la pantalla. Si hay cambios pendientes y conexión disponible, puede iniciar la sincronización desde el indicador.

**Why this priority**: La conexión sigue visible durante la operación sin desplazar la información principal ni quitar acceso a la sincronización manual.

**Independent Test**: Cambiar el navegador entre conectado y desconectado, crear cambios pendientes, observar el icono y su contador, activar la sincronización manual cuando esté disponible y reconectar para comprobar el intento automático.

**Acceptance Scenarios**:

1. **Given** que una persona inició sesión, **When** hay conexión, **Then** la cabecera muestra un icono de conexión con nombre accesible que informa que está conectado.
2. **Given** que una persona inició sesión, **When** se pierde la conexión, **Then** el mismo indicador informa que está sin conexión sin mostrar el aviso ancho.
3. **Given** que hay mutaciones pendientes, **When** la persona observa la cabecera, **Then** el indicador muestra cuántas quedan pendientes.
4. **Given** que hay mutaciones pendientes y conexión disponible, **When** la persona activa el indicador, **Then** empieza la sincronización manual y el control comunica su estado.
5. **Given** que el navegador recupera la conexión, **When** hay mutaciones pendientes, **Then** se conserva el intento automático de sincronización.
6. **Given** que se está en el inicio de sesión, **When** la persona ve la barra de herramientas, **Then** aparece el botón de tema y no un estado de conexión operativo.

### Edge Cases

- Si el navegador no puede leer `localStorage`, el botón sigue alternando el tema durante esa sesión y el tema inicial vuelve a seguir al sistema.
- Si la preferencia del sistema cambia mientras no hay una elección explícita, la paleta visible sigue ese cambio.
- Si la sincronización está en curso, pulsaciones repetidas en el indicador no inician sincronizaciones concurrentes.
- Si hay cambios pendientes sin conexión, el contador sigue visible y la acción manual no intenta enviar datos hasta recuperar conexión.
- Un nombre accesible comunica el estado aun cuando el color del icono no se pueda distinguir.

## Requirements

### Functional Requirements

- **FR-001**: La aplicación MUST mostrar un único botón de tema que alterna entre claro y oscuro; no debe ofrecer un selector visible de tres opciones.
- **FR-002**: Si no existe una elección explícita guardada, la aplicación MUST adoptar el tema actual del sistema antes de mostrar la interfaz.
- **FR-003**: Al alternar el botón, la aplicación MUST actualizar todas las vistas sin recargar y recordar la elección explícita en ese navegador.
- **FR-004**: El botón MUST indicar mediante icono, nombre accesible y foco visible el cambio de tema disponible.
- **FR-005**: El botón de tema MUST estar disponible en el inicio de sesión y en la navegación autenticada.
- **FR-006**: La aplicación MUST mostrar el estado de conexión en la cabecera autenticada, junto al botón de tema, y quitar el aviso ancho del área de contenido.
- **FR-007**: El indicador MUST comunicar conectado/sin conexión con nombre accesible, y mostrar el número de mutaciones pendientes cuando sea mayor que cero.
- **FR-008**: Cuando hay conexión y mutaciones pendientes, activar el indicador MUST iniciar la sincronización manual; cuando no hay conexión o no hay pendientes, no debe enviar datos.
- **FR-009**: La aplicación MUST conservar el intento automático de sincronización al recuperar conectividad, el control de sincronizaciones simultáneas y la actualización de datos tras cambios sincronizados.
- **FR-010**: El estado de conexión MUST permanecer disponible a tecnología de asistencia, y su significado no debe depender solo del color.
- **FR-011**: La actualización MUST conservar operaciones, permisos, modo offline y datos existentes.

### Key Entities

- **Preferencia de apariencia**: Elección del tema efectivo del navegador; sigue al sistema mientras no exista una elección manual y luego conserva la última elección clara u oscura.
- **Estado de sincronización**: Conectividad del navegador, cantidad de cambios pendientes, progreso de sincronización y hora de la última sincronización exitosa.

## Success Criteria

### Measurable Outcomes

- **SC-001**: En el 100% de los arranques sin elección guardada, el primer tema visible coincide con la preferencia del sistema.
- **SC-002**: Una persona puede cambiar de tema con un solo control y el cambio aparece sin recargar en la vista activa.
- **SC-003**: Después de una elección explícita, el mismo navegador conserva ese tema en el 100% de las recargas.
- **SC-004**: El estado de conexión y el contador pendiente se actualizan en la cabecera sin ocupar una franja a lo ancho del contenido.
- **SC-005**: La persona puede iniciar la sincronización manual desde el indicador cuando está conectada y hay cambios pendientes.
- **SC-006**: Ambos controles se pueden identificar con lector de pantalla y alcanzar con teclado; el tema conserva un área táctil mínima de 44 por 44 píxeles.

## Assumptions

- La preferencia por defecto sigue siendo `system`; la primera pulsación establece una elección explícita contraria al tema efectivo y esa elección persiste en el navegador.
- Esta especificación reemplaza la selección manual Sistema/Claro/Oscuro y la presentación del aviso ancho descritas en la feature 006; conserva su tema inicial basado en el sistema y sus bases responsive.
- El indicador de conexión solo aparece tras iniciar sesión; el inicio de sesión conserva únicamente el control de tema.
- Para preservar la acción manual existente, el icono de conexión funciona como acceso a sincronización solo cuando hay conexión y cambios pendientes.
- El indicador mantiene el contador de cambios pendientes y comunica el progreso accesiblemente, sin incorporar texto persistente ancho en la cabecera.
- La apariencia, la sincronización y el comportamiento offline existentes se mantienen; el alcance es la presentación y el acceso a controles.
