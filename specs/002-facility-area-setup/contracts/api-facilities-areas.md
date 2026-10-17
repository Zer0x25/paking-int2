# API Contracts: Facilities & Parking Areas

**Feature**: `002-facility-area-setup`  
**Base URL**: `/api`  
**Authentication**: Bearer JWT (Role: Admin for mutations; Operator for read)

---

## 1. Endpoints de Instalaciones (`/facilities`)

### `POST /api/facilities`
Crea una nueva instalación física de estacionamiento.
- **Rol Requerido**: `admin`
- **Request Body**:
  ```json
  {
    "name": "Centro de Convenciones & Hotel Grand Pacific",
    "address": "Av. Costanera 1000",
    "totalCapacity": 250
  }
  ```
- **Response 201 Created**:
  ```json
  {
    "facility": {
      "id": "fac-uuid-1",
      "name": "Centro de Convenciones & Hotel Grand Pacific",
      "address": "Av. Costanera 1000",
      "totalCapacity": 250,
      "createdAt": "2026-10-15T23:00:00Z",
      "updatedAt": "2026-10-15T23:00:00Z"
    }
  }
  ```
- **Response 400 Bad Request**: Validación Zod fallida.

### `PUT /api/facilities/:facilityId`
Actualiza datos de la instalación (ej. cambiar capacidad total).
- **Rol Requerido**: `admin`
- **Request Body**:
  ```json
  {
    "name": "Centro Grand Pacific",
    "address": "Av. Costanera 1000",
    "totalCapacity": 300
  }
  ```
- **Response 200 OK**: Objeto `facility` actualizado.
- **Response 409 Conflict**: Si la nueva capacidad total es menor que la suma de plazas ya asignadas a áreas.

---

## 2. Endpoints de Áreas de Estacionamiento (`/facilities/:facilityId/areas`)

### `GET /api/facilities/:facilityId/areas`
Lista todas las áreas de una instalación, incluidas las inactivas para administración, con su capacidad asignada y ocupación en tiempo real. `allocatedCapacitySum` y `floatingBuffer` solo consideran áreas activas; las áreas inactivas retornan `availableSlots: 0`.
- **Rol Requerido**: `admin` o `operator`
- **Response 200 OK**:
  ```json
  {
    "facilityId": "fac-uuid-1",
    "totalCapacity": 250,
    "allocatedCapacitySum": 180,
    "floatingBuffer": 70,
    "areas": [
      {
        "id": "area-uuid-1",
        "facilityId": "fac-uuid-1",
        "name": "Nivel -1 Subsuelo",
        "code": "SUB-1",
        "description": "Estacionamiento techado principal",
        "allocatedCapacity": 100,
        "businessUnitId": null,
        "isActive": true,
        "activeOccupancy": 42,
        "availableSlots": 58,
        "version": 1
      },
      {
        "id": "area-uuid-2",
        "facilityId": "fac-uuid-1",
        "name": "Playa Exterior Hotel",
        "code": "EXT-HOTEL",
        "description": "Sector exclusivo huéspedes",
        "allocatedCapacity": 80,
        "businessUnitId": "bu-hotel-uuid",
        "isActive": true,
        "activeOccupancy": 65,
        "availableSlots": 15,
        "version": 1
      },
      {
        "id": "area-uuid-3",
        "facilityId": "fac-uuid-1",
        "name": "Sector Antiguo",
        "code": "OLD-1",
        "description": "Área fuera de operación",
        "allocatedCapacity": 20,
        "businessUnitId": null,
        "isActive": false,
        "activeOccupancy": 0,
        "availableSlots": 0,
        "version": 2
      }
    ]
  }
  ```

### `POST /api/facilities/:facilityId/areas`
Crea una nueva área en la instalación.
- **Rol Requerido**: `admin`
- **Request Body**:
  ```json
  {
    "name": "Sector Norte Aire Libre",
    "code": "NORTE-1",
    "description": "Sector posterior junto a pabellón de eventos",
    "allocatedCapacity": 50,
    "businessUnitId": null
  }
  ```
- **Response 201 Created**: Objeto `area` creado.
- **Response 409 Conflict**:
  - Si el código ya existe en esa instalación.
  - Si la capacidad asignada supera la reserva flotante disponible de la instalación.

### `PATCH /api/facilities/:facilityId/areas/:areaId/capacity`
Reajusta dinámicamente en caliente la capacidad de un área.
- **Rol Requerido**: `admin`
- **Request Body**:
  ```json
  {
    "allocatedCapacity": 60,
    "version": 1
  }
  ```
- **Response 200 OK**: Objeto `area` con la nueva capacidad y `version` incrementada.
- **Response 409 Conflict**:
  - Si la nueva capacidad es inferior al número de vehículos actualmente estacionados en el área.
  - Si la nueva capacidad excede la capacidad total del complejo considerando las otras áreas.
  - Si hubo colisión de concurrencia optimista (`version` desactualizada).

### `PUT /api/facilities/:facilityId/areas/:areaId`
Actualiza nombre, código, descripción, régimen de uso y capacidad. El código es único por instalación, incluso frente a áreas inactivas, para no reutilizar identificadores históricos. La `version` evita sobrescribir cambios concurrentes.
- **Rol Requerido**: `admin`
- **Request Body**:
  ```json
  {
    "name": "Subsuelo Remodelado",
    "code": "SUB-REN",
    "description": "Acceso por rampa norte",
    "allocatedCapacity": 60,
    "businessUnitId": null,
    "version": 1
  }
  ```
- **Response 200 OK**: Objeto `area` actualizado y versión incrementada.
- **Response 400 Bad Request**: Datos inválidos.
- **Response 404 Not Found**: Instalación o área inexistente.
- **Response 409 Conflict**: Código duplicado, capacidad menor a la ocupación, sobreasignación o versión desactualizada.

### `PATCH /api/facilities/:facilityId/areas/:areaId/status`
Elimina un área de forma lógica para conservar las referencias históricas. Solo se permite si no hay vehículos activos; la capacidad liberada vuelve al buffer. Las áreas inactivas no aparecen en catálogos operativos.
- **Rol Requerido**: `admin`
- **Request Body**:
  ```json
  {
    "isActive": false,
    "version": 1
  }
  ```
- **Response 200 OK**: Objeto `area` con `isActive: false` y versión incrementada.
- **Response 400 Bad Request**: El estado o versión no son válidos.
- **Response 404 Not Found**: Instalación o área inexistente.
- **Response 409 Conflict**: El área ya está inactiva, hay vehículos activos o la versión está desactualizada.

---

## 3. Endpoints de Reservas Contractuales de Eventos

### `GET /api/facilities/:facilityId/events`
Lista las reservas del recinto, incluidos los registros cancelados o vencidos que se conservan para historial. El cliente muestra solo próximas, vigentes y dentro del día de gracia; omite canceladas o ya vencidas de la lista activa.
- **Rol Requerido**: `admin`
- **Response 200 OK**: `{ "events": [EventBooking] }` ordenados por `startTime` ascendente.

### `POST /api/facilities/:facilityId/events`
Crea una reserva contractual. No existe un límite artificial de registros.
- **Rol Requerido**: `admin`
- **Request Body**:
  ```json
  {
    "title": "Congreso de Tecnología",
    "businessUnitId": "bu-events-01",
    "reservedSlots": 35,
    "startTime": "2026-11-04T21:00:00.000Z",
    "endTime": "2026-11-05T05:00:00.000Z"
  }
  ```
- **Response 201 Created**: Objeto `event` con `status: "scheduled"` y `version: 1`.
- **Response 400 Bad Request**: Nombre, cupos, unidad o intervalo inválidos.
- **Response 409 Conflict**: Las cuotas garantizadas y reservas que coinciden superan la capacidad física.

### `PUT /api/facilities/:facilityId/events/:eventId`
Actualiza nombre, unidad contractual, cupos y rango de fecha y hora. La versión evita sobrescribir una edición más reciente.
- **Rol Requerido**: `admin`
- **Request Body**: Los mismos campos de creación más `version`.
- **Response 200 OK**: Objeto `event` actualizado, versión incrementada.
- **Response 404 Not Found**: Recinto o reserva inexistente.
- **Response 409 Conflict**: Reserva cancelada, compromisos superiores al aforo o versión desactualizada.

### `PATCH /api/facilities/:facilityId/events/:eventId/status`
Cancela una reserva en forma lógica. El registro y sus cambios quedan disponibles para auditoría; los cupos dejan de comprometer capacidad y desaparece de la lista activa.
- **Rol Requerido**: `admin`
- **Request Body**: `{ "status": "cancelled", "version": 1 }`.
- **Response 200 OK**: Reserva cancelada y versión incrementada.
- **Response 409 Conflict**: Reserva ya cancelada o versión desactualizada.

## 4. Endpoints de Registro Vehicular con Área

### `POST /api/sessions/entry` (Extensión)
- **Request Body**:
  ```json
  {
    "facilityId": "fac-uuid-1",
    "businessUnitId": "bu-uuid-1",
    "parkingAreaId": "area-uuid-1",
    "licensePlate": "AA123BB",
    "deviceId": "gate-north"
  }
  ```
- Registra el vehículo e incrementa la ocupación tanto de la unidad de negocio como del área física seleccionada.
