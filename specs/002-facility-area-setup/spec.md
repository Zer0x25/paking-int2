# Feature Specification: Construcción de Instalaciones, Gestión de Áreas y Asignación Dinámica de Capacidad

**Feature Branch**: `002-facility-area-setup`  
**Created**: 2026-10-15  
**Status**: Draft  
**Input**: Capacidad de construir la instalación, asignar la cantidad total de estacionamientos, crear las áreas de aparcamiento y definir la cantidad de plazas por área con capacidad de reajuste dinámico en caliente.

## Clarifications

<!-- Las aclaraciones identificadas en la fase inicial se formalizan aquí mediante $speckit-clarify -->

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

---

### Edge Cases

- **Suma de áreas menor a la capacidad total**: La suma de plazas de las áreas puede ser menor a la capacidad total de la instalación. Las plazas restantes se consideran "Plazas no asignadas / Reserva flotante general".
- **Intento de sobreasignación**: Si la suma de las capacidades asignadas a las áreas supera la capacidad total de la instalación, el sistema debe bloquear el guardado indicando el excedente exacto de plazas.
- **Cambio de capacidad durante ingreso simultáneo**: Si dos administradores o un proceso automatizado reajustan la capacidad de un área mientras ingresan vehículos, la persistencia atómica con control de concurrencia optimista (versioning) previene estados inconsistentes.
- **Operación offline de áreas**: Si se crean o reajustan áreas en modo offline en la terminal del administrador, las garitas locales operan con la última configuración cacheada en IndexedDB hasta que se sincronice el delta.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE permitir a los administradores crear, consultar, modificar y desactivar instalaciones físicas con nombre, dirección y capacidad total de plazas.
- **FR-002**: El sistema DEBE garantizar que la capacidad total de una instalación sea un número entero estrictamente positivo (> 0).
- **FR-003**: El sistema DEBE permitir la creación de múltiples áreas o sectores físicos asociados a una instalación, cada una con nombre, código alfanumérico único por recinto y estado activo.
- **FR-004**: El sistema DEBE permitir asignar y modificar dinámicamente la capacidad de plazas de cada área individual en tiempo de ejecución.
- **FR-005**: El sistema DEBE validar que la sumatoria de las capacidades de todas las áreas activas no sobrepase la capacidad total configurada en la instalación.
- **FR-006**: El sistema DEBE impedir que la capacidad de un área se reduzca por debajo del número de vehículos que se encuentran físicamente estacionados en ella en ese momento.
- **FR-007**: El sistema DEBE permitir asociar o vincular áreas a unidades de negocio específicas (ej. Área exclusiva Hotel) o dejarlas en modalidad de uso compartido multi-negocio.
- **FR-008**: El sistema DEBE permitir asociar cada sesión de estacionamiento (ingreso vehicular) a un área física específica de la instalación.
- **FR-009**: El sistema DEBE reflejar en el dashboard operativo la disponibilidad y porcentaje de ocupación en tiempo real por cada área física.
- **FR-010**: El sistema DEBE persistir las instalaciones y áreas en IndexedDB local con soporte offline-first y sincronización incremental hacia Cloudflare D1 en el backend.
- **FR-011**: El sistema DEBE registrar en la bitácora de auditoría todo cambio de capacidad de la instalación o de sus áreas, incluyendo usuario responsable y marca de tiempo.

### Key Entities *(include if feature involves data)*

- **Facility (Instalación)**:
  - `id`: Identificador único UUID.
  - `name`: Nombre del complejo o centro de convenciones.
  - `address`: Dirección física.
  - `totalCapacity`: Número total de plazas de estacionamiento físicas.
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

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Los administradores pueden registrar una nueva instalación y definir su capacidad total en menos de 30 segundos a través de la interfaz visual.
- **SC-002**: La creación y reajuste dinámico de capacidad de un área se propaga y refleja en los contadores operativos del cliente en menos de 200 ms.
- **SC-003**: El 100% de los intentos de sobreasignación (donde la suma de áreas supere la capacidad del recinto o la reducción sea inferior a los vehículos aparcados) son prevenidos y alertados claramente antes de persistir.
- **SC-004**: Los operadores en garita pueden visualizar y seleccionar el área física asignada en el flujo de ingreso en un solo clic adicional sin aumentar el tiempo total de registro por encima de 2 segundos.
- **SC-005**: La totalidad de operaciones de configuración de áreas e instalaciones opera fluidamente en modo offline con persistencia en IndexedDB y resolución de conflictos al reconectar.

---

## Assumptions

- Cada área pertenece exactamente a una instalación.
- La suma de capacidades de áreas no necesita ser exactamente igual al total; la diferencia representa plazas de reserva libre no sectorizadas.
- Se reutiliza la arquitectura existente de autenticación (roles Admin y Operador) y la infraestructura de sincronización offline con IndexedDB y Cloudflare Workers / D1.
