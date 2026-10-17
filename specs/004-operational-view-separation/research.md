# Research: Separación de Garita Operativa y Dashboard

## Evidencia actual

- La navegación ya separa Garita Operativa y Dashboard en pestañas distintas.
- La pantalla de Garita muestra entrada/salida y además el mismo monitoreo que aparece en Dashboard.
- Dashboard muestra las fichas de ocupación global, vehículos adentro, disponibilidad, reserva flotante, áreas y unidades de negocio.
- La barra de sincronización está fuera del contenido de las pestañas y funciona como estado compartido.

## Decisiones

- **Decisión**: Garita Operativa se limita a entrada y salida; el monitoreo queda exclusivamente en Dashboard.
- **Razón**: La persona usuaria pidió evitar la repetición y mantener las vistas con funciones separadas.
- **Alternativa descartada**: Mantener un resumen compacto en Garita. Seguiría duplicando indicadores del Dashboard.
- **Decisión**: Mantener la barra de conexión/sincronización compartida.
- **Razón**: Es un estado transversal de la aplicación, no una ficha de ocupación.
- **Alternativa descartada**: Ocultar el estado en alguna pestaña. No mejora la separación de responsabilidades y puede ocultar información operativa.
- **Decisión**: No alterar métricas, refresco, formularios, permisos ni reglas del servidor.
- **Razón**: El cambio solicitado es de composición visual y no requiere cambios de negocio.
