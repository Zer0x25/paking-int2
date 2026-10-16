# Feature Specification: Sistema Inteligente de Gestión de Estacionamientos (MVP)

**Feature Branch**: `001-parking-core-mvp`  
**Created**: 2026-10-15  
**Status**: Draft  
**Input**: Motor de asignación y control de estacionamientos con prioridades dinámicas para instalaciones multi-negocio (Hotel, Eventos, Comercial) y operaciones de entrada/salida offline-first.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Registro Rápido de Entrada y Salida Vehicular con Soporte Offline (Priority: P1)

Como operador de acceso o garita, necesito registrar el ingreso y egreso de vehículos indicando su patente y área de destino, incluso si la conexión a la red se interrumpe, para mantener el control de ocupación continuo y evitar demoras en el acceso.

**Why this priority**: Es la funcionalidad operativa fundamental. Si los operadores no pueden registrar vehículos de manera instantánea y sin interrupciones por problemas de red, el sistema no tiene viabilidad operativa en campo.

**Independent Test**: Un operador en un dispositivo desconectado de internet registra el ingreso de 3 vehículos y la salida de 1; el sistema actualiza la ocupación local inmediatamente y, al restablecer la conexión, los datos se sincronizan con la base central sin errores ni duplicaciones.

**Acceptance Scenarios**:
1. **Given** un vehículo llega al acceso y hay disponibilidad para su unidad de negocio, **When** el operador ingresa la placa patente, selecciona la unidad de destino (ej. Hotel o Restaurante) y confirma el ingreso, **Then** el sistema registra la entrada con marca de tiempo, descuenta un espacio disponible y muestra el ticket/resumen de acceso exitoso en menos de 1 segundo.
2. **Given** un vehículo previamente registrado se presenta en la salida, **When** el operador busca o escanea la patente y confirma la salida, **Then** el sistema registra la hora de salida, calcula el tiempo total de permanencia, libera el espacio de estacionamiento y actualiza el conteo global.
3. **Given** el dispositivo del operador pierde la conexión a internet, **When** el operador registra un ingreso o salida vehicular, **Then** el sistema almacena la transacción localmente de forma segura, actualiza los contadores visibles de ocupación y notifica discretamente que la operación está pendiente de sincronización automática.
4. **Given** un operador intenta ingresar un vehículo cuya placa ya figura como "activa/adentro" en el recinto, **When** se envía el registro de entrada, **Then** el sistema alerta sobre la anomalía vehicular y solicita confirmación o corrección antes de duplicar el estado.

---

### User Story 2 - Motor de Asignación y Priorización Dinámica de Cupos (Priority: P1)

Como administrador del complejo, necesito configurar reglas de prioridad donde el Hotel tenga disponibilidad garantizada, los Eventos cuenten con cupos contractuales reservados por horario, y el remanente de espacios se distribuya dinámicamente entre Restaurante, Gimnasio y visitas, para maximizar el uso del recinto sin incumplir compromisos comerciales.

**Why this priority**: Resuelve el problema medular del negocio: la competencia por espacios escasos entre unidades de negocio con diferentes niveles de compromiso contractual y rentabilidad.

**Independent Test**: Configurar un estacionamiento de 100 plazas con 40 plazas reservadas para Hotel y 30 para un Evento de 14:00 a 18:00. Al intentar registrar 35 vehículos de Restaurante a las 15:00, el sistema permite los primeros 30 y bloquea o emite alerta crítica para los siguientes 5 porque las 70 plazas restantes están protegidas para Hotel y Evento.

**Acceptance Scenarios**:
1. **Given** una instalación con capacidad total configurada y cupos garantizados para el Hotel, **When** llegan huéspedes del hotel, **Then** el sistema siempre les garantiza ingreso mientras su ocupación no supere el cupo asignado, protegiendo estos espacios frente a la demanda de áreas comerciales rotativas.
2. **Given** un evento programado para una franja horaria específica con una cantidad pactada de espacios (ej. Conferencia de 50 cupos), **When** el evento entra en vigencia temporal, **Then** el sistema reserva automáticamente esa cantidad de espacios y restringe el acceso de vehículos generales si ello compromete la cuota del evento.
3. **Given** la demanda de espacios generales supera los cupos libres no comprometidos, **When** un cliente de restaurante o gimnasio intenta ingresar sin disponibilidad remanente, **Then** el sistema notifica al operador que el área comercial ha alcanzado su capacidad máxima permitida para ese horario.

---

### User Story 3 - Dashboard Operativo y Alertas de Capacidad en Tiempo Real (Priority: P2)

Como administrador o supervisor de operaciones, necesito visualizar en un panel central la ocupación global, el desglose de disponibilidad por unidad de negocio y alertas visuales de saturación, para tomar decisiones operacionales preventivas y derivar tráfico oportunamente.

**Why this priority**: Proporciona visibilidad situacional instantánea para los tomadores de decisión, facilitando la coordinación entre el equipo de recepción del hotel, los organizadores de eventos y el personal de control de tráfico.

**Independent Test**: Abrir el dashboard en pantalla completa y observar la actualización instantánea de las barras de ocupación y porcentajes a medida que ingresan y salen vehículos en diferentes unidades de negocio.

**Acceptance Scenarios**:
1. **Given** el dashboard abierto en el terminal de supervisión, **When** ocurren entradas y salidas de vehículos, **Then** los indicadores de ocupación global y desglosada por unidad de negocio (Hotel, Eventos, Restaurante, Gimnasio) reflejan los valores actualizados en tiempo real.
2. **Given** la ocupación de una unidad de negocio o del estacionamiento global alcanza el 90% de su capacidad disponible, **When** el umbral se cruza, **Then** el dashboard muestra una alerta visual destacada (amarilla/ámbar) indicando capacidad próxima a saturación.
3. **Given** la ocupación alcanza el 100% de los espacios permitidos para un sector, **When** se intenta un nuevo ingreso no prioritario, **Then** el dashboard emite una alerta crítica (roja) de capacidad agotada.

---

### User Story 4 - Configuración Agnóstica de Instalaciones, Áreas y Categorías (Priority: P2)

Como administrador del sistema, necesito parametrizar la estructura de la instalación (capacidad total, categorías de plazas como estándar, personas con discapacidad/accesibles, VIP) y definir las unidades de negocio sin modificar código fuente, para que la solución sea reutilizable en cualquier centro de convenciones o complejo comercial.

**Why this priority**: Garantiza la modularidad y adaptabilidad de la aplicación a distintas sedes, sucursales o configuraciones del recinto.

**Independent Test**: Crear una nueva instalación ("Centro Norte") con 150 plazas (130 generales, 10 accesibles, 10 VIP), definir 3 unidades de negocio y verificar que el motor de asignación opera de inmediato bajo estos nuevos parámetros.

**Acceptance Scenarios**:
1. **Given** un usuario con rol de Administrador, **When** accede a la sección de configuración y define el nombre del recinto, capacidad total y desglose por tipo de espacio, **Then** la instalación queda creada y disponible para asignaciones.
2. **Given** un administrador desea agregar una nueva unidad de negocio (ej. "Spa"), **When** completa el formulario con nombre, prioridad relativa y tipo de política de cupo, **Then** la nueva unidad se incorpora de inmediato a las opciones de ingreso y reportes.

---

### User Story 5 - Autenticación, Roles y Trazabilidad de Auditoría (Priority: P3)

Como responsable de seguridad, necesito que el acceso a la aplicación esté restringido mediante credenciales seguras, diferenciando entre Administrador y Operador, y que cada acción sobre los cupos o vehículos quede registrada en una bitácora de auditoría inmutable.

**Why this priority**: Asegura la gobernanza de accesos, evita manipulaciones no autorizadas en tarifas o cupos y permite determinar la autoría de cada cambio.

**Independent Test**: Iniciar sesión como operador y verificar que las opciones de reconfiguración de cuotas y parámetros de instalación están restringidas, mientras que las de registro vehicular están habilitadas; y verificar que cada ingreso registre el identificador del usuario que lo operó.

**Acceptance Scenarios**:
1. **Given** un usuario ingresa sus credenciales válidas, **When** el sistema valida su identidad, **Then** se inicia la sesión y se cargan las vistas permitidas según su rol (Admin: acceso total; Operador: interfaz de garita y dashboard básico).
2. **Given** cualquier operación realizada en el sistema (ingreso, egreso, cambio de cupos o modificación de eventos), **When** se almacena en el registro de auditoría, **Then** se incluye usuario responsable, tipo de acción, identificador de entidad y marca de tiempo exacta.

---

### Edge Cases

- **Pérdida prolongada de conectividad**: Un operador trabaja desconectado durante 4 horas y registra 50 vehículos. El sistema debe conservar íntegramente las transacciones en almacenamiento local y sincronizarlas de manera secuencial ordenada cuando vuelva la red, notificando si alguna placa ya fue egresada en otra garita.
- **Solapamiento de Eventos**: Dos eventos programados en el mismo día comparten una franja horaria de 30 minutos de solapamiento. El motor debe sumar los cupos garantizados requeridos durante esa media hora y verificar si la capacidad total de la instalación puede sostener ambos compromisos simultáneos, alertando al administrador en caso de déficit.
- **Placas sin salida registrada**: Vehículos que permanecen más de 24 horas sin salida registrada deben ser señalados con un indicador de "estadía prolongada" para revisión del supervisor sin bloquear la operación general.
- **Operación concurrente en múltiples garitas**: Dos operadores en garitas distintas intentan asignar simultáneamente el último cupo libre restante para el restaurante. El sistema debe resolver el conflicto mediante asignación atómica / concurrencia optimista, notificando al segundo operador que el cupo acaba de ser tomado.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE permitir registrar ingresos vehiculares capturando placa patente, unidad de negocio de destino, tipo de espacio asignado y marca temporal.
- **FR-002**: El sistema DEBE permitir registrar salidas vehiculares identificando la placa y calculando el tiempo de permanencia transcurrido.
- **FR-003**: El sistema DEBE operar en modo Offline-First, permitiendo el registro ininterrumpido de ingresos y salidas sin conexión a internet y sincronizando automáticamente al restablecerse la red.
- **FR-004**: El sistema DEBE proveer un motor de priorización donde las unidades protegidas (Hotel) tengan reserva garantizada y no sean canibalizadas por la demanda rotativa de otras áreas.
- **FR-005**: El sistema DEBE permitir programar reservas y cupos garantizados para Eventos con fecha de inicio, fecha de fin y cantidad pactada de espacios.
- **FR-006**: El sistema DEBE calcular la disponibilidad remanente en tiempo real distribuyéndola dinámicamente entre las áreas comerciales (Restaurante, Gimnasio, General).
- **FR-007**: El sistema DEBE rechazar o alertar explícitamente cuando una unidad de negocio intente ingresar un vehículo que sobrepase su cupo disponible actual.
- **FR-008**: El sistema DEBE presentar un Dashboard interactivo con ocupación total, disponibilidad por unidad de negocio, porcentaje de uso y alertas visuales configurables (advertencia al 90%, crítica al 100%).
- **FR-009**: El sistema DEBE ser agnóstico respecto a la instalación, permitiendo crear y editar instalaciones, definir capacidad total y categorizar espacios (general, accesible, reservado).
- **FR-010**: El sistema DEBE permitir crear, editar y parametrizar unidades de negocio personalizables (nombre, nivel de prioridad, tipo de cupo garantizado o dinámico).
- **FR-011**: El sistema DEBE gestionar autenticación de usuarios y autorización mediante Roles (Administrador y Operador).
- **FR-012**: El sistema DEBE registrar una bitácora inmutable de auditoría para cada operación de ingreso, salida, ajuste de cupos y modificación de configuración.

### Key Entities

- **Instalación (Facility)**: Representa el recinto físico o complejo (nombre, dirección, capacidad total de espacios vehiculares, estado activo).
- **Categoría de Espacio (SpaceCategory)**: Clasificación de las plazas (Estándar, Accesible / Movilidad Reducida, VIP / Reservado).
- **Unidad de Negocio (BusinessUnit)**: Áreas del complejo (Hotel, Eventos, Restaurante, Gimnasio, etc.) con sus políticas de prioridad y tipo de cuota (garantizada vs. dinámica).
- **Evento (EventBooking)**: Reserva temporal ligada a una unidad de negocio con fecha/hora de inicio, fecha/hora de término, cantidad de cupos comprometidos y nombre del evento.
- **Registro Vehicular (ParkingSession)**: Sesión de estacionamiento de un vehículo (placa patente, unidad de negocio asignada, categoría de espacio, hora de entrada, hora de salida, estado: activo/finalizado, identificador del operador).
- **Cola de Sincronización (OutboxQueue)**: Registro local de mutaciones pendientes de envío a la nube con marca de tiempo, payload y estado de sincronización.
- **Registro de Auditoría (AuditLog)**: Bitácora de eventos relevantes del sistema (usuario, tipo de acción, entidad, valor anterior, nuevo valor, marca temporal).

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un operador puede registrar un ingreso o egreso vehicular en menos de 5 segundos totales desde que el vehículo se detiene frente a la garita.
- **SC-002**: El sistema garantiza 100% de operatividad en registro de entradas y salidas durante cortes de conectividad de red de hasta 8 horas continuas.
- **SC-003**: El proceso de sincronización al recuperar conectividad procesa y concilia lotes de hasta 200 transacciones locales en menos de 3 segundos sin pérdida de datos.
- **SC-004**: Cero sobreasignaciones (overbooking) accidentales para los cupos garantizados del Hotel o de Eventos contratados.
- **SC-005**: El Dashboard de ocupación actualiza sus indicadores visuales en menos de 500 milisegundos tras cada registro confirmado.
- **SC-006**: La aplicación puede configurarse para una nueva instalación completa (con sus categorías y unidades de negocio) en menos de 10 minutos por un administrador sin asistencia técnica.

---

## Assumptions

- Los operadores de garita utilizan dispositivos móviles o navegadores de escritorio modernos compatibles con PWA y soporte estándar de IndexedDB.
- La placa patente es el identificador primario del vehículo en el flujo de entrada y salida manual.
- Las tarifas o cobros monetarios (si aplicasen a futuro) quedan fuera del alcance del MVP actual; el MVP se enfoca estrictamente en el control de ocupación, prioridades y asignación de espacios.
- La sincronización asíncrona adopta una política de "última escritura válida con validación de estado lógico" (*last write wins* con verificación de integridad de estado).
