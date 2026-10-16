# Data Model: Construcción de Instalaciones, Áreas y Asignación Dinámica

**Feature**: `002-facility-area-setup`  
**Date**: 2026-10-15  
**Status**: Approved  

---

## 1. Entidades del Dominio

### Entidad: `Facility` (Instalación / Complejo)
Representa la infraestructura física principal donde operan el estacionamiento y las unidades de negocio.

| Campo | Tipo | Restricciones / Reglas | Descripción |
|---|---|---|---|
| `id` | `string` (UUID) | Obligatorio, Clave primaria | Identificador único de la instalación |
| `name` | `string` | Mínimo 2 caracteres | Nombre comercial del complejo |
| `address` | `string` | Opcional | Dirección física del recinto |
| `totalCapacity` | `number` (int) | Entero estrictamente positivo (> 0) | Cantidad total física de plazas de estacionamiento |
| `createdAt` | `string` (ISO 8601) | Obligatorio | Fecha de creación del registro |
| `updatedAt` | `string` (ISO 8601) | Obligatorio | Fecha de última actualización |

### Entidad: `ParkingArea` (Área o Sector de Aparcamiento)
Representa una zona, piso o sector delimitado dentro de una instalación física específica.

| Campo | Tipo | Restricciones / Reglas | Descripción |
|---|---|---|---|
| `id` | `string` (UUID) | Obligatorio, Clave primaria | Identificador único del área |
| `facilityId` | `string` (UUID) | Referencia a `Facility.id` | Instalación a la que pertenece el área |
| `name` | `string` | Mínimo 2 caracteres | Nombre del sector (ej. "Nivel -1 Subsuelo") |
| `code` | `string` | Alfanumérico, mayúsculas, único por instalación | Código de señalización (ej. "SUB-1", "EXT-N") |
| `description` | `string` | Opcional | Indicaciones físicas o referencias |
| `allocatedCapacity` | `number` (int) | Entero $\ge 0$ | Cantidad de plazas asignadas dinámicamente |
| `businessUnitId` | `string \| null` | Referencia opcional a `BusinessUnit.id` | Si es no nulo, uso exclusivo para esa unidad |
| `isActive` | `boolean` | Por defecto `true` | Habilitación operativa del área |
| `version` | `number` (int) | Por defecto 1, incremento en cada cambio | Control de concurrencia optimista |
| `createdAt` | `string` (ISO 8601) | Obligatorio | Fecha de registro |
| `updatedAt` | `string` (ISO 8601) | Obligatorio | Fecha de modificación |

### Entidad: `ParkingSession` (Extensión)
Representa una estadía vehicular en curso o finalizada. Se amplía para capturar la pertenencia al área física.

| Campo Adicional | Tipo | Restricciones / Reglas | Descripción |
|---|---|---|---|
| `parkingAreaId` | `string \| null` | Opcional, referencia a `ParkingArea.id` | Área física donde se estacionó el vehículo |

---

## 2. Invariantes del Dominio y Reglas de Negocio

### Invariante 1: Regla de Capacidad Global y Buffer Flotante
Para cualquier instalación $F$ con capacidad $C_{\text{total}}$ y conjunto de áreas activas $A$:
$$\sum_{a \in A} a.\text{allocatedCapacity} \le C_{\text{total}}$$
El remanente no asignado se define como:
$$\text{BufferFlotante} = C_{\text{total}} - \sum_{a \in A} a.\text{allocatedCapacity} \ge 0$$

### Invariante 2: Integridad de Reducción Dinámica de Capacidad
Dado un intento de reajuste de capacidad para un área $a$ hacia una nueva capacidad $K_{\text{nueva}}$:
$$K_{\text{nueva}} \ge \text{OcupaciónActiva}(a)$$
Si $K_{\text{nueva}} < \text{OcupaciónActiva}(a)$, el motor de dominio rechaza la mutación con el error `CapacityReductionConflictError`.

### Invariante 3: Integridad de Asignación por Exclusividad
Si un área $a$ tiene `businessUnitId = BU_1`, un vehículo con destino a `BU_2` no puede ser asignado a dicha área.

---

## 3. Esquemas de Validación Declarativos (Zod)

```typescript
export const ParkingAreaSchema = z.object({
  id: z.string().min(1),
  facilityId: z.string().min(1),
  name: z.string().min(2, "El nombre del área debe tener al menos 2 caracteres"),
  code: z.string().min(1).max(10).toUpperCase(),
  description: z.string().optional().default(""),
  allocatedCapacity: z.number().int().nonnegative("La capacidad asignada no puede ser negativa"),
  businessUnitId: z.string().nullable().default(null),
  isActive: z.boolean().default(true),
  version: z.number().int().default(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const CreateParkingAreaInputSchema = z.object({
  facilityId: z.string().min(1),
  name: z.string().min(2),
  code: z.string().min(1).max(10),
  description: z.string().optional(),
  allocatedCapacity: z.number().int().nonnegative(),
  businessUnitId: z.string().nullable().optional(),
});

export const UpdateParkingAreaCapacityInputSchema = z.object({
  allocatedCapacity: z.number().int().nonnegative(),
  version: z.number().int().positive(),
});
```
