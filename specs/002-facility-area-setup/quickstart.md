# Quickstart & Verification Guide: Construcción de Instalaciones, Áreas y Asignación Dinámica

**Feature**: `002-facility-area-setup`  
**Date**: 2026-10-15  

---

## 1. Escenario 1: Construcción de Instalación y Parámetros Base
1. Iniciar sesión como Administrador (`admin` / credenciales configuradas).
2. Si la cuenta no tiene recinto asignado, completar el formulario de inicio; si ya existe un recinto, abrir **"Configuración de Instalación"** para editarlo.
3. Registrar o actualizar la instalación:
   - Nombre: "Complejo Convenciones & Resort"
   - Dirección: "Ruta 68 Km 15"
   - Capacidad Total: `120` plazas.
4. Verificar que se muestra la tarjeta de la instalación con `120 plazas físicas` y `Buffer general: 120`; en el alta inicial, confirmar que la sesión queda asignada sin volver a iniciar sesión.
5. Para probar la baja lógica, vaciar primero las sesiones vehiculares, confirmar **Eliminar recinto** y verificar que se conserva el historial y se vuelve al inicio de sesión. Intentar la misma acción con un vehículo activo debe mostrar el bloqueo sin desactivar el recinto.

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

## 5. Escenario 5: Edición, eliminación lógica y refresco del dashboard
1. En Configuración de Instalación, elegir **Editar** en un área y actualizar nombre, código, descripción, régimen de uso o capacidad.
2. Guardar y verificar los valores actualizados; un código duplicado, una capacidad menor que la ocupación o una versión antigua deben mostrar un error sin perder los datos del formulario.
3. Elegir **Eliminar** en un área vacía y confirmar. El área debe pasar a la lista de inactivas, desaparecer de los catálogos operativos y liberar su capacidad al buffer.
4. Verificar que el botón no permita eliminar un área ocupada y que la API rechace la operación si la ocupación cambió después de cargar la vista.
5. En Dashboard, desplazarse hacia abajo y esperar al menos un ciclo de actualización automática. Las tarjetas y la posición de desplazamiento deben permanecer estables mientras llegan nuevas métricas.

---

## 6. Escenario 6: Reservas de eventos con rango de fechas
1. En Configuración, crear dos reservas para la unidad Eventos con nombre, cupos, fecha/hora de inicio y fecha/hora de término; una de ellas debe cruzar medianoche.
2. Confirmar que ambas aparecen ordenadas por fecha, incluyendo las futuras, y que no existe un límite fijo de reservas.
3. Editar una reserva y confirmar que nombre, cupos y rango actualizados aparecen en la lista.
4. Cancelar la otra y confirmar que desaparece de la lista activa mientras su registro sigue conservado.
5. Intentar una reserva que exceda la capacidad disponible durante un intervalo coincidente y confirmar que se rechaza sin cambiar la lista.
6. Verificar con pruebas de reloj controlado que una reserva cuyo término es el día 17 permanece visible durante el día 18 y desaparece desde las 00:00 del 19.

---

## 7. Ejecución Automatizada de Pruebas
```bash
# Ejecución de pruebas unitarias y de integración del motor de áreas
npm test -- tests/unit/core/test_area_allocation.test.ts tests/unit/server/test_area_api.test.ts

# Verificación de TypeScript
npm run typecheck
```
