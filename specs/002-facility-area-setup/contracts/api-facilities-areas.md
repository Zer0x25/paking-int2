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
Lista todas las áreas de una instalación, incluyendo su capacidad asignada y ocupación en tiempo real.
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

---

## 3. Endpoints de Registro Vehicular con Área

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
