# ADR-020: Bootstrap y baja lógica del recinto

- **Estado**: Aceptado
- **Fecha**: 2026-10-18
- **Feature**: [002-facility-area-setup](../../specs/002-facility-area-setup/spec.md)

## Contexto

El login crea una identidad D1 sin `facility_id` cuando aún no existe un recinto. El middleware actualmente exige esa asignación para toda ruta de datos, por lo que el primer recinto no se puede crear desde la interfaz. La pantalla de configuración también asume que ya existe un recinto. Además, no existe una operación de retiro que preserve auditoría y referencias históricas.

## Decisión

- Permitir que un administrador autenticado sin recinto complete únicamente el bootstrap inicial.
- Persistir la creación del recinto y su asignación a la identidad de forma atómica en D1; responder con un JWT firmado que incluya el `facilityId` recién asignado para mantener la sesión sin un segundo login.
- Mantener la edición de nombre, dirección y capacidad con la validación y auditoría actuales.
- Implementar “eliminar recinto” como desactivación lógica confirmada. Bloquearla si existen sesiones vehiculares activas; conservar registros y auditoría, y excluir el recinto de lecturas y escrituras operativas.
- Tras la baja, la interfaz cierra la sesión local. Un nuevo login no debe re-asignar automáticamente el recinto desactivado.

## Alternativas consideradas

### Eliminar físicamente el recinto

Rechazada porque eliminaría la entidad a la que apuntan las sesiones, reservas y auditoría, además de dificultar la investigación de operaciones históricas.

### Crear el recinto y pedir al administrador iniciar sesión otra vez

Rechazada porque deja una brecha innecesaria entre el alta y la operación y genera confusión en el primer uso. El JWT se puede reemitir tras confirmar la asignación en D1.

### Permitir operaciones con identidad sin recinto

Rechazada porque expondría rutas multi-tenant sin un ámbito de datos. La excepción queda limitada al `POST /api/facilities` autenticado como administrador.

## Consecuencias

- D1 requiere una migración aditiva para marcar recintos activos/inactivos.
- El flujo inicial debe estar conectado a D1; la operación offline empieza después de crear el recinto.
- Las lecturas por recinto excluyen inactivos y la lista de sesiones activas filtra el estado del recinto.
- La baja conserva historial, pero no incluye restauración desde la interfaz en esta iteración.
