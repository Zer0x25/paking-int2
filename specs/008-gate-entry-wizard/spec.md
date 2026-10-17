# Feature Specification: Flujo guiado de garita

**Feature Branch**: `008-gate-entry-wizard`

**Created**: 2026-10-17

**Status**: Implemented; UUID compatibility verified; user-confirmed mobile visual review complete; manual browser flow pending

**Input**: User description: "Simplificar la operación de garita con una patente y un único botón Registrar; después elegir Entrada o Salida; para Entrada, pedir confirmar unidad, tipo de espacio y sector antes de guardar para reducir errores humanos."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Elegir el movimiento a partir de una patente (Priority: P1)

Como operador de garita, quiero ingresar primero la patente y elegir después si el vehículo entra o sale, para que la operación empiece con un único dato y reduzca selecciones equivocadas.

**Why this priority**: Es el punto de inicio común de las operaciones de entrada y salida y elimina el selector de movimiento que hoy comparte pantalla con el formulario completo.

**Independent Test**: Desde la vista Garita, ingresar una patente válida, avanzar con Registrar y completar una salida; comprobar que el registro usa la patente indicada y que la lista de vehículos activos se actualiza.

**Acceptance Scenarios**:

1. **Given** la garita está lista para una operación, **When** el operador la abre, **Then** ve el campo Patente y un solo botón Registrar, sin campos de destino ni botones de movimiento todavía.
2. **Given** hay una patente incompleta o inválida, **When** el operador pulsa Registrar, **Then** ve el error de formato y permanece en el primer paso.
3. **Given** la patente cumple el formato admitido, **When** el operador pulsa Registrar, **Then** la patente se conserva y se muestran las opciones Entrada y Salida.
4. **Given** se muestran los movimientos para una patente válida, **When** el operador elige Salida, **Then** la salida se registra para esa patente mediante la operación existente, online u offline, sin pedirla otra vez.
5. **Given** el operador avanzó al paso de movimiento, **When** vuelve al paso anterior, **Then** puede corregir la patente sin perder los demás datos ya elegidos.

### User Story 2 - Confirmar el destino antes de una entrada (Priority: P1)

Como operador de garita, quiero revisar y confirmar la unidad, el tipo de espacio y el área o sector antes de registrar una entrada, para evitar asociar el vehículo al destino equivocado.

**Why this priority**: Una entrada afecta cupos y asignación de espacios; la confirmación explícita reduce errores operativos antes de guardar la sesión.

**Independent Test**: Ingresar una patente válida, elegir Entrada, revisar/cambiar unidad, tipo y sector, y confirmar; comprobar que la sesión queda registrada con exactamente las selecciones confirmadas.

**Acceptance Scenarios**:

1. **Given** el operador eligió Entrada, **When** se abre el siguiente paso, **Then** ve la patente retenida y controles para confirmar unidad, tipo de espacio y área/sector, incluida la alternativa de asignación automática/flotante.
2. **Given** están visibles los datos de la entrada, **When** el operador pulsa Confirmar entrada, **Then** el sistema registra la entrada con esos valores y presenta el resultado de la operación.
3. **Given** el operador revisa los datos de entrada, **When** vuelve al paso de movimiento, **Then** se conservan la patente y las selecciones para que pueda corregirlas.
4. **Given** falta una unidad o un tipo de espacio seleccionable, **When** el operador intenta confirmar, **Then** no se registra la sesión y se informa qué dato requiere atención.
5. **Given** la entrada se realiza sin conexión, **When** el operador confirma los datos, **Then** la operación se conserva con el comportamiento offline-first existente y queda pendiente de sincronización.

### Edge Cases

- Si la patente ya tiene una sesión activa, no se crea una segunda entrada; se conserva y muestra el error de la validación existente.
- Si no existe una sesión activa para la patente elegida para salida, no se registra salida y se muestra el error existente.
- Si falla el registro remoto, el flujo mantiene los datos confirmados y aplica el fallback local ya existente cuando corresponda.
- Cambiar de paso no limpia los campos; terminar correctamente una operación sí vuelve al primer paso y limpia la patente.
- El operador puede usar teclado y lector de pantalla para comprender el paso actual, los botones disponibles y los errores.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: La vista de garita MUST iniciar cada operación mostrando únicamente el campo de patente y una acción principal Registrar.
- **FR-002**: El sistema MUST validar la patente con el formato alfanumérico de seis caracteres existente y normalizarla como `XX-XX-XX` antes de avanzar.
- **FR-003**: Una patente inválida MUST permanecer en el paso inicial y mostrar un mensaje claro sin iniciar una operación.
- **FR-004**: Después de validar la patente, el sistema MUST pedir al operador elegir explícitamente Entrada o Salida y conservar la patente.
- **FR-005**: Al elegir Salida, el sistema MUST ejecutar la salida para la patente conservada mediante los flujos online/offline existentes, y MUST actualizar la lista de vehículos activos al terminar.
- **FR-006**: Al elegir Entrada, el sistema MUST mostrar controles para revisar y seleccionar unidad, tipo de espacio y área/sector, incluyendo asignación automática/flotante.
- **FR-007**: El sistema MUST registrar una entrada únicamente después de que el operador pulse Confirmar entrada en el paso de revisión.
- **FR-008**: La entrada MUST usar la patente, unidad, tipo de espacio y área/sector que estén visibles y seleccionados al confirmar.
- **FR-009**: El sistema MUST permitir volver al paso anterior, conservar los datos ingresados y corregir la patente o las selecciones antes de confirmar.
- **FR-010**: Ante errores de validación o registro, el sistema MUST conservar el paso y los valores necesarios para corregir y reintentar.
- **FR-011**: Al completar correctamente una operación, el sistema MUST restablecer el flujo al paso inicial para el siguiente vehículo.
- **FR-012**: El sistema MUST conservar la lista de vehículos activos, la salida rápida desde esa lista y la corrección de patente para sesiones activas.
- **FR-013**: Los pasos, controles, mensajes y acciones MUST conservar nombres accesibles y estados distinguibles en escritorio y en el ancho móvil base de 375 px.
- **FR-014**: El sistema MUST generar identificadores operativos seguros en navegadores que implementen Web Crypto `getRandomValues()` pero no `crypto.randomUUID()`.

### Key Entities *(include if feature involves data)*

- **Operación de garita**: Proceso temporal que contiene una patente validada, el movimiento elegido y el paso actual; sus datos aún no forman una sesión hasta confirmar la operación.
- **Sesión de estacionamiento**: Registro operativo existente que relaciona patente, unidad, tipo de espacio, área/sector y horas de entrada/salida.
- **Selección de destino**: Conjunto de unidad, tipo de espacio y área/sector confirmado para una entrada; un área vacía representa asignación automática/flotante.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: En el estado inicial de la operación, el operador puede identificar un único dato requerido y una única acción para avanzar: patente y Registrar.
- **SC-002**: Ninguna entrada produce una sesión antes de la confirmación explícita de unidad, tipo y área/sector.
- **SC-003**: En una salida manual, el operador ingresa la patente una sola vez y no necesita volver a escribirla tras elegir Salida.
- **SC-004**: Los errores de patente, destino o registro dejan visible el paso apropiado con los valores necesarios para corregir sin empezar de nuevo.
- **SC-005**: La secuencia completa de entrada y salida mantiene el comportamiento online/offline existente y las acciones de la lista de vehículos activos.
- **SC-006**: En un navegador sin `crypto.randomUUID()` pero con `crypto.getRandomValues()`, una entrada confirmada debe registrarse sin error y usar un UUID versión 4 válido.

## Assumptions

- La entrada conserva las selecciones actuales o los primeros valores disponibles como sugerencia, pero requiere que el operador pulse Confirmar entrada en el paso de revisión.
- La opción automática/flotante cuenta como una selección explícita válida para el área/sector.
- Elegir Salida en el paso de movimiento ejecuta la operación existente con la patente ingresada; no se añade un paso de datos de destino para salida.
- Las reglas de formato de patente y de sesión activa no cambian en esta mejora.
- No se cambian los endpoints, el modelo de sesión, el outbox ni la lista de vehículos activos.
- La compatibilidad de UUID usa Web Crypto seguro; no recurre a `Math.random()` ni a identificadores no aleatorios.

## Out of Scope

- Cambiar reglas de cupos, asignación dinámica o permisos de usuarios.
- Cambiar la API o la persistencia de sesiones.
- Alterar la corrección de patente y salida rápida desde la lista de vehículos activos.
