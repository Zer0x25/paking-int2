# Feature Specification: Persistencia Central de la Aplicación

**Feature Branch**: `009-d1-persistence`
**Created**: 2026-10-17
**Status**: Approved
**Input**: User requested to continue with central database integration after confirming that the app should persist its data in D1.

## Clarifications

### Session 2026-10-17
- Q: ¿Cómo se deben cargar las cuentas de desarrollo al iniciar con la nueva persistencia? → A: Leer y validar las credenciales desde `.dev.vars` local, fuera de Git; persistir en D1 únicamente identidad y rol.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Mantener la configuración del recinto (Priority: P1)

Como administrador, quiero que la instalación, sus áreas, unidades de negocio y reservas permanezcan guardadas aunque se reinicie el servicio, para continuar operando sin volver a ingresar la configuración.

**Why this priority**: La configuración es la base para asignar vehículos y calcular disponibilidad. Perderla al reiniciar impide usar la aplicación como sistema operativo.

**Independent Test**: Crear y modificar registros de cada tipo de configuración, reiniciar el servicio y verificar que la lista y los datos recuperados coincidan con lo guardado.

**Acceptance Scenarios**:

1. **Given** un administrador autenticado, **When** crea o edita una instalación, área, unidad de negocio o reserva válida, **Then** el cambio queda disponible al volver a consultar después de reiniciar el servicio.
2. **Given** una configuración con reservas, capacidades y áreas vinculadas, **When** dos cambios concurrentes intentarían superar la capacidad o romper una relación, **Then** solo se conserva un estado que respeta las reglas de negocio y se informa el conflicto rechazado.
3. **Given** un recinto vacío en una instalación local nueva, **When** la aplicación prepara su configuración inicial de desarrollo, **Then** el catálogo base esperado queda disponible sin reemplazar datos que ya fueron guardados.

### User Story 2 - Conservar la operación de garita y el dashboard (Priority: P1)

Como operador o supervisor, quiero que las entradas, salidas, correcciones de patente y datos de auditoría permanezcan disponibles entre solicitudes y reinicios, para que la lista activa y los indicadores representen la operación real.

**Why this priority**: La continuidad de las sesiones es necesaria para no perder vehículos activos ni permitir ingresos duplicados tras reiniciar el servicio.

**Independent Test**: Registrar una entrada, reiniciar el servicio, confirmar que el vehículo aparece activo en Garita y Dashboard, corregir la patente, registrar la salida y confirmar el historial asociado.

**Acceptance Scenarios**:

1. **Given** un vehículo registrado dentro del recinto, **When** el servicio se reinicia, **Then** la sesión sigue apareciendo activa y participa en los cálculos de disponibilidad.
2. **Given** una entrada o salida confirmada, **When** un supervisor consulta la actividad, **Then** encuentra el cambio junto con el usuario responsable y su fecha y hora.
3. **Given** dos solicitudes simultáneas que afectarían el mismo cupo, **When** ambas intentan guardar, **Then** el sistema confirma únicamente los cambios permitidos por las reglas de capacidad y evita estados contradictorios.

### User Story 3 - Sincronizar operaciones offline sin duplicarlas (Priority: P1)

Como operador que puede perder conectividad, quiero que las operaciones encoladas localmente se sincronicen al recuperar la red y queden guardadas de forma durable, para continuar con la cola existente sin duplicar entradas, salidas o correcciones.

**Why this priority**: La garita debe seguir funcionando sin conexión. La base central debe recibir las mutaciones al reconectar sin cambiar el flujo offline-first ya utilizado.

**Independent Test**: Registrar una mutación sin conexión, reconectar y sincronizarla; repetir el mismo envío y comprobar que exista un solo efecto operativo y una sola auditoría correspondiente.

**Acceptance Scenarios**:

1. **Given** una operación guardada en la cola offline, **When** la sincronización se reintenta una o varias veces, **Then** la operación se aplica como máximo una vez.
2. **Given** una operación offline basada en una versión anterior a la guardada en el servidor, **When** se sincroniza, **Then** se aplica la regla de conflicto vigente y la respuesta permite al cliente resolver o informar el estado sin sobrescribir silenciosamente una versión más nueva.
3. **Given** una sesión local pendiente, **When** el servicio vuelve a estar disponible, **Then** la sincronización conserva el vínculo con su sesión, autoría y auditoría.

### User Story 4 - Iniciar sesión con usuarios persistidos de manera segura (Priority: P1)

Como administrador, quiero conservar en D1 la identidad y el rol de administradores y operadores, mientras sus credenciales locales permanecen en `.dev.vars`, para mantener el acceso y los permisos después de reiniciar el servicio.

**Why this priority**: Toda operación persistente requiere autenticación y autoría consistentes; el almacenamiento actual de cuentas de muestra en código no es apto para persistencia durable.

**Independent Test**: Inicializar un recinto local con las credenciales configuradas en `.dev.vars`, iniciar sesión con cada rol, reiniciar el servicio y verificar que los mismos accesos y restricciones sigan aplicando.

**Acceptance Scenarios**:

1. **Given** credenciales locales válidas configuradas en `.dev.vars`, **When** ocurre el primer ingreso después de aplicar el esquema local, **Then** D1 guarda cada identidad y su rol una sola vez, y el ingreso valida la contraseña contra la configuración local.
2. **Given** un registro de usuario persistido, **When** se revisan sus campos, **Then** contiene la identidad y el rol, pero no una contraseña ni un hash de contraseña.
3. **Given** una cuenta inexistente o una contraseña incorrecta, **When** intenta autenticarse, **Then** el acceso se rechaza y no se revela si el usuario existe.

### Edge Cases

- Una migración se ejecuta más de una vez o el servicio se interrumpe durante su preparación; al volver a iniciar, el esquema queda en un estado consistente.
- La base local está vacía; los datos iniciales se crean una sola vez. Si ya existen cambios de configuración, la inicialización no los reemplaza.
- Falta la conexión de almacenamiento o falla una escritura; la API informa un error y no confirma una operación como exitosa ni recurre a un almacén en memoria.
- Se envía dos veces la misma mutación offline o se reintenta tras perder la respuesta; solo se registra un efecto y su auditoría correspondiente.
- Se elimina, desactiva o modifica una entidad que ya está referenciada por sesiones o registros históricos; las reglas de negocio y las referencias históricas se conservan.
- Una transacción contiene una mutación y su auditoría; si cualquiera falla, ninguna parte debe quedar confirmada de forma aislada.
- Un usuario de operador intenta una acción reservada a administrador; el rol sigue restringiendo la operación después del cambio de persistencia.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE conservar categorías, instalaciones, áreas, unidades de negocio, reservas de eventos, sesiones de estacionamiento, usuarios y registros de auditoría después de que finalice o se reinicie el servicio.
- **FR-002**: El sistema DEBE permitir consultar y modificar esos registros mediante las operaciones existentes, manteniendo los contratos visibles para la interfaz y los roles de acceso actuales.
- **FR-003**: La configuración inicial de un entorno local DEBE crear los registros base necesarios solo cuando aún no exista configuración guardada, sin reemplazar datos posteriores.
- **FR-004**: Las reglas de capacidad del recinto y de sus áreas, cuotas, reservas concurrentes, ocupación y referencias históricas DEBEN validarse antes de confirmar una modificación.
- **FR-005**: Una entrada, salida, corrección de patente o modificación de configuración DEBE guardar su auditoría con el mismo usuario y fecha de la operación confirmada.
- **FR-006**: Las operaciones encoladas offline DEBEN sincronizarse en forma incremental y tolerar reintentos sin producir sesiones, cambios o auditorías duplicadas.
- **FR-007**: Si una operación offline entra en conflicto con una versión más reciente, el sistema DEBE aplicar la regla de concurrencia existente y comunicar el resultado al cliente sin sobrescritura silenciosa.
- **FR-008**: La autenticación local DEBE validar las contraseñas contra `.dev.vars`, conservar en D1 la identidad y el rol de administrador u operador, y no almacenar contraseñas ni hashes de contraseñas en D1.
- **FR-009**: La inicialización de usuarios de desarrollo y la firma de sesiones DEBEN obtener `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `OPERATOR_USERNAME`, `OPERATOR_PASSWORD` y `JWT_SECRET` desde `.dev.vars`, ignorado por Git; no deben existir credenciales ni secretos predeterminados en código versionado o controles visibles.
- **FR-010**: Los cambios confirmados deben ser visibles en Garita, Dashboard y Configuración a través de consultas posteriores, incluidos los reinicios del servicio.
- **FR-011**: El sistema DEBE aplicar los cambios que requieren atomicidad junto con sus registros de auditoría y relaciones; un fallo parcial no debe dejar un estado confirmado incoherente.
- **FR-012**: La aplicación DEBE informar fallos de persistencia y no reportar éxito si no se guardó el cambio; no debe recurrir silenciosamente al almacenamiento en memoria.
- **FR-013**: La inicialización local DEBE poder ejecutarse de forma reproducible sobre una base vacía y mantener el mismo resultado al repetirse.
- **FR-014**: Si falta una credencial o el secreto de firma en un entorno local, la autenticación DEBE fallar de forma segura y explicar cuál configuración falta sin devolver valores secretos.
- **FR-015**: Esta iteración DEBE limitarse a desarrollo local y verificación automatizada; no incluye crear o migrar una base productiva, cambiar credenciales productivas ni desplegar la aplicación.

### Key Entities

- **Instalación**: Recinto y capacidad total a la que pertenecen las áreas, unidades y reservas.
- **Área de estacionamiento**: Sector físico, su capacidad, régimen, estado y referencia a la instalación.
- **Unidad de negocio**: Unidad contractual u operativa, su cuota, estado y relación con el recinto.
- **Reserva de evento**: Cupos, período, estado e instalación y unidad responsables.
- **Sesión de estacionamiento**: Vehículo, entrada, salida, estado, versión, destino, área y autor de operación.
- **Usuario**: Identidad, rol e instalación vinculada; la contraseña local no forma parte del registro D1.
- **Registro de auditoría**: Usuario, acción, entidad afectada, detalle y fecha de cada cambio confirmado.
- **Mutación pendiente**: Operación offline identificada por el cliente, versión objetivo y estado de sincronización.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de las categorías, instalaciones, áreas, unidades, reservas y sesiones confirmadas continúan disponibles tras reiniciar el servicio.
- **SC-002**: El 100% de las operaciones de configuración y garita confirmadas cuentan con una auditoría vinculada al usuario y a la operación.
- **SC-003**: Reintentar una mutación offline ya aplicada produce cero sesiones, cambios o auditorías adicionales.
- **SC-004**: El 100% de los intentos de exceder capacidad o sobrescribir una versión vigente sin resolver el conflicto son rechazados antes de confirmar el cambio.
- **SC-005**: La autenticación conserva la identidad y las restricciones de ambos roles después de reiniciar el servicio; D1 no contiene contraseñas ni hashes.
- **SC-006**: Una instalación limpia de desarrollo puede inicializar el esquema y el catálogo base siguiendo los pasos documentados, sin depender de datos guardados en memoria.
- **SC-007**: Una falla al guardar se presenta al operador como error y deja sin confirmar tanto el cambio como su auditoría.

## Assumptions

- IndexedDB sigue siendo la persistencia local de la PWA y mantiene el outbox offline; esta feature sustituye únicamente los almacenes en memoria del backend.
- No existe una base central con datos de negocio que deban importarse. Los registros de muestra viven en el código del servidor y los datos de garita pendientes viven en IndexedDB del navegador.
- El catálogo de desarrollo actual se usa como punto de partida para la inicialización de una base local vacía.
- El usuario eligió `.dev.vars` como origen local no versionado para las credenciales de desarrollo y el secreto de firma; D1 guarda identidad y rol, y las contraseñas permanecen solo en `.dev.vars`.
- Los atajos visuales de acceso rápido no deben contener ni exponer contraseñas; se conservará la pantalla de ingreso normal.
- El despliegue productivo y cualquier base de datos real requieren una etapa y autorización explícitas posteriores.
