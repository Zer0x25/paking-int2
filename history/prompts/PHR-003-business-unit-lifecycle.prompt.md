---
id: PHR-003
stage: implementation-and-verification
date: 2026-10-17
branch: 003-business-unit-lifecycle
command: interactive implementation request
model: Codex GPT-6
---

# PHR-003: Gestión de unidades de negocio

## Prompt exacto del usuario

> lo mismo para la creacion de unidades, no puedo crear, no puedo editar, no puedo eliminar, solucionalo

## Especificación y decisiones

- Se creó la feature `003-business-unit-lifecycle`; se revisó y aclaró sin preguntas pendientes porque los cuatro campos son los que ya muestra el formulario y áreas/reservas usan baja lógica.
- Alta, edición y retiro se exponen en Configuración. Se validan nombre, código, tipo de cuota, cupos enteros no negativos, código único por instalación y versión optimista.
- Las cuotas garantizadas se validan contra la capacidad disponible, incluyendo áreas y reservas de eventos vigentes, al crear o editar una unidad.
- El retiro es lógico y conserva la referencia histórica. Se bloquea mientras existan sesiones activas, áreas exclusivas activas o reservas visibles/vigentes. El tipo contractual no puede cambiar mientras la unidad tenga reservas vigentes.
- El Worker comparte un almacén mutable de unidades entre API, admisión y dashboard. El API de gestión incluye inactivas; los catálogos operativos solo activas.
- Se creó ADR-005. El Worker de desarrollo sigue usando almacenamiento en memoria; las unidades de esta sesión se pierden al reiniciarlo. La cola offline y la persistencia D1 siguen siendo trabajo de una migración unificada de configuración.

## Resultado

Se reemplazó la mutación de `businessUnits` recibidos por props por una vista de administración conectada a la API, que lista activas e inactivas, crea, edita los cuatro campos y confirma el retiro. Cada mutación registra actor, acción, valores previos/posteriores y fecha. Los mensajes de validación se muestran junto al formulario.

La prueba manual usó `QA Unidad Negocio` / `QAUN`, editó nombre, código, tipo y cupos, y retiró la unidad. La lista activa ya no la muestra, el historial sí, y la garita no la incluye en el selector. También se intentó retirar Hotel, que tiene un área exclusiva activa; la interfaz informó la dependencia y mantuvo la unidad activa. Se intentó crear una cuota garantizada que elevaba la suma a 101 para un aforo de 100; la interfaz rechazó el alta y no creó la unidad.

## Pruebas y verificación

- TDD Red: las pruebas nuevas fallaron primero porque no existían las reglas ni las rutas de unidades.
- Pruebas focalizadas de dominio/API: 16 pasaron.
- Suite completa con cobertura: 108 pruebas en 14 archivos, todas pasaron; cobertura global 95,1% en líneas y 86,56% en ramas.
- `npm run typecheck`: correcto.
- `npm run build`: correcto; bundle Vite y service worker generados.
- `git diff --check`: correcto.
- Navegador local `http://localhost:5173/`: alta, edición, retiro, historial, selector de Garita, protección por área activa y rechazo de cupo garantizado sobre el aforo verificados. La pantalla quedó en Configuración.
- El proyecto no define un script de lint en `package.json`; no se ejecutó ESLint.

## Archivos de la feature

- `specs/003-business-unit-lifecycle/`
- `src/core/types/schema.ts`
- `src/core/rules/businessUnitRules.ts`
- `src/server/services/allocation-service.ts`
- `src/server/routes/facilities.ts`
- `src/server/routes/dashboard.ts`
- `src/client/components/BusinessUnitManager.tsx`
- `src/client/components/FacilityConfigView.tsx`
- `tests/unit/core/test_business_unit.test.ts`
- `tests/unit/server/test_business_unit_api.test.ts`
- `history/adr/ADR-005-business-unit-lifecycle.md`

No se creó commit ni se desplegó el cambio.
