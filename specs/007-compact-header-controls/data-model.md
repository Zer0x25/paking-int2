# Data Model: Controles compactos para tema y conexión

No se introducen entidades persistentes ni cambios de base de datos.

## Estado de interfaz existente

- **Preferencia de tema**: `system | light | dark`, almacenada en el navegador. `system` sigue la preferencia del dispositivo hasta que la persona alterna manualmente; después se almacena `light` o `dark`.
- **Conectividad**: estado online/offline suministrado por el navegador.
- **Cola de sincronización**: colección existente de mutaciones pendientes en IndexedDB; el indicador muestra su cantidad sin cambiar su estructura.
- **Sincronización**: progreso y hora del último lote procesado, existentes en el componente de estado.
