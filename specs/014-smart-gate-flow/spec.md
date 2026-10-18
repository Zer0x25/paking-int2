# Feature Specification: Flujo inteligente de patente en Garita

**Feature Branch**: `014-smart-gate-flow`

**Created**: 2026-10-18

**Status**: Approved for implementation

**Input**: User description: "al ingresar una patente, detectar si el vehículo ya está dentro para permitir solo salida; si no tiene ingreso activo, permitir solo entrada; mientras se escribe, mostrar coincidencias de vehículos dentro como buscador."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Detectar el movimiento válido (Priority: P1)

Como operador de garita, quiero que el sistema determine si una patente corresponde a un vehículo que sigue dentro del recinto, para mostrarme únicamente la acción correcta y reducir errores de movimiento.

**Why this priority**: Evita entradas duplicadas y salidas para vehículos que no tienen un ingreso activo, simplificando el paso de decisión actual.

**Independent Test**: Probar una patente activa y otra sin sesión activa; verificar que cada una muestre solamente la acción que corresponde.

**Acceptance Scenarios**:

1. **Given** una patente completa y válida sin sesión activa en el recinto actual, **When** el operador termina de ingresarla, **Then** el sistema ofrece únicamente continuar con la entrada.
2. **Given** una patente completa y válida que tiene una sesión activa en el recinto actual, **When** el sistema reconoce la coincidencia, **Then** muestra el vehículo dentro y ofrece únicamente Registrar salida.
3. **Given** se ofrece Registrar salida, **When** el operador la confirma, **Then** se procesa la salida del vehículo reconocido con el flujo vigente y se actualiza la lista de vehículos activos.
4. **Given** se ofrece continuar con la entrada, **When** el operador avanza, **Then** conserva la confirmación actual de unidad, tipo de espacio y área/sector antes de registrar el ingreso.
5. **Given** la lista activa aún se está cargando, **When** el operador ingresa una patente válida, **Then** la interfaz no presenta una decisión que pueda ser incorrecta por falta de datos.
6. **Given** el operador completa una patente válida y la lista activa está disponible, **When** el sistema reconoce su estado, **Then** presenta directamente la acción permitida sin un paso intermedio Registrar ni un selector genérico Entrada/Salida.

### User Story 2 - Buscar vehículos activos mientras se escribe (Priority: P1)

Como operador de garita, quiero ver coincidencias de patentes que están dentro mientras escribo, para elegir rápidamente el vehículo correcto y registrar su salida.

**Why this priority**: Permite encontrar vehículos activos sin volver a escribir la patente completa y conserva la salida rápida desde la lista.

**Independent Test**: Con varias sesiones activas, escribir el inicio de una patente y seleccionar un resultado; verificar que se complete la patente y quede disponible únicamente Registrar salida.

**Acceptance Scenarios**:

1. **Given** hay vehículos activos y el operador escribe parte de una patente, **When** existen coincidencias, **Then** aparece una lista acotada a vehículos activos del recinto actual.
2. **Given** aparecen coincidencias, **When** el operador elige un vehículo, **Then** la patente se completa y se muestran unidad, tipo de espacio, área/sector y hora de entrada disponibles junto a la acción Registrar salida.
3. **Given** no hay coincidencias parciales, **When** el operador continúa escribiendo una patente válida que no está activa, **Then** no aparecen resultados y solo se ofrece continuar con entrada.
4. **Given** las coincidencias están visibles, **When** el operador usa teclado o lector de pantalla, **Then** puede recorrerlas, seleccionarlas y entender el estado y la acción disponible.

### Edge Cases

- Una patente incompleta o inválida no habilita entrada ni salida.
- Una coincidencia exacta activa prevalece sobre cualquier coincidencia parcial y nunca permite iniciar otra entrada para esa patente.
- Las coincidencias consideran la patente normalizada, independientemente de si se escribe con o sin guiones.
- Si la lista activa no se puede actualizar, se informa que se usan los datos disponibles; el registro conserva las validaciones online/offline ya existentes y los conflictos se muestran sin perder la patente ingresada.
- Si otro operador registra la salida después de cargar la lista, el intento de salida informa el conflicto y actualiza la lista sin crear otra sesión.
- No se muestran patentes de otros recintos.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: La pantalla inicial de Garita MUST conservar un único campo para ingresar la patente.
- **FR-014**: La decisión de movimiento MUST aparecer al completar una patente válida, sin un paso intermedio de botón Registrar ni un selector genérico Entrada/Salida.
- **FR-002**: El sistema MUST determinar el movimiento a partir de si la patente tiene una sesión activa en el recinto actual.
- **FR-003**: Una patente completa y válida sin sesión activa MUST ofrecer únicamente continuar con la entrada; no debe mostrar una acción de salida.
- **FR-004**: La entrada MUST conservar la confirmación existente de unidad, tipo de espacio y área/sector antes de guardar la sesión.
- **FR-005**: Una patente con sesión activa MUST ofrecer únicamente Registrar salida; nunca debe permitir una segunda entrada mientras esa sesión siga activa.
- **FR-006**: Registrar salida MUST requerir una acción explícita del operador después de reconocer o seleccionar el vehículo.
- **FR-007**: Mientras se escribe una patente, el sistema MUST mostrar hasta cinco coincidencias por prefijo, comparadas con patentes normalizadas, entre los vehículos activos del recinto actual.
- **FR-008**: Al seleccionar una coincidencia, el sistema MUST completar la patente y presentar el estado dentro del recinto antes de permitir Registrar salida.
- **FR-009**: La comparación de patentes MUST ignorar guiones y diferencias entre mayúsculas y minúsculas, manteniendo el formato visible `XX-XX-XX`.
- **FR-010**: La interfaz MUST esperar a que la lista activa inicial esté disponible antes de mostrar sugerencias o una decisión de movimiento para una patente válida, e informar que está consultando los vehículos activos.
- **FR-011**: El sistema MUST conservar la búsqueda y las operaciones existentes de entrada, salida rápida, persistencia local y sincronización cuando no haya conexión.
- **FR-012**: La lista de sugerencias MUST distinguir vehículos activos y permitir recorrer opciones con las flechas, seleccionar con Enter, cerrar con Escape y entender el estado con tecnologías de asistencia.
- **FR-013**: Los errores o conflictos de entrada/salida MUST conservar la patente y permitir corregir o reintentar sin reiniciar la operación.
- **FR-015**: La búsqueda MUST filtrar las sesiones activas ya disponibles en el cliente y no emitir una consulta de red por cada tecla.

### Key Entities *(include if feature involves data)*

- **Sesión activa**: Ingreso vigente de un vehículo en un recinto, asociado a patente, unidad, tipo de espacio, área/sector y hora de entrada.
- **Coincidencia de patente**: Resultado de búsqueda de una sesión activa en el recinto de la operación; la selección identifica el vehículo para salida.
- **Operación de garita**: Flujo temporal que contiene la patente, el movimiento permitido y, para entradas, la selección de destino aún no confirmada.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: En todos los casos con una sesión activa exacta, la interfaz muestra salida como única acción de movimiento.
- **SC-002**: En todos los casos sin sesión activa y con patente válida, la interfaz muestra entrada como única acción de movimiento.
- **SC-003**: Las coincidencias activas aparecen mientras se escribe y se limitan al recinto actual.
- **SC-004**: Ninguna entrada se registra sin confirmar unidad, tipo de espacio y área/sector.
- **SC-005**: Ninguna sugerencia seleccionada registra una salida sin una confirmación explícita del operador.
- **SC-006**: Los flujos de entrada y salida siguen disponibles en escritorio y en pantallas móviles desde 375 px, con teclado y lector de pantalla.

## Assumptions

- El movimiento se infiere usando las sesiones activas que ya alimentan la lista visible de Garita.
- Seleccionar una sugerencia no ejecuta la salida automáticamente; el operador pulsa Registrar salida para evitar una salida accidental.
- Una patente válida sin coincidencia activa avanza al paso actual de confirmación de entrada.
- La disponibilidad puede usar los datos locales existentes cuando no hay conexión y mantiene la resolución de conflictos del flujo actual.
- La salida rápida desde la lista de vehículos activos permanece disponible.

## Out of Scope

- Cambiar el formato o las reglas de validación de patentes.
- Cambiar los campos de confirmación de una entrada o las reglas de asignación de estacionamientos.
- Añadir historial de búsqueda, nuevos permisos o datos permanentes de vehículos.
- Cambiar las reglas del servidor para resolver sesiones simultáneas; los errores de conflicto existentes se muestran y reconcilian.

## Clarifications

### Session 2026-10-18

- Q: ¿Apruebas implementar el flujo inteligente con una sola acción disponible según la sesión activa y sugerencias de patentes mientras escribes? → A: Sí, aprobado implementar; elegir un vehículo activo prepara la salida y requiere pulsar explícitamente Registrar salida.
