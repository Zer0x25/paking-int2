# Research: Operación unificada de Garita

## Decisiones resueltas

### Representación de patente

- **Decisión**: Aceptar seis caracteres alfanuméricos con o sin guiones, normalizar a mayúsculas y almacenar el valor compacto existente (`AA1A11`), presentando `AA-1A-11` en la interfaz.
- **Motivo**: Cumple el formato visual solicitado y conserva compatibilidad con las sesiones previas guardadas sin guiones en memoria local/API.
- **Validación**: El dominio y Zod aceptarán exactamente seis caracteres alfanuméricos después de retirar guiones de entrada. Los valores fuera de esa forma se rechazarán.

### Salida y corrección desde el listado

- **Decisión**: Identificar las acciones de fila por ID de sesión; la salida manual conserva la búsqueda por patente. Corregir la patente solo mientras la sesión está activa y con control de versión esperada.
- **Motivo**: Evita resolver la fila elegida por texto mutable y protege contra salidas concurrentes o cambios obsoletos.

### Compatibilidad offline

- **Decisión**: Reutilizar IndexedDB y outbox; una corrección offline actualiza la sesión local y encola una mutación explícita. La sincronización procesa la corrección junto a entradas y salidas.
- **Motivo**: La especificación constitucional exige que el flujo de garita siga funcionando sin conexión.

### Auditoría y permisos

- **Decisión**: Aplicar autenticación operativa existente a las rutas de sesiones y sincronización, y mantener auditoría de entrada, salida y corrección con usuario, acción, antes/después y fecha.
- **Motivo**: La Constitución requiere control RBAC y trazabilidad para cada operación de ingreso/salida; la corrección añade una mutación nueva.

## Alternativas consideradas

- **Persistir patentes con guiones**: descartada para no introducir dos representaciones distintas en datos IndexedDB previos; la interfaz presenta el formato solicitado.
- **Cerrar la sesión enviando solo la patente de fila**: descartada porque una acción selecciona una sesión concreta y su identidad/versionado debe llegar intacta al servidor.
- **Permitir editar sesiones completadas**: descartada de acuerdo con la aclaración del usuario; se conserva el historial cerrado.
- **Agregar una dependencia de tablas/UI**: descartada porque la aplicación ya usa estilos y componentes propios.
