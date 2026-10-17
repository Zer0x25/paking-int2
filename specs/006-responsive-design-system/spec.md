# Feature Specification: Sistema visual adaptable para Smart Parking

**Feature Branch**: `006-responsive-design-system`

**Created**: 2026-10-17

**Status**: Approved

**Input**: Crear un sistema de diseño para la aplicación con tema claro y oscuro, siguiendo la preferencia del sistema por defecto y permitiendo recordar el tema elegido. Adaptar Garita, Dashboard y Configuración para pantallas móviles desde 375 px.

## Clarifications

### Session 2026-10-17

- Q: ¿Cómo debe elegirse el tema al abrir la app? → A: Seguir la preferencia del sistema por defecto, permitir elegir Sistema/Claro/Oscuro y recordar la selección.
- Q: ¿Qué vistas cubrimos desde 375 px? → A: Garita, Dashboard y Configuración.

## User Scenarios & Testing

### User Story 1 - Elegir y conservar el tema visual (Priority: P1)

Una persona puede usar Smart Parking con un tema claro u oscuro. Al abrir la aplicación por primera vez se usa la preferencia del dispositivo; la persona puede elegir Sistema, Claro u Oscuro y la aplicación recuerda su decisión en ese navegador.

**Why this priority**: El tema debe ser legible en el entorno de trabajo y mantenerse consistente al cambiar entre las vistas operativas.

**Independent Test**: Abrir la aplicación con preferencias del sistema clara y oscura, cambiar el selector a cada opción y recargar para comprobar el color aplicado y la persistencia.

**Acceptance Scenarios**:

1. **Given** que no hay un tema elegido previamente, **When** se abre Smart Parking, **Then** la interfaz coincide con la preferencia actual del dispositivo.
2. **Given** cualquiera de las vistas principales, **When** la persona elige Claro u Oscuro, **Then** todas las vistas visibles actualizan su paleta sin recargar la página.
3. **Given** una opción explícita guardada, **When** la persona vuelve a abrir la aplicación, **Then** se mantiene esa opción aunque la preferencia del dispositivo sea distinta.
4. **Given** que la persona selecciona Sistema, **When** cambia la preferencia del dispositivo, **Then** la aplicación adopta el nuevo tema del dispositivo.

### User Story 2 - Operar las vistas principales desde un móvil (Priority: P1)

La persona operadora o administradora puede navegar y usar Garita, Dashboard y Configuración desde un teléfono con un ancho de pantalla de 375 px.

**Why this priority**: La operación debe poder continuar desde una pantalla móvil pequeña sin ocultar acciones ni obligar a desplazarse horizontalmente.

**Independent Test**: En un navegador móvil a 375 px, recorrer las tres vistas y comprobar navegación, lectura, controles, formularios, tarjetas, listas y acciones principales.

**Acceptance Scenarios**:

1. **Given** un dispositivo de 375 px de ancho, **When** se abre cualquiera de las tres vistas principales, **Then** no aparece desplazamiento horizontal de la página ni contenido esencial cortado.
2. **Given** Garita en pantalla móvil, **When** la persona registra una entrada, consulta un vehículo activo, corrige su patente o registra su salida, **Then** puede completar cada acción con controles visibles y utilizables.
3. **Given** Dashboard o Configuración en pantalla móvil, **When** la persona revisa indicadores o usa los formularios y listados existentes, **Then** el contenido fluye verticalmente y las acciones siguen disponibles.
4. **Given** un ancho de pantalla mayor, **When** la persona abre cualquiera de las vistas, **Then** conserva una composición apropiada para ese espacio sin perder información ni operaciones.

### User Story 3 - Reconocer un lenguaje visual común (Priority: P2)

Las personas reconocen una misma jerarquía de títulos, acciones, campos, superficies y estados en las pantallas de inicio de sesión, Garita, Dashboard y Configuración.

**Why this priority**: Una base visual compartida hace más clara la navegación y permite que nuevas pantallas sigan patrones conocidos.

**Independent Test**: Comparar elementos equivalentes en las pantallas y verificar que usan los mismos estilos semánticos y estados visuales en ambos temas.

**Acceptance Scenarios**:

1. **Given** componentes equivalentes en distintas vistas, **When** se comparan en el mismo tema, **Then** comparten jerarquía y estados visuales consistentes.
2. **Given** botones, campos, tarjetas o avisos en cualquiera de los temas, **When** están activos, enfocados, deshabilitados o muestran un error, **Then** cada estado es distinguible y legible.

### User Story 4 - Usar la interfaz con accesibilidad básica (Priority: P2)

La persona puede navegar y reconocer el control de tema y las operaciones visibles mediante teclado, lector de pantalla y controles táctiles.

**Why this priority**: Los controles y la información deben seguir siendo utilizables con diferentes formas de interacción y condiciones de visión.

**Independent Test**: Recorrer navegación, selector de tema, formularios y acciones principales con teclado y comprobar etiquetas, foco visible, contraste y tamaño táctil.

**Acceptance Scenarios**:

1. **Given** la interfaz en tema claro u oscuro, **When** se lee texto normal, texto grande, bordes informativos y estados de control, **Then** se mantiene el contraste definido para cada tipo.
2. **Given** navegación solo con teclado, **When** se recorre la aplicación y se abre el selector de tema, **Then** el foco permanece visible y cada opción se puede operar.
3. **Given** controles táctiles en un móvil, **When** la persona selecciona navegación, tema o acciones principales, **Then** los controles tienen un área de interacción de al menos 44 px por 44 px.

## Edge Cases

- La preferencia guardada está ausente, es inválida o no puede leerse; se usa el tema del dispositivo sin impedir que la aplicación cargue.
- La preferencia del dispositivo cambia mientras la aplicación está abierta y el usuario mantiene la opción Sistema.
- El usuario mantiene Claro u Oscuro aunque la preferencia del dispositivo cambie.
- Un nombre de instalación, etiqueta, patente o dato de Configuración es largo; se ajusta o envuelve sin ensanchar la página.
- El contenido del Dashboard o de las listas supera el alto de pantalla; se permite desplazamiento vertical y se mantienen accesibles navegación y acciones.
- Se reduce el ancho a 375 px y se aumenta el tamaño del texto del navegador; los controles principales siguen visibles y operables.

## Requirements

### Functional Requirements

- **FR-001**: La aplicación MUST seguir un sistema visual común que defina roles de color, tipografía, espaciado, superficies, bordes, radios, elevación y estados de interacción.
- **FR-002**: La aplicación MUST ofrecer los modos de apariencia Sistema, Claro y Oscuro.
- **FR-003**: Si la persona no ha elegido un tema explícito, la aplicación MUST usar la preferencia actual del dispositivo.
- **FR-004**: La aplicación MUST recordar en el navegador la opción explícita Sistema, Claro u Oscuro y aplicarla en las visitas siguientes.
- **FR-005**: El cambio de tema MUST actualizar la interfaz visible sin recargarla y MUST aplicarse de forma coherente a inicio de sesión, Garita, Dashboard y Configuración.
- **FR-006**: La primera vista MUST mostrar el tema efectivo guardado o del dispositivo antes de exponer controles para evitar un destello evidente de la paleta incorrecta.
- **FR-007**: Garita, Dashboard y Configuración MUST poder usarse a un ancho de pantalla de 375 px sin desbordamiento horizontal de la página.
- **FR-008**: En 375 px, la navegación, los formularios, indicadores, listas y acciones principales MUST adaptarse al espacio disponible y permanecer visibles, legibles y operables.
- **FR-009**: Las vistas MUST conservar toda la información y acciones disponibles en escritorio; el diseño podrá cambiar su distribución para acomodar pantallas pequeñas.
- **FR-010**: Los elementos táctiles de navegación, selección de tema y acciones principales MUST ofrecer un área de interacción mínima de 44 px por 44 px.
- **FR-011**: El texto normal MUST alcanzar una relación de contraste mínima de 4.5:1; texto grande y elementos gráficos necesarios para identificar controles MUST alcanzar 3:1.
- **FR-012**: Todos los controles principales MUST tener nombre accesible, interacción por teclado y un indicador de foco visible en ambos temas.
- **FR-013**: La interfaz MUST respetar la preferencia de movimiento reducido del dispositivo.
- **FR-014**: La actualización visual MUST conservar los flujos, permisos y resultados de negocio existentes.

### Key Entities

- **Preferencia de apariencia**: Opción Sistema, Claro u Oscuro seleccionada para el navegador y usada para decidir la paleta visible.
- **Rol visual**: Nombre semántico compartido para una propiedad visual como fondo, superficie, texto, énfasis, estado o foco.
- **Patrón de interfaz**: Presentación recurrente de navegación, formulario, tarjeta, indicador, lista, aviso o acción.

## Success Criteria

### Measurable Outcomes

- **SC-001**: En cada una de las cuatro superficies indicadas, el tema inicial coincide con la preferencia del dispositivo cuando no existe una opción explícita.
- **SC-002**: Una opción explícita de tema persiste en el 100% de las recargas y visitas posteriores del mismo navegador, y el cambio entre temas se refleja sin recarga.
- **SC-003**: Las tres vistas principales se pueden recorrer a 375 px sin desplazamiento horizontal de página ni acciones principales cortadas.
- **SC-004**: En 375 px, una persona completa los flujos existentes de entrada y salida de Garita, consulta Dashboard y navega las secciones de Configuración.
- **SC-005**: Los textos y controles cumplen los mínimos de contraste definidos para ambos temas.
- **SC-006**: Los controles principales se pueden completar con teclado y tienen foco visible y área táctil de al menos 44 px por 44 px.
- **SC-007**: Las vistas principales conservan sus acciones y contenido en tamaños de escritorio ya soportados.

## Assumptions

- La opción inicial es Sistema; las elecciones Claro u Oscuro se conservan solo en el navegador actual, sin sincronizarse entre usuarios o instalaciones.
- La capacidad responsive de 375 px cubre Garita, Dashboard y Configuración; el modo de tema también se aplica a la pantalla de inicio de sesión y al marco común de navegación.
- Se conserva el acento morado de la marca y los nombres o iconos actuales siempre que tengan contraste suficiente en ambos temas.
- El cambio de sistema visual no modifica lógica de negocio, estructura de permisos, persistencia operativa ni formato de los datos.
- La página permite desplazamiento vertical en móviles; el requisito prohíbe el desplazamiento horizontal causado por el diseño.
