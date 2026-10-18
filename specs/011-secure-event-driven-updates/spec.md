# Feature Specification: Acceso protegido y actualizaciones por cambio

**Feature Branch**: `011-secure-event-driven-updates`

**Created**: 2026-10-17

**Status**: Approved

**Input**: User requested protecting data routes and replacing frequent polling with updates triggered by changes, scoped to the authenticated user and active view.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Consultar solo datos autorizados (Priority: P1)

Como administrador u operador autenticado, quiero que las consultas y cambios del recinto requieran mi sesión y respeten mi rol y recinto, para proteger la operación y sus datos.

**Why this priority**: Publicar rutas de datos o permitir cambiar el recinto solicitado puede exponer la operación y habilitar cambios no autorizados.

**Independent Test**: Solicitar datos sin sesión, con una sesión válida del recinto asignado y con una sesión perteneciente a otro recinto; intentar además una modificación administrativa usando la cuenta de operador.

**Acceptance Scenarios**:

1. **Given** una solicitud de datos sin una sesión válida, **When** consulta cualquier ruta de datos, **Then** recibe una respuesta de acceso no autorizado y no obtiene datos.
2. **Given** un usuario autenticado para un recinto, **When** consulta su recinto, **Then** obtiene los datos permitidos para su rol.
3. **Given** un usuario autenticado para un recinto, **When** solicita datos o intenta operar sobre otro recinto, **Then** la solicitud es rechazada sin revelar datos de ese recinto.
4. **Given** una cuenta de operador, **When** intenta modificar instalaciones o configuración reservadas al administrador, **Then** recibe una respuesta de permisos insuficientes y no se guarda ningún cambio.
5. **Given** una solicitud de salud o inicio de sesión, **When** se consulta sin una sesión existente, **Then** el servicio mantiene disponibles únicamente esas rutas públicas.
6. **Given** una sesión cerrada, expirada o perteneciente a otro recinto, **When** el equipo está desconectado, **Then** no recibe datos privados desde una respuesta en caché de otra sesión o recinto.

### User Story 2 - Consultar los datos de la vista abierta (Priority: P1)

Como usuario autenticado, quiero que la aplicación solicite los datos necesarios para la vista que estoy usando, para evitar consultas de Dashboard y Configuración mientras opero en otra pantalla.

**Why this priority**: La aplicación debe disminuir solicitudes innecesarias y limitar cada consulta al contexto operativo visible.

**Independent Test**: Iniciar sesión, navegar por Garita, Dashboard y Configuración, y observar qué consultas se realizan al entrar, permanecer y cambiar de vista.

**Acceptance Scenarios**:

1. **Given** una persona sin sesión, **When** abre la aplicación, **Then** no se solicitan catálogos ni datos operacionales.
2. **Given** un usuario en Garita, **When** abre o mantiene esa vista, **Then** se cargan catálogos y vehículos activos, sin consultar métricas de Dashboard ni datos exclusivos de Configuración.
3. **Given** un usuario en Dashboard, **When** abre esa vista, **Then** se consultan sus métricas y no se mantienen consultas de vistas ocultas.
4. **Given** un administrador en Configuración, **When** abre esa vista, **Then** se consultan los datos de configuración requeridos por esa pantalla; al salir, no se siguen consultando.
5. **Given** un usuario autenticado que vuelve a abrir la aplicación sin conexión, **When** consulta el mismo recinto asignado, **Then** puede usar los catálogos locales disponibles; otro recinto no puede recuperar esos datos.

### User Story 3 - Recibir cambios de otros equipos (Priority: P1)

Como usuario autenticado, quiero que los cambios confirmados por otro equipo del mismo recinto actualicen mi vista activa, para trabajar con el estado vigente sin refrescos repetidos.

**Why this priority**: La Garita y el Dashboard pueden estar abiertos en equipos distintos; una actualización local solamente dejaría a otros operadores viendo datos desactualizados.

**Independent Test**: Abrir dos sesiones autorizadas del mismo recinto, confirmar una operación en una y comprobar que la vista activa de la otra refleja el estado confirmado; repetir desde una vista diferente.

**Acceptance Scenarios**:

1. **Given** dos equipos autenticados en el mismo recinto y conectados, **When** uno confirma un cambio, **Then** el otro recibe una notificación sin incluir datos personales u operacionales y refresca solo su vista activa.
2. **Given** un cambio confirmado en otro recinto, **When** una sesión está abierta, **Then** no recibe ni consulta datos de ese recinto.
3. **Given** un equipo desconectado o que se reconecta, **When** recupera conectividad, **Then** actualiza la vista activa para recuperar cambios perdidos.
4. **Given** una operación que aún está en la cola offline, **When** no ha sido sincronizada, **Then** permanece disponible localmente y no se presenta como cambio confirmado en otros equipos; al sincronizarse, notifica a los demás.

### Edge Cases

- El token caduca mientras la aplicación está abierta; las consultas se rechazan y la aplicación vuelve al inicio de sesión sin conservar una vista autenticada.
- Una conexión de notificaciones se interrumpe o cierra mientras otra persona confirma un cambio; la siguiente reconexión actualiza la vista activa.
- Un evento repetido, retrasado o recibido durante una consulta en curso no debe crear registros ni ejecutar cambios; solo solicita una lectura vigente de la vista abierta.
- Una notificación llega mientras una vista está oculta; no debe disparar consultas de esa vista hasta que el usuario la active.
- Un usuario operador intenta consultar o modificar una configuración exclusiva de administrador.
- Un usuario intenta consultar un recinto cuyo identificador no coincide con su sesión.
- Una respuesta de datos del recinto anterior permanece en la caché del navegador al cerrar sesión o al cambiar de recinto.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Todas las rutas de datos DEBEN requerir una sesión válida, salvo las rutas públicas de salud e inicio de sesión.
- **FR-002**: El sistema DEBE rechazar solicitudes de un usuario que apunten a un recinto distinto del asociado a su sesión.
- **FR-003**: Las operaciones de creación y modificación de instalaciones y configuración DEBEN requerir el rol administrador; las operaciones de Garita disponibles para el operador DEBEN conservar sus permisos actuales.
- **FR-004**: Una sesión ausente, inválida o expirada DEBE impedir la consulta o modificación de datos.
- **FR-005**: El sistema NO DEBE solicitar catálogos, Dashboard, configuración ni sesiones operacionales antes de autenticar al usuario.
- **FR-006**: La aplicación DEBE consultar únicamente los datos requeridos por la vista activa; cambiar de vista DEBE iniciar la lectura necesaria de esa vista y detener las lecturas periódicas de las vistas que queden ocultas.
- **FR-007**: El sistema NO DEBE mantener sondeos periódicos para actualizar Dashboard o vehículos activos.
- **FR-008**: Cada cambio persistido con éxito DEBE notificar a las sesiones autenticadas del mismo recinto para que actualicen la vista activa.
- **FR-009**: Las notificaciones DEBEN indicar que los datos cambiaron sin incluir patentes, credenciales, datos de usuario ni el contenido del registro modificado.
- **FR-010**: Una conexión restablecida después de una interrupción DEBE actualizar la vista activa para recuperar cambios no recibidos durante la desconexión.
- **FR-011**: Los cambios pendientes en el almacenamiento local DEBEN seguir disponibles sin conexión y solo notificar a otros equipos después de sincronizarse correctamente.
- **FR-012**: Los errores de autenticación, alcance de recinto o permisos DEBEN impedir la lectura o escritura y comunicarse con un mensaje claro de acceso rechazado.
- **FR-013**: El servicio NO DEBE cachear respuestas de API ni reutilizarlas entre sesiones o recintos; los datos locales para operación sin conexión DEBEN quedar asociados al recinto autorizado y mostrarse solo después de autenticar.

### Key Entities

- **Sesión autenticada**: Identidad, rol, recinto autorizado y vigencia de acceso.
- **Vista activa**: Sección visible de Garita, Dashboard o Configuración que determina qué datos se vuelven a consultar.
- **Notificación de cambio**: Aviso sin datos operacionales que señala que una fuente del recinto cambió.
- **Cambio confirmado**: Modificación persistida o sincronizada que puede ser consultada por otros equipos.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de las solicitudes anónimas a rutas de datos se rechaza; salud e inicio de sesión permanecen disponibles.
- **SC-002**: El 100% de las solicitudes a otro recinto y de las modificaciones administrativas realizadas por operadores se rechaza sin alterar datos.
- **SC-003**: Mientras la persona está desconectada de la sesión, se realizan cero consultas de catálogos, Garita, Dashboard o Configuración.
- **SC-004**: Mientras una vista está abierta, se realizan cero consultas periódicas de datos motivadas solo por el paso del tiempo.
- **SC-005**: Con dos equipos conectados, una vista activa refleja un cambio confirmado en otro equipo en un máximo de 2 segundos en al menos 95 de 100 cambios de la verificación local.
- **SC-006**: Tras recuperar conectividad, la vista activa muestra los cambios confirmados durante la desconexión dentro de 3 segundos.
- **SC-007**: Las notificaciones no contienen patentes, tokens, credenciales ni contenido de los registros modificados.
- **SC-008**: El 100% de las consultas privadas permanece inaccesible después de cerrar sesión, usar una sesión expirada o cambiar a un usuario de otro recinto, incluso sin conexión.

## Assumptions

- La identidad persistida en D1 sigue asociada a un único recinto para este flujo.
- El servidor continúa siendo la fuente de verdad para los cambios sincronizados; el trabajo pendiente sin conexión permanece disponible localmente.
- El refresco inmediato entre equipos requiere una conexión de notificación autenticada; al recibir un aviso, cada cliente solicita los datos vigentes mediante las consultas protegidas.
- Si un cliente pierde conectividad, los cambios se recuperan al reconectar o al volver a una vista activa; no se garantiza notificación mientras el equipo está desconectado.
- Esta funcionalidad prepara una arquitectura compatible con el objetivo de despliegue elegido, pero no incluye crear recursos remotos, aplicar migraciones productivas ni desplegar.
