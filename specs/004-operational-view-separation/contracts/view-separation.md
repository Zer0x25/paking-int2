# Contrato de interfaz: vistas operativas separadas

## Garita Operativa

- Muestra el formulario de entrada y el formulario de salida.
- No muestra fichas de KPI ni paneles de monitoreo de ocupación por área o unidad de negocio.
- Conserva el indicador compartido de conexión/sincronización.

## Dashboard

- Muestra las fichas generales de ocupación, vehículos adentro, disponibilidad y reserva flotante.
- Muestra el desglose por áreas físicas y unidades de negocio.
- No muestra formularios para registrar entradas o salidas.
- Conserva sus estados actuales de carga e indisponibilidad.

## Navegación y datos

- Las pestañas existentes siguen cambiando entre vistas sin recargar la aplicación.
- Una entrada o salida exitosa mantiene el refresco actual de métricas.
- La vista Configuración y los permisos por rol permanecen sin cambios.
