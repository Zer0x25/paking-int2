# Quickstart: Controles compactos de cabecera

1. Ejecutar la app con `npm run dev`.
2. En el navegador, eliminar `smart-parking-theme` y recargar con preferencia de sistema clara; confirmar que inicia claro.
3. Pulsar el icono de luna; confirmar que cambia a oscuro sin recargar. Recargar y confirmar que conserva oscuro.
4. Pulsar el icono de sol; confirmar que vuelve a claro. Repetir con sistema oscuro sin elección guardada.
5. Iniciar sesión y confirmar que el botón de tema y el estado de red aparecen juntos en la cabecera.
6. Simular pérdida/recuperación de red en DevTools. Confirmar cambio del icono y nombre accesible, sin banner horizontal.
7. Con mutaciones pendientes, confirmar el contador y activar el indicador para sincronizar; comprobar que desconectado no envía y que al reconectar se reintenta automáticamente.
8. Revisar a 375 CSS px y escritorio: controles dentro de la cabecera, sin recorte; navegar ambos controles por teclado.

> La verificación automatizada de esta guía queda pendiente de una solicitud explícita de pruebas/verificación.
