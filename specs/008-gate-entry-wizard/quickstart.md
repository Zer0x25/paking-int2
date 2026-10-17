# Quickstart: Validación manual del flujo de garita

## Prerequisites

- Una instalación con un usuario operador y acceso a Garita.
- Al menos una unidad de negocio y una categoría de espacio; las áreas pueden estar configuradas o la asignación flotante puede usarse.
- Una patente de prueba que no tenga una sesión activa para probar Entrada y otra sesión activa para probar Salida.

## Scenarios

1. **Inicio**: abrir Garita. Solo deben mostrarse patente y Registrar en la tarjeta de operación.
2. **Patente inválida**: ingresar menos de seis caracteres y pulsar Registrar. El flujo debe permanecer en `plate` y mostrar el error.
3. **Salida**: ingresar una patente activa, pulsar Registrar y luego Salida. La salida debe usar la patente ingresada, mostrar el resultado y retirar el vehículo de la lista activa.
4. **Entrada confirmada**: ingresar una patente nueva, avanzar, seleccionar Entrada, revisar/cambiar unidad, tipo y área, y pulsar Confirmar entrada. La sesión debe conservar esas selecciones.
5. **Volver y corregir**: retroceder desde confirmación, cambiar la selección; retroceder hasta patente, corregirla y continuar. Los demás datos deben conservarse cuando corresponda.
6. **Errores**: intentar salir con una patente sin sesión activa y confirmar entrada sin catálogo de unidad o categoría disponible. El sistema no debe registrar una operación y debe mantener datos recuperables.
7. **Offline**: con una sesión local disponible, desconectar la red, confirmar entrada y salida. Las operaciones deben aparecer localmente y quedar en la cola existente para sincronización.
8. **Operación móvil y accesible**: repetir a 375 px, con teclado y foco visible. Comprobar nombres accesibles, lectura de mensajes y ausencia de controles cortados.

Esta guía contiene escenarios manuales de aceptación para el navegador.
