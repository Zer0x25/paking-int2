# Research: Gestión del ciclo de vida de unidades

## Hallazgos

- `FacilityConfigView` recibe `businessUnits` por props y el manejador actual de creación hace `businessUnits.push(...)`. No llama a una API y no cambia el estado React que posee el catálogo.
- `facilities.ts` mantiene áreas y reservas con operaciones HTTP; eventos ya usan JWT de administrador, registro de auditoría, versiones y cancelación lógica.
- `BusinessUnitSchema` no tiene todavía versión ni esquemas específicos de mutación. `quotaType` determina si la cuota base es garantizada, contractual o dinámica.
- El motor de admisión y el dashboard leen `defaultBusinessUnits` directamente; una unidad creada solo desde la vista no sería reconocida por la operación.
- Áreas exclusivas, reservas y sesiones guardan `businessUnitId`; borrar físicamente rompería las referencias.
- El API de catálogos se consume en la entrada vehicular, por lo que debe ofrecer únicamente unidades activas. Configuración necesita otro inventario autenticado que incluya inactivas.
- La configuración del proyecto persiste en memoria en desarrollo. El outbox IndexedDB existente está limitado a entradas y salidas vehiculares.

## Decisiones

1. Añadir un almacén mutable de unidades junto a los datos de asignación compartidos por API, admisión y dashboard.
2. Añadir endpoints administrativos para listar todo el historial, crear, editar con `version` y retirar con `version`.
3. Mantener unicidad de código por instalación incluso para unidades inactivas, para no reasignar una clave histórica.
4. Retirar lógicamente y rechazar el retiro si la unidad tiene sesión activa, área activa exclusiva o reserva todavía vigente.
5. Mantener los cambios de tipo de cuota y cupos base editables; los compromisos actuales se validan contra la capacidad de la instalación.
6. Registrar actor, instante, acción y estado antes/después para cada mutación.

## Alternativas descartadas

- Mutar el arreglo del padre: no dispara una actualización React ni persiste cambios.
- Borrar la unidad del arreglo: elimina la referencia legible por áreas, reservas y sesiones.
- Inactivar sin validar referencias vigentes: puede dejar fuera de los selectores a unidades necesarias por la operación actual.
- Guardar solo en el cliente: la admisión y el dashboard del Worker usarían catálogos distintos.
