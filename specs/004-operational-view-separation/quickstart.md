# Quickstart: Separación de vistas

## Preparación

1. Iniciar el Worker y Vite con los comandos de desarrollo del proyecto.
2. Abrir la aplicación e iniciar sesión con un usuario autorizado.

## Validación en navegador

1. Seleccionar **Garita Operativa**.
   - Deben aparecer los formularios de entrada y salida.
   - No deben aparecer ocupación global, disponibilidad, reserva flotante, áreas ni unidades.
   - Debe seguir visible el estado compartido de conexión/sincronización.
2. Seleccionar **Dashboard**.
   - Deben aparecer las fichas generales, el desglose por áreas y por unidades.
   - No deben aparecer los formularios de entrada y salida.
3. Volver a **Garita Operativa** y registrar una operación válida.
   - El flujo de registro debe conservar su resultado actual.
   - Al volver a Dashboard, las métricas deben reflejar la operación con el refresco vigente.
4. Repetir con los roles existentes para confirmar que los accesos de navegación no cambian.

## Validación automatizada

- Ejecutar las pruebas unitarias del selector de secciones.
- Ejecutar npm run test:coverage, npm run typecheck y npm run build.
- Confirmar los criterios visuales en el navegador local.
