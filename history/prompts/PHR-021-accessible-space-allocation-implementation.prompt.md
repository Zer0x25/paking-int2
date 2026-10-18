---
id: PHR-021
stage: implementation
date: 2026-10-18
branch: 013-accessible-space-allocation
command: user-approved implementation, restart and commit of typed space capacity
model: Codex GPT-6
---

# PHR-021: Implementación de capacidad por tipo de espacio

## Solicitud

> ya entendi me gusta turecomendacion, agregale la mia y veamos en que queda, cuando creo un recinto, del dupo asignacdo, quedan cono general/standar y tambien cuantas plazas son de accesibilida minusvalido, ejemplo 33 plazas estandar mas 2 plazas acesibilidad, y eso 2 tipo de estacionamiento tengo no necesitamos otros tipó de momento, cuando se ajustan las areas tambien debe poder asignar las plazas estandar y accesibilidad

> reinicia no veo la configruacion de plazas disponibles

## Decisiones confirmadas

- El administrador ingresa el total del recinto y el número de plazas Accesibles; Estándar se calcula como la diferencia.
- Cada área permite configurar Estándar y Accesibles en forma separada; se conserva el buffer no asignado por categoría.
- Las entradas Estándar no consumen cupo Accesible. El ingreso Accesible puede usar Estándar solo con confirmación explícita cuando ya no queden plazas Accesibles en el recinto.
- Se conservan las reglas de cuota comercial, la migración de sesiones existentes y la sincronización offline.

## Trabajo realizado

- Se añadió la migración D1 0004 y el reparto persistido para recinto y áreas, conservando los totales agregados y sesiones activas existentes.
- Se actualizaron esquemas Zod, reglas del dominio, persistencia y rutas para validar capacidad por categoría, ocupación, áreas y cuotas.
- Configuración permite crear y editar la distribución; Garita muestra disponibilidad y alternativa de área; Dashboard presenta ocupación y plazas libres por categoría.
- Se agregaron pruebas de dominio, API, componentes y Workers, incluida la migración legacy y el rechazo de sobreasignación.
- Se registraron el diseño, el contrato y ADR-022. La convergencia dejó T043 para verificación autenticada en navegador.

## Verificación

- `npm run test:coverage`: aprobado; cobertura de statements 93,92% para unitarias y 91,09% para Workers. Branches: 88,61% y 85,08%, respectivamente.
- `npm run typecheck`: aprobado.
- `npm run lint`: aprobado.
- `npm run build`: aprobado.
- `npm run test:workers -- tests/workers/configuration-persistence.worker.test.ts`: aprobado, 6 pruebas.
- `git diff --check`: aprobado.
- Vite respondió HTTP 200 en `http://localhost:5173/`; el Worker respondió HTTP 200 en `http://localhost:8787/api/health`.
- Ambos servidores de desarrollo quedaron activos. El navegador mostró el login; no se ingresaron credenciales locales. T043 mantiene pendiente verificar visualmente los formularios y métricas tras iniciar sesión.

## Límites de publicación

- No se desplegó ni se hizo push.
- El usuario autorizó el commit local de la implementación.
