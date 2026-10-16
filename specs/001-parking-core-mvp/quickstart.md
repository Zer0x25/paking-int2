# Quickstart & Escenarios de Validación: Sistema Inteligente de Gestión de Estacionamientos (MVP)

**Feature**: `001-parking-core-mvp`  
**Date**: 2026-10-15  
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

---

## 1. Prerrequisitos de Ejecución Local
- Node.js >= 20.x y `npm`
- Cloudflare Wrangler CLI (instalable localmente vía dependencias de desarrollo)
- Navegador moderno compatible con Service Workers e IndexedDB (Chrome, Firefox, Safari, Edge)

---

## 2. Preparación del Entorno
1. Instalar dependencias del proyecto:
   ```bash
   npm install
   ```
2. Ejecutar suite de pruebas unitarias y de cobertura (TDD):
   ```bash
   npm run test:coverage
   ```
   *Resultado esperado*: Salida limpia con cobertura $\ge 85\%$ en el módulo de dominio y servicios.
3. Iniciar el entorno de desarrollo local (Backend Worker simulado + Frontend Vite):
   ```bash
   npm run dev
   ```

---

## 3. Escenarios de Validación End-to-End

### Escenario 1: Autenticación y Carga de Instalación
1. Abrir la aplicación web en `http://localhost:5173`.
2. Iniciar sesión con usuario administrador (`admin` / `admin123`).
3. Verificar que se despliega el Dashboard con la capacidad total configurada y las unidades de negocio ("Hotel", "Eventos", "Restaurante", "Gimnasio").

### Escenario 2: Asignación Dinámica y Protección de Cupos
1. Con 50 plazas configuradas: Hotel con 20 cupos garantizados, Conferencia con 15 cupos reservados, 15 restantes para áreas rotativas.
2. Registrar ingresos para "Restaurante" hasta completar 15 vehículos.
3. Intentar registrar el vehículo 16 para "Restaurante":
   *Resultado esperado*: La interfaz y la API rechazan el ingreso con alerta de capacidad agotada para el área comercial, protegiendo los 35 cupos restantes destinados a Hotel y Conferencia.

### Escenario 3: Operación Offline en Garita y Resincronización
1. Abrir las herramientas de desarrollador del navegador (DevTools) y activar el modo **Offline** en la pestaña *Network*.
2. Con la red desconectada, registrar 2 ingresos vehiculares y 1 salida.
3. Observar que el conteo en pantalla se actualiza inmediatamente y aparece la etiqueta "3 transacciones pendientes de sincronización".
4. Desactivar el modo Offline en DevTools.
5. Observar que en menos de 2 segundos la cola Outbox se vacía, las transacciones quedan consolidadas en el backend y el indicador de sincronización cambia a verde ("Sincronizado").
