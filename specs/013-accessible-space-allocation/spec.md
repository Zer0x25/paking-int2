# Feature Specification: Capacidad por Tipo de Espacio

**Feature Branch**: `013-accessible-space-allocation`

**Created**: 2026-10-18

**Status**: Approved

**Input**: User request: dividir la capacidad del recinto y de cada área entre plazas Estándar y Accesibles, manteniendo separados los tipos de cuota de negocio.

## Clarifications

### Session 2026-10-18
- Q: Para un recinto de 35 plazas, ¿cómo repartimos Estándar y Accesible? → A: Ingresar la cantidad Accesible y calcular Estándar automáticamente como capacidad total menos plazas Accesibles.
- Q: Si ya no quedan plazas Accesibles, ¿cómo registramos un vehículo que requiere ese tipo de plaza? → A: Permitir asignarlo a una plaza Estándar disponible, mostrar una alerta y mantener las plazas Accesibles protegidas frente a entradas Estándar.

## User Scenarios & Testing

### User Story 1 - Configurar capacidad por tipo en el recinto (Priority: P1)

Como administrador, quiero ingresar la capacidad total del recinto y cuántas plazas serán Accesibles, para que el sistema calcule las plazas Estándar y mantenga el total físico correcto.

**Why this priority**: El reparto del recinto define el límite disponible para todas las áreas y evita que las plazas Accesibles se mezclen con el cupo general.

**Independent Test**: Crear un recinto de 35 plazas e indicar 2 Accesibles; comprobar que el resumen muestra 33 Estándar y 2 Accesibles, y que rechaza una cantidad Accesible superior a 35.

**Acceptance Scenarios**:

1. **Given** un administrador configurando un recinto de 35 plazas, **When** ingresa 2 plazas Accesibles, **Then** el sistema muestra 33 plazas Estándar y 2 Accesibles.
2. **Given** una configuración de recinto existente, **When** el administrador cambia la cantidad Accesible, **Then** el cupo Estándar se recalcula para que ambos tipos sigan sumando exactamente la capacidad total.
3. **Given** un cambio que reduciría la capacidad de un tipo por debajo de las plazas ocupadas o asignadas a áreas, **When** el administrador intenta guardarlo, **Then** el sistema rechaza el cambio y explica qué asignación impide aplicarlo.

---

### User Story 2 - Distribuir cada tipo entre áreas (Priority: P1)

Como administrador, quiero definir cuántas plazas Estándar y Accesibles se asignan a cada área, para adaptar la distribución física sin superar los cupos del recinto.

**Why this priority**: Un área debe mostrar la disponibilidad real por tipo y permitir orientar entradas al sector que tenga capacidad adecuada.

**Independent Test**: En un recinto con 33 plazas Estándar y 2 Accesibles, configurar un área con 20 Estándar y 1 Accesible y otra con 10 Estándar y 1 Accesible; comprobar que quedan 3 Estándar sin asignar y 0 Accesibles sin asignar.

**Acceptance Scenarios**:

1. **Given** un área nueva o existente, **When** el administrador asigna sus cantidades Estándar y Accesible, **Then** el total del área se calcula como la suma de ambas cantidades.
2. **Given** varias áreas activas, **When** el administrador aumenta la asignación de un tipo, **Then** el sistema permite guardar solo si la suma de ese tipo no supera el cupo correspondiente del recinto.
3. **Given** plazas de un tipo actualmente ocupadas en un área, **When** el administrador intenta reducir ese tipo por debajo de su ocupación, **Then** el cambio se rechaza con el número de vehículos que excede la nueva capacidad.
4. **Given** cupos del recinto que no están asignados a áreas, **When** el administrador consulta la distribución, **Then** el sistema conserva esos cupos como reserva flotante del mismo tipo.

---

### User Story 3 - Admitir vehículos respetando tipo y cuota (Priority: P1)

Como operador de garita, quiero registrar la categoría de espacio usada por cada vehículo y ver la disponibilidad compatible, para evitar sobrepasar las plazas físicas y proteger las Accesibles.

**Why this priority**: La configuración solo aporta control si las entradas y salidas actualizan la ocupación correcta y aplican las reservas físicas junto con las reglas de cuota de cada unidad.

**Independent Test**: Registrar entradas Estándar hasta agotar su capacidad y comprobar que no consumen cupos Accesibles; después agotar Accesibles y comprobar que el sistema permite usar una plaza Estándar disponible con una alerta visible.

**Acceptance Scenarios**:

1. **Given** una entrada clasificada como Estándar, **When** hay capacidad Estándar disponible, **Then** la sesión consume una plaza Estándar y no reduce la disponibilidad Accesible.
2. **Given** una entrada que solicita una plaza Accesible, **When** hay capacidad Accesible disponible en el área elegida, **Then** la sesión consume una plaza Accesible.
3. **Given** que el área elegida no tiene plazas Accesibles pero otra área sí, **When** el operador intenta registrar la entrada Accesible, **Then** el sistema sugiere el área alternativa con capacidad Accesible.
4. **Given** que no quedan plazas Accesibles en el recinto pero hay plazas Estándar disponibles, **When** el operador intenta registrar la entrada Accesible, **Then** el sistema muestra una alerta y permite al operador confirmar su asignación a Estándar.
5. **Given** que no hay plazas del tipo solicitado ni capacidad Estándar para la alternativa, **When** el operador intenta registrar la entrada, **Then** el sistema rechaza el ingreso por capacidad agotada.
6. **Given** que una unidad alcanza su cuota garantizada o contractual, o no tiene disponibilidad dinámica, **When** el operador registra un vehículo, **Then** el sistema aplica también esa regla de negocio además del límite por tipo y área.

---

### User Story 4 - Consultar disponibilidad por tipo (Priority: P2)

Como administrador u operador, quiero ver capacidad, ocupación y disponibilidad Estándar y Accesible por recinto y por área, para decidir dónde dirigir los vehículos.

**Why this priority**: La vista de ocupación debe explicar qué cupos están libres, en vez de mostrar únicamente un total que puede ocultar que uno de los tipos ya se agotó.

**Independent Test**: Con sesiones activas de ambos tipos en dos áreas, comprobar que cada tarjeta y resumen muestra los valores separados y que la suma coincide con los totales físicos.

**Acceptance Scenarios**:

1. **Given** sesiones activas asignadas a un tipo y área, **When** un usuario consulta el dashboard, **Then** capacidad, ocupación y disponibilidad se muestran separadas para Estándar y Accesible.
2. **Given** un ingreso, salida o ajuste de capacidad confirmado, **When** se actualiza la vista operativa, **Then** los conteos por recinto, área y tipo reflejan el cambio.

### Edge Cases

- La cantidad Accesible es cero; el sistema muestra toda la capacidad como Estándar y no presenta disponibilidad Accesible.
- La cantidad Accesible es negativa, no entera o superior a la capacidad total; el sistema rechaza el guardado.
- La capacidad de un área puede ser menor que la suma de los cupos no asignados del recinto; los cupos restantes siguen disponibles como reserva flotante por tipo.
- La suma de asignaciones Estándar o Accesibles de áreas activas supera el cupo correspondiente del recinto; el sistema bloquea el cambio aunque la suma total de plazas de áreas no supere la capacidad total.
- Una reducción propuesta queda por debajo de la ocupación activa de su categoría; el cambio se bloquea sin cerrar ni reasignar sesiones.
- Al migrar un recinto que ya tiene sesiones activas de ambas categorías, la capacidad inicial por tipo y área cubre esas sesiones y conserva las capacidades agregadas existentes.
- En ingresos simultáneos, una misma plaza restante no puede asignarse más de una vez.
- Las entradas Estándar no pueden consumir plazas Accesibles. Cuando no hay Accesibles libres, el operador puede confirmar una alternativa Estándar únicamente si existe capacidad Estándar disponible.
- Si el área elegida no tiene plazas del tipo solicitado pero otra área sí, el sistema debe ofrecer esa alternativa antes de recurrir al cupo Estándar.
- Las reglas de cuota garantizada, contractual y dinámica siguen aplicándose de forma independiente a la clasificación física del espacio.

## Requirements

### Functional Requirements

- **FR-001**: El sistema DEBE permitir configurar la capacidad total del recinto y la cantidad de plazas Accesibles; DEBE calcular la cantidad Estándar como la diferencia entre ambas.
- **FR-002**: La cantidad Accesible DEBE ser un entero entre cero y la capacidad total; la suma de plazas Estándar y Accesibles DEBE ser exactamente la capacidad total.
- **FR-003**: El sistema DEBE ofrecer solo las categorías Estándar y Accesible para la nueva configuración y para nuevas admisiones.
- **FR-004**: El sistema DEBE permitir editar para cada área activa las cantidades Estándar y Accesible, y calcular la capacidad total del área como su suma.
- **FR-005**: La suma de las asignaciones Estándar de áreas activas DEBE ser menor o igual al cupo Estándar del recinto; la misma regla DEBE aplicarse por separado a las plazas Accesibles.
- **FR-006**: Los cupos de cada tipo no asignados a un área DEBEN permanecer disponibles como reserva flotante de ese tipo.
- **FR-007**: El sistema DEBE impedir reducir la capacidad del recinto o de un área por tipo por debajo de la ocupación activa o de la asignación de áreas que quedaría comprometida.
- **FR-008**: Cada sesión activa DEBE registrar el tipo físico de plaza que ocupa y, si aplica, el área donde se encuentra.
- **FR-009**: Una entrada Estándar DEBE consumir solo capacidad Estándar y NUNCA consumir cupos Accesibles.
- **FR-010**: Una entrada Accesible DEBE ocupar capacidad Accesible disponible. Si el área elegida no tiene cupo Accesible pero otra área sí, el sistema DEBE sugerir esa área alternativa. Solo cuando no queden plazas Accesibles en todo el recinto, el sistema DEBE avisar al operador y permitir confirmar la asignación a una plaza Estándar disponible.
- **FR-011**: Si no queda capacidad compatible, incluida la alternativa Estándar indicada en FR-010, el sistema DEBE rechazar la entrada con una explicación de capacidad agotada.
- **FR-012**: La admisión DEBE cumplir tanto la disponibilidad física por tipo y área como las reglas independientes de cuota garantizada, contractual o dinámica de la unidad de negocio.
- **FR-013**: El dashboard y la vista de operación DEBEN mostrar capacidad, ocupación y plazas libres por tipo para el recinto y cada área activa.
- **FR-014**: Los cambios de reparto del recinto y de las áreas DEBEN conservar la trazabilidad de quién hizo el cambio y cuándo, y seguir el proceso de sincronización vigente.
- **FR-015**: Si dos operaciones concurrentes podrían sobreasignar plazas, el sistema DEBE aplicar como máximo una y explicar al otro administrador la capacidad que queda disponible.

### Key Entities

- **Recinto**: Capacidad total y cantidad de plazas Accesibles; su cantidad Estándar se deriva como diferencia.
- **Área**: Asignación independiente de plazas Estándar y Accesibles; su capacidad total es la suma de ambos tipos.
- **Tipo de espacio**: Una de las dos categorías físicas permitidas en esta versión: Estándar o Accesible.
- **Sesión de estacionamiento**: Vehículo activo vinculado a una unidad de negocio, tipo físico de espacio y, cuando corresponda, área.
- **Cuota de unidad de negocio**: Regla garantizada, contractual o dinámica que define disponibilidad para la unidad y se mantiene independiente del tipo físico.

## Success Criteria

### Measurable Outcomes

- **SC-001**: El 100% de los recintos guardados muestra plazas Estándar y Accesibles cuya suma coincide con la capacidad total.
- **SC-002**: El 100% de las asignaciones de áreas guardadas respeta el cupo disponible de cada tipo en el recinto.
- **SC-003**: Ninguna entrada Estándar reduce la disponibilidad de plazas Accesibles; toda alternativa de Accesible a Estándar muestra una alerta antes de confirmar.
- **SC-004**: El dashboard presenta conteos por tipo que coinciden con capacidad configurada y sesiones activas para el recinto y cada área.
- **SC-005**: Ningún ajuste aprobado deja la ocupación activa por encima de la capacidad de su tipo en el recinto o área.
- **SC-006**: Los recintos existentes mantienen su capacidad total y pueden continuar operando tras la actualización; el administrador puede redistribuir su capacidad por tipo sin perder sesiones históricas.

## Assumptions

- La capacidad total representa el límite físico del recinto y no cambia al redistribuir categorías.
- La categoría seleccionada representa el tipo de plaza que ocupará el vehículo; el sistema no almacena ni infiere información personal sobre discapacidad.
- El administrador ingresa en el recinto la cantidad Accesible; la cantidad Estándar es de solo lectura y se calcula automáticamente.
- En las áreas, el administrador puede editar ambos tipos por separado; el total del área se calcula automáticamente.
- Las categorías de cuota de negocio (garantizada, contractual y dinámica) no se reemplazan ni se combinan con los tipos de espacio.
- Las plazas no asignadas a áreas siguen formando parte de la reserva flotante del recinto, separadas por tipo.
- La disponibilidad de cada tipo se mantiene mediante la operación actual de entradas y salidas; el cambio conserva el comportamiento offline vigente.
- Las nuevas admisiones y configuraciones usan únicamente Estándar y Accesible.
- La primera migración conserva las sesiones activas existentes: dimensiona cada categoría para su ocupación actual y mantiene las asignaciones totales de áreas; el reparto no ocupado restante puede ajustarse luego desde Configuración.

## Out of Scope

- Crear categorías físicas adicionales como VIP, carga eléctrica, visitas o motocicletas.
- Numerar individualmente cada plaza de estacionamiento.
- Verificar o almacenar documentos, diagnósticos o atributos personales para decidir quién puede usar una plaza Accesible.
- Cambiar las reglas comerciales de cuotas garantizadas, contractuales o dinámicas.
