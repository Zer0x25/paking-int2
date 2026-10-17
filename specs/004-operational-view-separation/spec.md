# Feature Specification: Separación de Garita Operativa y Dashboard

**Feature Branch**: `004-operational-view-separation`

**Created**: 2026-10-17

**Status**: Approved

**Input**: User description: "Garita Operativa repite las fichas del Dashboard; separar las vistas para que Garita se concentre en la operación y Dashboard conserve los indicadores, sin duplicarlos."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Operar la garita sin paneles duplicados (Priority: P1)

Como operador de estacionamiento, quiero que Garita Operativa muestre los flujos de entrada y salida sin las tarjetas de resumen que ya ofrece Dashboard, para completar las operaciones en una vista clara y enfocada.

**Why this priority**: La duplicación actual alarga la vista operativa y mezcla acciones de acceso con monitoreo. Separar el contenido permite que cada vista tenga una finalidad clara.

**Independent Test**: Abrir Garita Operativa y comprobar que se pueden registrar entradas y salidas sin que aparezcan las fichas de resumen, ocupación por área o asignación por unidad de negocio. Abrir Dashboard y comprobar que sus indicadores siguen visibles.

**Acceptance Scenarios**:

1. **Given** una persona autenticada en Garita Operativa, **When** consulta la vista, **Then** ve las acciones para registrar entrada y salida y no ve las fichas ni secciones de monitoreo de Dashboard.
2. **Given** una persona en Garita Operativa, **When** cambia a Dashboard, **Then** ve las fichas de ocupación, vehículos adentro, disponibilidad, reserva flotante, distribución por áreas y asignación por unidad de negocio, sin los formularios de entrada y salida.
3. **Given** una entrada o salida registrada correctamente, **When** la persona consulta Dashboard, **Then** los indicadores reflejan la operación conforme al refresco actual del sistema y Garita Operativa sigue sin duplicar las fichas.
4. **Given** los indicadores están cargando o temporalmente no disponibles, **When** la persona está en Garita Operativa, **Then** los estados de carga o error de Dashboard no desplazan ni reemplazan los formularios operativos.

### Edge Cases

- El indicador global de conexión y sincronización puede seguir visible como estado compartido, porque no es una ficha de resumen del Dashboard.
- La vista Configuración conserva su acceso y su contenido actual según el rol; esta separación solo cambia el contenido de Garita Operativa y Dashboard.
- Si falla la carga de indicadores, Dashboard mantiene su estado de carga o indisponibilidad sin insertar un panel en Garita Operativa.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Garita Operativa DEBE mostrar los flujos para registrar entrada y salida de vehículos y NO DEBE mostrar las fichas ni secciones de monitoreo de Dashboard.
- **FR-002**: Dashboard DEBE conservar los indicadores globales, el desglose de ocupación por áreas físicas y la asignación por unidad de negocio, sin mostrar los formularios de entrada y salida.
- **FR-003**: Registrar una entrada o salida DEBE seguir actualizando los mismos indicadores de Dashboard con el comportamiento de refresco vigente.
- **FR-004**: La separación visual NO DEBE cambiar las reglas de estacionamiento, los permisos por rol, el estado de conexión/sincronización compartido ni la navegación existente.

### Key Entities *(include if feature involves data)*

- No se introducen ni modifican entidades de negocio; las dos vistas presentan información y acciones ya existentes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: En Garita Operativa, el número de fichas y secciones de monitoreo pertenecientes a Dashboard es cero.
- **SC-002**: Dashboard conserva el 100% de sus fichas e indicadores actuales, incluyendo ocupación global, sesiones activas, disponibilidad, reserva flotante, áreas y unidades de negocio.
- **SC-003**: Los flujos de entrada y salida siguen disponibles en Garita Operativa y no aparecen en Dashboard.
- **SC-004**: La información y el resultado de las operaciones se conservan al cambiar entre ambas vistas.

## Assumptions

- "Fichas" se refiere a las tarjetas de indicadores y a los paneles de desglose que actualmente muestra Monitoreo de Ocupación en Vivo.
- El estado de conexión y sincronización es transversal a la aplicación y permanece visible fuera de las fichas de Dashboard.
- La vista Dashboard conserva su contenido y presentación actual; esta solicitud solo elimina la duplicación desde Garita Operativa.
