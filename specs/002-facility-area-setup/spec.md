# Feature Specification: Instalaciones, Áreas y Reservas de Eventos

**Feature Branch**: `002-facility-area-setup`  
**Created**: 2026-10-15  
**Status**: Approved
**Input**: Capacidad de construir la instalación, asignar la cantidad total de estacionamientos, crear las áreas de aparcamiento y definir la cantidad de plazas por área con capacidad de reajuste dinámico en caliente.

## Clarifications

### Session 2026-10-15
- Q: ¿Cómo deben representarse y gestionarse las plazas de estacionamiento dentro de cada área? → A: Capacidad numérica agregada (cupo total por instalación y cupo dinámico por área), gestionando ocupación en tiempo real sin requerir micro-gestión individual de plazas numeradas.
- Q: ¿Cómo se vinculan las áreas físicas de estacionamiento con las Unidades de Negocio? → A: Modelo flexible: las áreas pueden ser de uso compartido (abiertas a múltiples unidades de negocio) o reservadas exclusivamente para una unidad específica (ej. Zona Exclusiva Hotel).
- Q: ¿Qué regla de integridad rige si la suma de capacidades de las áreas no coincide con la capacidad total de la instalación? → A: Se permite que la sumatoria de plazas de las áreas sea menor o igual al total del recinto (las plazas no asignadas a un área específica quedan como 'Reserva Flotante / Buffer General' del complejo); se bloquea si la suma supera la capacidad física total.
- Q: ¿Qué comportamiento debe tener el sistema si se intenta reducir la capacidad de un área por debajo de los vehículos actualmente estacionados? → A: Bloqueo estricto: el sistema rechaza la reducción y exige que la nueva capacidad sea mayor o igual a los vehículos que se encuentran actualmente aparcados en dicha área.

### Session 2026-10-17
- Q: ¿Qué campos debe poder editar el administrador en un área existente? → A: Nombre, código, descripción, régimen de uso y capacidad desde un formulario.
- Q: Si el rango de un evento termina el día 17, ¿hasta cuándo debe aparecer la reserva en la lista activa? → A: Debe permanecer visible hasta las 23:59 del día siguiente (día 18) y ocultarse al comenzar el día 19.

### Cobertura de ciclo de vida del recinto (2026-10-18)
- El administrador autenticado sin recinto asignado puede crear el recinto inicial desde una pantalla de configuración; la operación lo asigna al recinto y mantiene su sesión activa.
- El alta inicial también crea la categoría de espacio `STD` (“General / Estándar”) con todos los cupos físicos del recinto, para que Garita pueda registrar entradas desde el primer uso.
- La migración de categorías incorpora esa misma categoría a cada recinto activo existente que aún no tenga `STD`, sin modificar categorías ya configuradas.
- El tipo de cuota de una unidad de negocio (garantizada, contractual o dinámica) y el tipo de espacio (por ejemplo, General / Estándar) son datos distintos; el primero define cómo se asignan cupos a la unidad y el segundo se selecciona al admitir un vehículo.
- Editar modifica los datos del recinto existente. Eliminar significa desactivar lógicamente, conservar el historial y devolver al usuario al inicio de sesión; no se borran físicamente registros.
- No se puede desactivar un recinto mientras tenga vehículos activos. Una vez desactivado, el recinto deja de aceptar lecturas y escrituras operativas.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Creación y Configuración Integral de la Instalación (Priority: P1)

Como administrador del sistema, necesito crear y parametrizar la instalación principal definiendo su nombre, ubicación y la cantidad total de plazas de estacionamiento disponibles, para establecer el límite físico base del complejo multi-negocio.

**Why this priority**: Es la base física y matemática indispensable. Sin una instalación formalmente creada y con capacidad total definida, no es posible crear áreas ni asignar plazas de manera consistente.

**Independent Test**: Un administrador ingresa al panel de configuración, registra una nueva instalación llamada "Centro de Convenciones & Hotel Grand Pacific" con capacidad total de 250 plazas; el sistema persiste los datos localmente y en el servidor, estableciendo el recinto como activo.

**Acceptance Scenarios**:
1. **Given** un administrador autenticado en la interfaz de configuración, **When** completa el formulario de creación de instalación con nombre ("Centro Grand Pacific"), dirección ("Av. Costanera 1000") y capacidad total (250 plazas) y confirma, **Then** el sistema valida que la capacidad sea un entero mayor a cero, persiste la instalación y la deja seleccionada como la instalación activa del sistema.
2. **Given** una instalación ya existente, **When** el administrador actualiza el nombre o modifica la capacidad total del recinto, **Then** el sistema valida que la nueva capacidad total no sea inferior a la suma actual de plazas ya comprometidas por áreas activas o vehículos aparcados, guardando el cambio con registro de auditoría.
3. **Given** el dispositivo del administrador pierde conexión a internet, **When** crea o actualiza los datos de la instalación, **Then** los cambios se almacenan en IndexedDB local de inmediato y se encolan para sincronización en cuanto regrese la conectividad.
4. **Given** un administrador autenticado sin recinto asignado, **When** completa y confirma el formulario inicial, **Then** el recinto se persiste en D1, se asigna a su identidad y recibe una sesión actualizada sin tener que iniciar sesión otra vez.
5. **Given** un recinto sin vehículos activos, **When** el administrador confirma eliminarlo, **Then** se desactiva lógicamente, conserva auditoría y registros históricos, deja de aparecer como recinto operativo y la interfaz vuelve al inicio de sesión.
6. **Given** un recinto con vehículos activos, **When** el administrador intenta eliminarlo, **Then** la operación se rechaza con una explicación y el recinto permanece activo.
7. **Given** un administrador que crea el recinto inicial con capacidad de 120 plazas, **When** termina el alta, **Then** la lista de tipos de espacio incluye “General / Estándar” con 120 cupos y permite registrar una entrada sin configurar otro catálogo primero.

---

### User Story 2 - Creación y Parametrización de Áreas / Sectores de Estacionamiento (Priority: P1)

Como administrador de operaciones, necesito crear diferentes áreas o sectores físicos dentro de la instalación (ej. "Subsuelo 1 - Techado", "Sector Norte - Aire Libre", "Zona Preferencial Hotel"), asignándoles un identificador, tipo y descripción, para organizar la distribución espacial del recinto.

**Why this priority**: Permite subdividir la capacidad global en sectores operativos reales donde los operadores de garita o el personal de tráfico pueden dirigir a los usuarios según su destino o tipo de vehículo.

**Independent Test**: El administrador crea tres áreas ("Nivel Subsuelo", "Playa Abierta", "Sector VIP"), verificando que cada una posea un identificador unívoco y aparezcan listadas en la vista de áreas de la instalación.

**Acceptance Scenarios**:
1. **Given** una instalación activa, **When** el administrador define una nueva área con nombre ("Sector Subsuelo A"), código ("SUB-A") y descripción opcional, **Then** el sistema crea el área vinculada a la instalación, garantizando que el código sea único dentro de dicho recinto.
2. **Given** áreas existentes en la instalación, **When** el administrador consulta el inventario de áreas, **Then** el sistema muestra la lista completa de sectores con su estado (activo/inactivo), capacidad asignada y ocupación actual.
3. **Given** un área en la que no se registran vehículos estacionados actualmente, **When** el administrador decide desactivar o eliminar el área, **Then** el sistema permite la acción previa confirmación, liberando sus cupos asignados al saldo general de la instalación.

---

### User Story 3 - Asignación y Reajuste Dinámico de Capacidad por Área (Priority: P1)

Como administrador o supervisor, necesito definir y ajustar en tiempo real (en caliente) la cantidad de plazas asignadas a cada área, permitiendo responder a eventos masivos, obras de mantenimiento o picos de demanda sin detener las operaciones.

**Why this priority**: Cumple con el requerimiento central de que la cantidad de plazas por área sea dinámica. En centros de convenciones y complejos con hotel, las áreas deben reconfigurarse rápidamente ante necesidades operativas cambiantes.

**Independent Test**: En una instalación de 100 plazas con Área A (40 plazas) y Área B (40 plazas), el administrador reajusta en caliente Área A a 60 plazas y Área B a 30 plazas (total 90, dejando 10 de margen). El sistema actualiza los límites inmediatamente sin cerrar sesiones activas.

**Acceptance Scenarios**:
1. **Given** una instalación con capacidad total de 200 plazas y varias áreas creadas, **When** el administrador asigna 80 plazas al Área Subsuelo, 70 al Área Norte y 50 al Área Este, **Then** el sistema valida que la suma (200) no exceda la capacidad total y fija los nuevos topes operativos por área.
2. **Given** un área con 25 vehículos actualmente estacionados, **When** el administrador intenta reducir dinámicamente su capacidad a 20 plazas, **Then** el sistema rechaza la operación informando que la nueva capacidad no puede ser menor a la ocupación actual (25 vehículos) para evitar inconsistencias de sobrecupo.
3. **Given** una reasignación dinámica aprobada, **When** un operador registra un nuevo ingreso vehicular en dicha área, **Then** el cálculo de disponibilidad respeta de inmediato el nuevo límite configurado.

---

### User Story 4 - Visualización y Asignación Operativa por Área en Garita y Dashboard (Priority: P2)

Como operador de acceso o supervisor en tiempo real, necesito ver el estado de ocupación desglosado por área física durante el ingreso vehicular y en el dashboard de control, para saber con exactitud en qué sector quedan lugares disponibles y guiar a los conductores.

**Why this priority**: Cierra el ciclo entre la configuración administrativa y la ejecución operativa en garita, otorgando valor directo al personal que gestiona los accesos.

**Independent Test**: Al registrar el ingreso de un vehículo en el formulario de entrada, el operador visualiza el selector de áreas con su ocupación relativa (ej. "Subsuelo A: 18/20 ocupado - 90%"), seleccionando un área disponible y actualizándose el conteo en tiempo real.

**Acceptance Scenarios**:
1. **Given** un operador registrando un ingreso vehicular, **When** selecciona la unidad de negocio y visualiza las áreas físicas disponibles, **Then** el sistema muestra la disponibilidad en tiempo real de cada área (plazas libres / capacidad total del área).
2. **Given** un área que ha alcanzado el 100% de su capacidad dinámica asignada, **When** el operador intenta asignar un vehículo a esa área específica, **Then** el sistema advierte que el área está completa y sugiere un área alternativa con disponibilidad.
3. **Given** el dashboard operativo central, **When** ocurren ingresos o salidas, **Then** se presenta una sección visual con tarjetas o medidores de ocupación por cada área física configurada.

### User Story 5 - Gestión de Eventos y Reservas Contractuales (Priority: P2)

Como administrador, necesito crear cualquier cantidad de reservas contractuales de estacionamiento para eventos con anticipación, editar sus datos y cancelarlas, para comprometer cupos durante un rango específico de fechas y horarios.

**Why this priority**: Las reservas para eventos deben poder programarse con anticipación y ajustarse sin editar datos estáticos; su vigencia define cuándo se protegen los cupos de la unidad de Eventos.

**Independent Test**: Crear dos reservas para fechas distintas, editar una, cancelar la otra y comprobar que los cupos comprometidos respetan la capacidad física cuando los rangos coinciden; comprobar también que una reserva deja la lista activa al vencer.

**Acceptance Scenarios**:
1. **Given** un administrador en Configuración, **When** registra el nombre del evento, unidad de negocio, cupos, fecha y hora de inicio y término, **Then** la reserva aparece en la lista aunque su inicio sea futuro y puede crearse cualquier número de reservas mientras cumplan las reglas de capacidad.
2. **Given** reservas de eventos que coinciden total o parcialmente en su rango de fecha y hora, **When** el administrador crea o edita otra reserva, **Then** el sistema impide que los cupos garantizados y las reservas simultáneas superen la capacidad física total del recinto.
3. **Given** una reserva futura o vigente, **When** el administrador edita sus datos o la elimina, **Then** los cambios se reflejan en la lista; eliminarla la cancela y conserva el registro histórico.
4. **Given** una reserva cuyo rango termina el día 17, **When** transcurre el día 18 en la zona horaria local de la instalación, **Then** permanece en la lista hasta las 23:59 del día 18 y desaparece al comenzar el día 19, sin borrar el registro histórico.
5. **Given** una reserva programada, **When** un operador admite vehículos, **Then** sus cupos contractuales afectan la disponibilidad solo durante el rango de fecha y hora del evento.

---

### Edge Cases

- **Suma de áreas menor a la capacidad total**: La suma de plazas de las áreas puede ser menor a la capacidad total de la instalación. Las plazas restantes se consideran "Plazas no asignadas / Reserva flotante general".
- **Intento de sobreasignación**: Si la suma de las capacidades asignadas a las áreas supera la capacidad total de la instalación, el sistema debe bloquear el guardado indicando el excedente exacto de plazas.
- **Cambio de capacidad durante ingreso simultáneo**: Si dos administradores o un proceso automatizado reajustan la capacidad de un área mientras ingresan vehículos, la persistencia atómica con control de concurrencia optimista (versioning) previene estados inconsistentes.
- **Operación offline de áreas**: Si se crean o reajustan áreas en modo offline en la terminal del administrador, las garitas locales operan con la última configuración cacheada en IndexedDB hasta que se sincronice el delta.
- **Rango nocturno de evento**: Una reserva puede comenzar un día y terminar al día siguiente; el término debe ser posterior al inicio y el día posterior a la fecha final se conserva como gracia para la lista administrativa.
- **Reservas simultáneas**: Las reservas no pueden comprometer más cupos que la capacidad del recinto una vez sumadas las cuotas garantizadas vigentes en los mismos instantes.
- **Eliminación de una reserva**: Eliminar equivale a cancelarla; se oculta inmediatamente de la lista activa y se conserva para referencia histórica.
- **Vencimiento de una reserva**: Al finalizar el día calendario posterior a la fecha final, la reserva desaparece de la lista activa pero permanece almacenada.
- **Primer recinto en D1 vacío**: La sesión de un administrador sin recinto debe permitir únicamente completar el alta inicial; dos solicitudes concurrentes no pueden dejar recintos sin asignar ni cambiar el recinto de la cuenta.
- **Desactivación de recinto**: Si hay sesiones vehiculares activas, se bloquea la desactivación; si no las hay, se conserva la información histórica y las rutas de datos dejan de permitir operaciones sobre ese recinto.
- **Sesión antigua tras desactivar**: Los tokens previos del recinto archivado no deben permitir consultar sesiones activas ni efectuar nuevas operaciones.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE permitir a los administradores crear, consultar, modificar y desactivar instalaciones físicas con nombre, dirección y capacidad total de plazas.
- **FR-002**: El sistema DEBE garantizar que la capacidad total de una instalación sea un número entero estrictamente positivo (> 0).
- **FR-003**: El sistema DEBE permitir crear y editar áreas o sectores físicos asociados a una instalación, incluyendo nombre, código alfanumérico único por recinto, descripción y régimen de uso (compartido o asignado a una unidad de negocio), manteniendo su estado activo.
- **FR-004**: El sistema DEBE permitir asignar y modificar dinámicamente la capacidad de plazas de cada área individual en tiempo de ejecución.
- **FR-005**: El sistema DEBE validar que la sumatoria de las capacidades de todas las áreas activas no sobrepase la capacidad total configurada en la instalación.
- **FR-006**: El sistema DEBE impedir que la capacidad de un área se reduzca por debajo del número de vehículos que se encuentran físicamente estacionados en ella en ese momento.
- **FR-007**: El sistema DEBE permitir asociar o vincular áreas a unidades de negocio específicas (ej. Área exclusiva Hotel) o dejarlas en modalidad de uso compartido multi-negocio.
- **FR-008**: El sistema DEBE permitir asociar cada sesión de estacionamiento (ingreso vehicular) a un área física específica de la instalación.
- **FR-009**: El sistema DEBE reflejar en el dashboard operativo la disponibilidad y porcentaje de ocupación en tiempo real por cada área física.
- **FR-010**: El sistema DEBE persistir las instalaciones y áreas en IndexedDB local con soporte offline-first y sincronización incremental hacia Cloudflare D1 en el backend.
- **FR-011**: El sistema DEBE registrar en la bitácora de auditoría todo cambio de capacidad de la instalación o de sus áreas, incluyendo usuario responsable y marca de tiempo.
- **FR-012**: El sistema DEBE permitir eliminar un área vacía tras confirmación explícita, conservando su registro histórico y liberando su capacidad al buffer; debe bloquear la operación si el área mantiene vehículos activos y excluir áreas inactivas de los catálogos operativos.
- **FR-013**: El sistema DEBE permitir que un administrador cree y consulte múltiples reservas contractuales de eventos sin un límite arbitrario de registros.
- **FR-014**: Cada reserva DEBE incluir nombre de evento, unidad de negocio contractual, cupos, fecha y hora de inicio y fecha y hora de término; el término debe ser posterior al inicio y se permiten rangos que crucen medianoche.
- **FR-015**: El sistema DEBE permitir editar una reserva o cancelarla mediante eliminación confirmada, ocultando las reservas canceladas de la lista activa y conservando su registro histórico.
- **FR-016**: La lista administrativa DEBE incluir reservas próximas, vigentes y dentro del día calendario de gracia posterior a su fecha de término; debe ocultarlas al comenzar el día siguiente a dicho día de gracia, según la zona horaria local de la instalación.
- **FR-017**: El sistema DEBE impedir que los compromisos simultáneos por cuotas garantizadas y reservas de eventos superen la capacidad física total de la instalación.
- **FR-018**: Los cupos contractuales de un evento DEBEN influir en la disponibilidad operativa únicamente durante su intervalo programado de fecha y hora.
- **FR-019**: Las creaciones, ediciones y cancelaciones de reservas DEBEN conservar el historial de cambios en el registro de auditoría.
- **FR-020**: Un administrador autenticado sin recinto asignado DEBE poder crear el recinto inicial; el guardado debe asociarlo de forma atómica a su identidad y emitir una sesión válida para el recinto recién creado.
- **FR-021**: El sistema DEBE permitir al administrador desactivar lógicamente un recinto tras confirmación explícita, conservar sus datos y auditoría, y bloquear la acción mientras existan sesiones vehiculares activas.
- **FR-022**: Las rutas operativas y de lectura de un recinto desactivado DEBEN rechazar tokens antiguos y no exponer sus sesiones o catálogos como activos.

### Key Entities *(include if feature involves data)*

- **Facility (Instalación)**:
  - `id`: Identificador único UUID.
  - `name`: Nombre del complejo o centro de convenciones.
  - `address`: Dirección física.
  - `totalCapacity`: Número total de plazas de estacionamiento físicas.
  - `isActive`: Estado operativo; la baja es lógica y conserva la identidad y datos asociados.
  - `version`: Versión interna para evitar conflictos en operaciones concurrentes.
  - `createdAt`, `updatedAt`: Marcas de tiempo ISO 8601.

- **ParkingArea (Área de Estacionamiento)**:
  - `id`: Identificador único UUID.
  - `facilityId`: Referencia a la instalación contenedora.
  - `name`: Nombre descriptivo del área (ej. "Nivel -1 Subsuelo").
  - `code`: Código alfanumérico corto (ej. "SUB-1").
  - `description`: Descripción o referencias de ubicación.
  - `allocatedCapacity`: Cantidad dinámica de plazas asignadas al área.
  - `businessUnitId`: Referencia opcional a Unidad de Negocio exclusiva (null si es compartida).
  - `isActive`: Indicador booleano de disponibilidad operativa.
  - `version`: Entero para control de concurrencia optimista.
  - `createdAt`, `updatedAt`: Marcas de tiempo ISO 8601.

- **ParkingSession (Ampliación)**:
  - `parkingAreaId`: Referencia opcional al área física donde aparcó el vehículo.

- **EventBooking (Reserva de Evento)**:
  - `id`, `facilityId`, `businessUnitId`: Identidad y referencias al recinto y a la unidad contractual.
  - `title`: Nombre obligatorio del evento.
  - `reservedSlots`: Cupos positivos comprometidos por la reserva.
  - `startTime`, `endTime`: Marcas ISO 8601 que representan el rango inclusivo de fecha y hora; `endTime` debe ser posterior a `startTime`.
  - `status`: Estado de reserva; cancelar la reserva la excluye de compromisos futuros y de la lista activa sin borrar el historial.
  - `version`: Versión entera para evitar sobrescribir una edición más reciente.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Los administradores pueden registrar una nueva instalación y definir su capacidad total en menos de 30 segundos a través de la interfaz visual.
- **SC-002**: La creación y reajuste dinámico de capacidad de un área se propaga y refleja en los contadores operativos del cliente en menos de 200 ms.
- **SC-003**: El 100% de los intentos de sobreasignación (donde la suma de áreas supere la capacidad del recinto o la reducción sea inferior a los vehículos aparcados) son prevenidos y alertados claramente antes de persistir.
- **SC-004**: Los operadores en garita pueden visualizar y seleccionar el área física asignada en el flujo de ingreso en un solo clic adicional sin aumentar el tiempo total de registro por encima de 2 segundos.
- **SC-005**: La totalidad de operaciones de configuración de áreas e instalaciones opera fluidamente en modo offline con persistencia en IndexedDB y resolución de conflictos al reconectar.
- **SC-006**: Un administrador puede completar la creación, edición o cancelación de una reserva desde Configuración en menos de 60 segundos.
- **SC-007**: El 100% de las reservas cuya fecha final ya excedió el día calendario de gracia desaparece de la lista activa y conserva su registro histórico.
- **SC-008**: El 100% de los intentos de comprometer cupos simultáneos por encima de la capacidad física se bloquea antes de guardar.
- **SC-009**: Un administrador sin recinto asignado puede crear el recinto inicial y completar la configuración sin volver a iniciar sesión.
- **SC-010**: El 100% de los intentos de desactivar un recinto con vehículos activos se bloquea; las sesiones antiguas de recintos desactivados no acceden a datos operativos.

---

## Assumptions

- Cada área pertenece exactamente a una instalación.
- La suma de capacidades de áreas no necesita ser exactamente igual al total; la diferencia representa plazas de reserva libre no sectorizadas.
- La eliminación de áreas se realiza como baja lógica para conservar referencias históricas a sesiones y auditoría.
- La eliminación de recintos se realiza como baja lógica; solo se permite cuando no quedan vehículos activos y los datos históricos se conservan.
- No existe un límite artificial al número de reservas; la capacidad comprometida en los intervalos coincidentes es el límite efectivo.
- La eliminación de reservas es una cancelación lógica para conservar auditoría e historia.
- Las fechas se interpretan en la zona horaria local de la instalación; un rango terminado el día D se mantiene visible durante todo el día D+1 y se oculta al comenzar D+2.
- Se reutiliza la arquitectura existente de autenticación (roles Admin y Operador) y la infraestructura de sincronización offline con IndexedDB y Cloudflare Workers / D1.
