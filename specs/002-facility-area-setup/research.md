# Research & Architectural Decisions: Construcción de Instalaciones, Áreas y Asignación Dinámica

**Feature**: `002-facility-area-setup`  
**Date**: 2026-10-15  
**Status**: Approved  

---

## 1. Decisiones de Modelado y Representación

### Decisión 1: Representación de Plazas por Área (Capacidad Agregada vs. Espacios Individuales)
- **Decisión**: Modelar las plazas de estacionamiento dentro de cada área como **capacidad numérica agregada** (`allocatedCapacity: number`), con contadores dinámicos calculados en tiempo real a partir de las sesiones activas (`activeOccupancy`).
- **Racional**:
  - Evita el sobrecosto de generar, almacenar y sincronizar cientos o miles de registros individuales de plazas en bases de datos distribuidas (Cloudflare D1 / IndexedDB).
  - Permite un ajuste dinámico inmediato de cuotas simplemente modificando un número entero, sin tener que insertar o borrar filas de plazas físicas.
  - Satisface plenamente el modelo de negocio de recintos multi-negocio donde lo crítico es el control de aforo por sector y cuotas garantizadas por unidad.
- **Alternativas Evaluadas**:
  - *Plazas individuales numeradas (Spot A-01, Spot A-02)*: Descartada para este feature porque agrega overhead innecesario y ralentiza las operaciones de reasignación masiva dinámica.

### Decisión 2: Vinculación Flexible entre Áreas Físicas y Unidades de Negocio
- **Decisión**: Permitir un **modelo flexible y desacoplado**:
  - Un área física puede ser de **uso compartido general** (`businessUnitId: null`), admitiendo vehículos de cualquier unidad de negocio sujeta a las reglas del motor de prioridades.
  - Un área física puede tener asignación **exclusiva** a una unidad de negocio (`businessUnitId: string`), restringiendo el acceso exclusivamente a dicha unidad (ej. "Sector VIP Hotel").
- **Racional**:
  - Proporciona máxima versatilidad a los complejos multi-negocio (hoteles con salones de eventos y restaurantes), permitiendo destinar un piso entero al hotel si es necesario o manejar sectores abiertos compartidos.
- **Alternativas Evaluadas**:
  - *Acoplamiento estricto 1 a 1*: Obligaría a crear tantas áreas físicas como unidades de negocio existan, limitando la flexibilidad física de los recintos.

### Decisión 3: Regla de Balance de Capacidad y Reserva Flotante (Buffer General)
- **Decisión**:
  - La sumatoria de las capacidades asignadas a las áreas activas debe ser **menor o igual** a la capacidad total de la instalación ($\sum \text{allocatedCapacity} \le \text{totalCapacity}$).
  - Las plazas no asignadas a un área específica ($\text{totalCapacity} - \sum \text{allocatedCapacity}$) se identifican y reportan en el sistema como **"Reserva Flotante / Buffer General"**.
  - Si un administrador intenta asignar una capacidad a un área que haga que la sumatoria supere la capacidad total, la operación es **bloqueada inmediatamente** con error de validación.
- **Racional**:
  - Protege la integridad física del recinto, impidiendo la sobreventa ficticia de espacios físicos.
  - Permite que los administradores mantengan un colchón o margen de maniobra no sectorizado.

### Decisión 4: Bloqueo Estricto ante Reducciones por Debajo de Ocupación Activa
- **Decisión**: Si se solicita reducir la capacidad asignada a un área dinámica por debajo del número de vehículos que se encuentran físicamente aparcados en ella en ese instante, el sistema **rechaza la transacción con código de error y mensaje explicativo**.
- **Racional**:
  - Garantiza que nunca se generen estados de ocupación inconsistentes (como 120% de ocupación real involuntaria por reducción administrativa).
  - Obliga al operador o administrador a esperar o derivar salidas antes de comprimir el aforo del sector.

---

## 2. Estrategia de Persistencia y Sincronización Offline

### Esquema Local (IndexedDB)
- Añadir el almacén `parking_areas` en la base de datos IndexedDB local (`SmartParkingDB`).
- Relación: `facilityId`, con índice sobre `facilityId` y `code`.
- Soporte de mutaciones en cola (`outbox`) para creación de instalaciones y áreas con sincronización bidireccional automática.

### Esquema Servidor (Cloudflare D1 con Drizzle ORM)
- Tabla `facilities`: soporta inserción y actualización de capacidad total.
- Nueva tabla `parking_areas`:
  ```sql
  CREATE TABLE parking_areas (
    id TEXT PRIMARY KEY,
    facility_id TEXT NOT NULL REFERENCES facilities(id),
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    description TEXT,
    allocated_capacity INTEGER NOT NULL DEFAULT 0,
    business_unit_id TEXT REFERENCES business_units(id),
    is_active INTEGER NOT NULL DEFAULT 1,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(facility_id, code)
  );
  ```
- Ampliación en tabla `parking_sessions`:
  - `parking_area_id TEXT REFERENCES parking_areas(id)`

---

## 3. Conclusiones y Cumplimiento Constitucional
- Todos los tipos y esquemas de validación se implementan con **Zod** en `src/core/`.
- La lógica de cálculo de capacidad, buffer y validaciones de reducción de aforo reside en el dominio puro (`src/core/`), desacoplada de la UI y del servidor.
- La interfaz de usuario PWA opera offline de forma nativa e inmediata.
