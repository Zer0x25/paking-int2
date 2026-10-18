---
id: PHR-019
stage: implementation
date: 2026-10-18
branch: 012-cloudflare-production-readiness
command: user-reported local gate onboarding defect
model: Codex GPT-6
---

# PHR-019: Categoría inicial de espacio para un recinto nuevo

## Solicitud

El usuario indicó que después de crear una instalación y una unidad, Garita no muestra tipos de espacio y rechaza la entrada. También preguntó por qué la edición de unidad muestra “tipo de cuota”.

## Hallazgo

- El bootstrap persistía el recinto, asignaba al administrador y registraba auditoría, pero no insertaba `space_categories`.
- El catálogo de desarrollo incluye General / Estándar, Accesible y VIP únicamente para el recinto de demo.
- La unidad de negocio usa `quotaType` (dinámica, garantizada o contractual); Garita necesita además `spaceCategoryId` (STD, ACC, VIP u OTHER).
- La prueba Worker del bootstrap reprodujo el defecto: catálogo de categorías vacío luego de crear el recinto.

## Cambio

- El bootstrap crea `STD` / General / Estándar con `allocatedSlots` igual a la capacidad total.
- `0003_default_space_category.sql` incorpora `STD` a recintos activos existentes que no la tengan, conservando el resto del catálogo.
- El formulario de unidad explica que la cuota y el tipo de espacio son campos diferentes.
- Se amplían spec, contrato API, modelo de datos, quickstart, checklist de staging y ADR-021.

## Límites y verificación

- La migración local se aplica solo al D1 local; staging requiere revisar/aplicar las migraciones antes de liberar el Worker actualizado.
- La prueba Worker dirigida pasó: el bootstrap devuelve la categoría `STD` con 20 cupos en un recinto de prueba de 20 plazas y acepta la entrada con su identificador.
- `npm run db:local:init` aplicó `0003_default_space_category.sql` al D1 local; un conteo posterior dio cero recintos activos sin categoría `STD`.
- `npm run test:coverage`: 205 pruebas unitarias y 37 pruebas Worker pasaron; cobertura de líneas 95.11% (unit) y 94.66% (Worker).
- `npm run typecheck`, `npm run lint` y `npm run build` pasaron.
- La vista local de Garita mostró “General / Estándar” en el paso de confirmación. No se confirmó la entrada para evitar mutar los datos del usuario; el flujo completo crear/editar/eliminar del recinto sigue pendiente de revisión de navegador (T045).
