# Quickstart: CRUD de unidades de negocio

## Ejecución local

1. Iniciar Worker y Vite con los comandos de desarrollo ya configurados en el proyecto.
2. Iniciar sesión como administrador y abrir **Configuración**.
3. En **3. Unidades de Negocio**, crear una unidad con nombre, código, tipo de cuota y cupos base.
4. Comprobar que la unidad aparece en la lista y en el selector de destino de la garita.
5. Editar sus cuatro campos y comprobar que la nueva versión aparece tras actualizar.
6. Confirmar el retiro de una unidad sin referencias activas; comprobar que desaparece del selector, aparece bajo el historial inactivo y conserva el código.
7. Intentar retirar una unidad protegida por área exclusiva, sesión activa o reserva vigente; el error debe indicar la dependencia y la unidad debe seguir activa.
8. Intentar crear o editar una cuota garantizada que, sumada a las demás y a las reservas vigentes, exceda el aforo; el sistema debe rechazar el cambio.

## Validación automatizada

- `npm test -- tests/unit/core/test_business_unit.test.ts tests/unit/server/test_business_unit_api.test.ts`
- `npm run test:coverage`
- `npm run typecheck`
- `npm run build`
- Confirmar código duplicado, cuerpo inválido, versión desactualizada y permisos de administrador en las pruebas API.

Los datos del Worker local viven en memoria y se reinician cuando ese proceso se reinicia.
