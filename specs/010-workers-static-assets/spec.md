# Feature Specification: Publicación de la PWA con Workers Static Assets

**Feature Branch**: `010-workers-static-assets`
**Created**: 2026-10-17
**Status**: Approved
**Input**: El usuario confirmó que quiere actualizar la base de la aplicación para migrar del mecanismo heredado Workers Sites a Workers Static Assets y poder validar la aplicación localmente antes del despliegue a Cloudflare. Después autorizó corregir los iconos PWA que el manifiesto y el HTML referenciaban, pero no existían.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Probar la aplicación completa con Wrangler local (Priority: P1)

Como desarrollador, quiero abrir la aplicación y su API desde el Worker local, para comprobar que la interfaz y el backend funcionan juntos antes de publicar.

**Why this priority**: El entorno local debe descubrir errores de entrega de archivos y rutas antes de afectar una instalación real.

**Independent Test**: Compilar la interfaz, iniciar el Worker local y consultar la ruta principal, una ruta interna de la SPA, un archivo generado y una ruta de API.

**Acceptance Scenarios**:

1. **Given** una compilación reciente y el Worker local iniciado, **When** el desarrollador abre `/`, **Then** recibe la aplicación con estado 200 y tipo de contenido HTML.
2. **Given** una ruta interna válida de la SPA, **When** el navegador navega directamente a esa ruta, **Then** recibe la aplicación y puede resolver la ruta en el cliente.
3. **Given** un archivo presente en la compilación, **When** se solicita su URL, **Then** se entregan sus bytes y su tipo de contenido correspondiente.
4. **Given** la API del Worker disponible, **When** la interfaz solicita `/api/health`, **Then** recibe la respuesta JSON del servicio en el mismo origen.

### User Story 2 - Mantener una separación clara entre archivos y API (Priority: P1)

Como operador y administrador, quiero que las rutas de la aplicación y de la API conserven su comportamiento actual, para continuar usando Garita, Dashboard y Configuración después de cambiar el mecanismo de publicación.

**Why this priority**: La migración de hosting no debe cambiar las operaciones ni convertir respuestas de API en documentos HTML.

**Independent Test**: Consultar una ruta de salud, una ruta API inexistente y una ruta de navegación de la SPA en el mismo origen; verificar que cada respuesta conserva el tipo y estado que le corresponde.

**Acceptance Scenarios**:

1. **Given** una petición de navegación a una ruta desconocida de la SPA, **When** el navegador la abre, **Then** recibe el punto de entrada de la aplicación para que el router cliente gestione la ruta.
2. **Given** una petición a una ruta API inexistente bajo `/api/`, **When** el Worker la procesa, **Then** se mantiene como respuesta de API no encontrada y no devuelve el punto de entrada HTML de la SPA.
3. **Given** el servidor Vite de desarrollo en uso, **When** el desarrollador inicia la interfaz con recarga en caliente, **Then** el flujo de desarrollo actual y el proxy API hacia el Worker en 8787 siguen disponibles.

### User Story 3 - Entregar los iconos configurados de la PWA (Priority: P1)

Como usuario, quiero que la aplicación entregue los iconos que anuncia el navegador y el manifiesto, para reconocerla y poder instalarla en el dispositivo.

**Why this priority**: Una referencia a un icono inexistente provoca errores de carga y deja incompleta la experiencia de instalación.

**Independent Test**: Compilar la PWA y solicitar cada icono que usa el HTML, el manifiesto y la configuración PWA; verificar estado 200, tipo de contenido y dimensiones esperadas.

**Acceptance Scenarios**:

1. **Given** la compilación actual de la aplicación, **When** el navegador solicita el favicon SVG, **Then** recibe el icono válido con tipo `image/svg+xml`.
2. **Given** el manifiesto PWA, **When** el navegador solicita los iconos de 192×192 y 512×512, **Then** recibe PNG válidos con sus dimensiones declaradas.
3. **Given** los recursos adicionales enumerados por la configuración PWA, **When** se solicitan el favicon ICO, el icono Apple Touch y la máscara SVG, **Then** cada recurso existe y se sirve con el tipo correspondiente.
4. **Given** una referencia de icono configurada que no tiene archivo fuente, **When** se ejecuta la prueba de contrato, **Then** la prueba falla antes de empaquetar o desplegar una PWA incompleta.

### Edge Cases

- La compilación no contiene el archivo de entrada de la SPA; el inicio o la verificación local debe mostrar un error claro en vez de aparentar éxito.
- Una ruta de archivo estático inexistente que no sea navegación no debe devolverse como contenido HTML de la SPA.
- Una ruta `/api/*` devuelve error o 404; el tipo de contenido y el estado deben corresponder a la API.
- Un archivo estático existe, pero falla su entrega; el error no debe transformarse en una respuesta exitosa de la SPA.
- Un recurso de icono configurado en el HTML, manifiesto o lista de precarga no existe o tiene formato/dimensiones incorrectos.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE poder servir la interfaz compilada y las rutas de API desde el mismo origen local y desplegado.
- **FR-002**: Una navegación de navegador a una ruta de la SPA que no coincida con un archivo DEBE recibir el punto de entrada de la aplicación.
- **FR-003**: Las solicitudes a `/api/*` DEBEN seguir siendo procesadas por el Worker y no deben recibir el punto de entrada HTML como respuesta de respaldo.
- **FR-004**: Los archivos presentes en la compilación DEBEN entregarse con su contenido y tipo de contenido correspondiente.
- **FR-005**: Las rutas API actuales, incluida `/api/health`, DEBEN conservar su comportamiento y formato de respuesta.
- **FR-006**: El flujo de desarrollo Vite con recarga en caliente y el proxy local hacia el Worker en 8787 DEBEN seguir disponibles.
- **FR-007**: El flujo local de Wrangler DEBE permitir comprobar la entrega integrada de la interfaz y la API usando una compilación reciente.
- **FR-008**: La preparación de un despliegue DEBE incluir la versión actual compilada de la interfaz junto con el Worker.
- **FR-009**: La entrega de archivos estáticos y el respaldo de navegación DEBEN evitar invocar la lógica dinámica del Worker cuando no sea necesaria.
- **FR-010**: La migración DEBE conservar D1, los contratos de API, las reglas de negocio, la autenticación y las operaciones de datos existentes.
- **FR-011**: Esta iteración DEBE limitarse a la configuración, empaquetado y validación local; no incluye crear recursos remotos, migrar datos productivos ni desplegar en Cloudflare.
- **FR-012**: Todo icono referenciado por el HTML, el manifiesto PWA o la lista de recursos adicionales DEBE existir en los fuentes y en la compilación, y DEBE coincidir con su formato y dimensiones declarados.

### Key Entities

No se agregan entidades ni datos de negocio. La compilación estática y las rutas del Worker representan artefactos de entrega existentes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de las navegaciones probadas a `/` y a rutas internas de la SPA devuelve el punto de entrada con estado 200 y contenido HTML.
- **SC-002**: `/api/health` devuelve JSON desde el Worker y una ruta `/api/*` inexistente no devuelve el HTML de la SPA.
- **SC-003**: El 100% de los archivos seleccionados de la compilación se entrega con bytes y tipo de contenido coincidentes con el artefacto generado.
- **SC-004**: Una compilación y un inicio local de Wrangler completan la validación de interfaz, API y rutas internas desde un solo origen.
- **SC-005**: El servidor Vite conserva su inicio habitual y el proxy API al puerto 8787.
- **SC-006**: La configuración ya no depende de Workers Sites ni de la entrega de archivos a través de KV.
- **SC-007**: Ninguna base de datos, variable secreta ni recurso remoto se crea o modifica durante la validación de esta feature.
- **SC-008**: El 100% de los iconos configurados para navegador, PWA e instalación devuelve estado 200, formato válido y dimensiones esperadas desde el Worker local.

## Assumptions

- La aplicación usa Vite y React como SPA y genera sus archivos finales en `dist/`.
- Las rutas dinámicas de la API están bajo `/api/*` y las atiende Hono en el Worker actual.
- El servidor Vite de desarrollo permanece disponible para recarga en caliente; la validación integrada de Workers Static Assets usa los artefactos compilados con Wrangler local.
- D1, `.dev.vars`, la autenticación y el almacenamiento local no forman parte de esta migración.
- La fecha de compatibilidad actual se mantiene y la opción de enrutamiento para la SPA se habilita de forma explícita para evitar cambios de compatibilidad no relacionados.
- La disponibilidad de Workers Static Assets no autoriza por sí sola un despliegue remoto en esta iteración.
- Los iconos conservan la identidad visual de Smart Parking y se generan desde recursos fuente del repositorio, sin añadir dependencias de ejecución.
