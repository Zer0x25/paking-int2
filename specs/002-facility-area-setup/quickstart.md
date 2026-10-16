# Quickstart & Verification Guide: Construcción de Instalaciones, Áreas y Asignación Dinámica

**Feature**: `002-facility-area-setup`  
**Date**: 2026-10-15  

---

## 1. Escenario 1: Construcción de Instalación y Parámetros Base
1. Iniciar sesión como Administrador (`admin` / credenciales configuradas).
2. Navegar a la pestaña **"Configuración de Instalación"**.
3. Registrar una nueva instalación:
   - Nombre: "Complejo Convenciones & Resort"
   - Dirección: "Ruta 68 Km 15"
   - Capacidad Total: `120` plazas.
4. Verificar que se muestra la tarjeta de la instalación con `120 plazas físicas` y `Buffer general: 120`.

---

## 2. Escenario 2: Creación de Áreas y Asignación Inicial de Capacidad
1. En la misma vista, ir al formulario **"Crear Nueva Área de Estacionamiento"**:
   - Área 1: Nombre "Subsuelo Techado", Código "SUB-1", Capacidad `50` plazas, Tipo: Compartida.
   - Área 2: Nombre "Playa Exterior", Código "EXT-1", Capacidad `40` plazas, Tipo: Exclusiva Hotel.
2. Confirmar la creación de ambas áreas.
3. Verificar en pantalla:
   - Total Instalación: `120`
   - Plazas Sectorizadas: `90` (`50 + 40`)
   - Reserva Flotante (Buffer General): `30` plazas disponibles para nueva sectorización.

---

## 3. Escenario 3: Verificación de Restricción de Sobreasignación
1. Intentar crear un Área 3 con capacidad de `40` plazas (superando el buffer de `30`).
2. Verificar que el sistema emite un error de validación claro: *"La capacidad asignada (40) supera el buffer disponible de la instalación (30)"*.
3. Cambiar la capacidad a `30` plazas y verificar que se aprueba y el buffer queda en `0`.

---

## 4. Escenario 4: Reajuste Dinámico en Caliente y Protección contra Subcupo
1. En Garita, registrar el ingreso de 5 vehículos en "Subsuelo Techado" (`SUB-1`).
2. La ocupación activa de `SUB-1` se refleja en `5 / 50` (10% ocupado).
3. Regresar al panel de configuración e intentar reducir la capacidad de `SUB-1` a `3` plazas (menor a los 5 vehículos aparcados).
4. Verificar que el sistema **bloquea la operación** con el mensaje: *"No es posible reducir la capacidad a 3: hay 5 vehículos actualmente estacionados en esta área"*.
5. Aumentar dinámicamente la capacidad de `SUB-1` a `60` plazas (utilizando buffer liberado de otra área).
6. Verificar que la nueva capacidad de `60` plazas y la ocupación `5 / 60` se actualizan de inmediato en el panel y en la garita.

---

## 5. Ejecución Automatizada de Pruebas
```bash
# Ejecución de pruebas unitarias y de integración del motor de áreas
npm run test:run -- tests/unit/core/test_area_allocation.test.ts tests/unit/server/test_area_api.test.ts

# Verificación de TypeScript
npm run typecheck
```
