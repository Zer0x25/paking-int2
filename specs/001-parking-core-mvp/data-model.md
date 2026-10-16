# Data Model Specification: Sistema Inteligente de Gestión de Estacionamientos (MVP)

**Feature**: `001-parking-core-mvp`  
**Date**: 2026-10-15  
**Spec**: [spec.md](./spec.md)

---

## 1. Entidades Principales y Esquema Relacional (SQLite / D1)

### 1.1 `facilities` (Instalaciones)
Representa los recintos físicos gestionados por el sistema.
- `id`: TEXT (UUID v4) PRIMARY KEY
- `name`: TEXT NOT NULL (ej. "Centro de Convenciones & Hotel Grand")
- `address`: TEXT
- `total_capacity`: INTEGER NOT NULL (Número total de plazas físicas, ej. 200)
- `created_at`: TEXT NOT NULL (ISO 8601 UTC)
- `updated_at`: TEXT NOT NULL (ISO 8601 UTC)

### 1.2 `space_categories` (Categorías de Espacios)
Tipos de plazas dentro de una instalación.
- `id`: TEXT (UUID v4) PRIMARY KEY
- `facility_id`: TEXT NOT NULL REFERENCES `facilities(id)`
- `name`: TEXT NOT NULL (ej. "Estándar", "Accesible (PMR)", "VIP / Reservado")
- `code`: TEXT NOT NULL (ej. "STD", "ACC", "VIP")
- `allocated_slots`: INTEGER NOT NULL (Cantidad de plazas destinadas a esta categoría)

### 1.3 `business_units` (Unidades de Negocio)
Áreas del complejo que consumen o reservan estacionamiento.
- `id`: TEXT (UUID v4) PRIMARY KEY
- `facility_id`: TEXT NOT NULL REFERENCES `facilities(id)`
- `name`: TEXT NOT NULL (ej. "Hotel", "Eventos", "Restaurante", "Gimnasio", "General")
- `code`: TEXT NOT NULL (ej. "HOTEL", "EVENT", "REST", "GYM", "GEN")
- `priority_level`: INTEGER NOT NULL (1 = Máxima/Garantizada [Hotel], 2 = Contractual/Planificada [Eventos], 3 = Rotativa Comercial [Restaurante, Gimnasio])
- `quota_type`: TEXT NOT NULL CHECK (`quota_type` IN ('guaranteed', 'contractual', 'dynamic'))
- `default_quota`: INTEGER NOT NULL DEFAULT 0 (Cupos base garantizados para la unidad)
- `is_active`: INTEGER NOT NULL DEFAULT 1

### 1.4 `event_bookings` (Reservas y Cupos por Eventos)
Bloqueos temporales de cupos para conferencias, banquetes o ferias.
- `id`: TEXT (UUID v4) PRIMARY KEY
- `facility_id`: TEXT NOT NULL REFERENCES `facilities(id)`
- `business_unit_id`: TEXT NOT NULL REFERENCES `business_units(id)`
- `title`: TEXT NOT NULL (ej. "Cumbre Médica Anual 2026")
- `reserved_slots`: INTEGER NOT NULL (ej. 45 plazas)
- `start_time`: TEXT NOT NULL (ISO 8601 UTC)
- `end_time`: TEXT NOT NULL (ISO 8601 UTC)
- `status`: TEXT NOT NULL CHECK (`status` IN ('scheduled', 'active', 'completed', 'cancelled'))

### 1.5 `parking_sessions` (Sesiones Vehiculares / Entradas y Salidas)
Registro de permanencia de cada vehículo en el recinto.
- `id`: TEXT (UUID v4) PRIMARY KEY
- `facility_id`: TEXT NOT NULL REFERENCES `facilities(id)`
- `business_unit_id`: TEXT NOT NULL REFERENCES `business_units(id)`
- `space_category_id`: TEXT NOT NULL REFERENCES `space_categories(id)`
- `license_plate`: TEXT NOT NULL (Normalizada en mayúsculas sin espacios/guiones, ej. "AB123CD")
- `entry_time`: TEXT NOT NULL (ISO 8601 UTC)
- `exit_time`: TEXT (ISO 8601 UTC, NULL si está adentro)
- `status`: TEXT NOT NULL CHECK (`status` IN ('active', 'completed'))
- `duration_minutes`: INTEGER DEFAULT NULL
- `operator_user_id`: TEXT NOT NULL
- `device_id`: TEXT NOT NULL (Identificador de la garita o dispositivo que originó la transacción)
- `version`: INTEGER NOT NULL DEFAULT 1 (Control de concurrencia optimista)

### 1.6 `users` (Usuarios y Roles RBAC)
Operadores y administradores del sistema.
- `id`: TEXT (UUID v4) PRIMARY KEY
- `username`: TEXT NOT NULL UNIQUE
- `password_hash`: TEXT NOT NULL
- `full_name`: TEXT NOT NULL
- `role`: TEXT NOT NULL CHECK (`role` IN ('admin', 'operator'))
- `facility_id`: TEXT REFERENCES `facilities(id)`
- `created_at`: TEXT NOT NULL

### 1.7 `audit_logs` (Bitácora de Auditoría)
Trazabilidad inmutable de operaciones.
- `id`: TEXT (UUID v4) PRIMARY KEY
- `user_id`: TEXT NOT NULL
- `action`: TEXT NOT NULL (ej. "VEHICLE_ENTRY", "VEHICLE_EXIT", "QUOTA_UPDATE")
- `entity_type`: TEXT NOT NULL
- `entity_id`: TEXT NOT NULL
- `details_json`: TEXT NOT NULL
- `created_at`: TEXT NOT NULL

---

## 2. Esquema Local en IndexedDB (PWA Offline-First)

Para garantizar la operación offline, el cliente mantiene las siguientes tiendas de objetos (*object stores*):

1. **`offline_sessions`**: Espejo local de `parking_sessions` activas para búsqueda rápida por placa al momento de la salida.
   - Índice primario: `id`
   - Índice secundario: `license_plate`
   - Índice secundario: `status` ('active')
2. **`outbox_queue`**: Mutaciones pendientes de sincronización hacia Cloudflare Workers.
   - `id`: UUID local
   - `mutation_type`: `'VEHICLE_ENTRY'` | `'VEHICLE_EXIT'`
   - `payload`: Objeto JSON con los datos de la operación
   - `client_timestamp`: Fecha/hora del dispositivo
   - `retry_count`: Número de reintentos
   - `status`: `'pending'` | `'syncing'` | `'synced'` | `'failed'`
3. **`catalogs_cache`**: Copia local de `facilities`, `business_units`, `space_categories` y eventos activos para alimentar desplegables y cálculos de cupos sin conexión.

---

## 3. Máquina de Estados de una Sesión de Estacionamiento

```
                 [Vehículo llega a garita]
                             │
                             ▼
                    ┌─────────────────┐
                    │     ACTIVE      │
                    │ (Vehículo Adentro)│
                    └────────┬────────┘
                             │
            [Operador confirma salida vehicular]
                             │
                             ▼
                    ┌─────────────────┐
                    │    COMPLETED    │
                    │(Vehículo Afuera)│
                    └─────────────────┘
```

### Reglas de Validación de Negocio
1. **Unicidad de Ocupación Activa**: No puede existir más de un registro con `status = 'active'` para la misma `license_plate` en la misma `facility_id`. Si se detecta un intento de ingreso con una placa activa, se debe generar un error de negocio o requerir intervención de supervisor.
2. **Cálculo de Disponibilidad Dinámica**:
   $$\text{Plazas Libres Dinámicas} = \text{Capacidad Total} - \sum \text{Ocupación Activa} - \sum \text{Cupos Garantizados Reservados no ocupados}$$
3. **Protección de Cupos**:
   - Una unidad de negocio con cuota garantizada (Hotel) no puede ser bloqueada si su ocupación actual es menor a su cupo asignado.
   - Las unidades dinámicas (Restaurante, Gimnasio) se rechazan si $\text{Plazas Libres Dinámicas} \le 0$.
