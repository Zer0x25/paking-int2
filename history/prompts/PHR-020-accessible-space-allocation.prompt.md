---
id: PHR-020
stage: specification
date: 2026-10-18
branch: 013-accessible-space-allocation
command: user-requested facility and area capacity split by space type
model: Codex GPT-6
---

# PHR-020: Capacidad por tipo de espacio

## Solicitud

> ya entendi me gusta turecomendacion, agregale la mia y veamos en que queda, cuando creo un recinto, del dupo asignacdo, quedan cono general/standar y tambien cuantas plazas son de accesibilida minusvalido, ejemplo 33 plazas estandar mas 2 plazas acesibilidad, y eso 2 tipo de estacionamiento tengo no necesitamos otros tipó de momento, cuando se ajustan las areas tambien debe poder asignar las plazas estandar y accesibilidad

## Decisiones confirmadas

- El administrador ingresa la capacidad total y la cantidad Accesible; el sistema calcula Estándar como la diferencia. Ejemplo: 35 totales, 2 Accesibles y 33 Estándar.
- Las áreas permiten asignar Estándar y Accesible por separado; cada tipo no puede superar la capacidad correspondiente del recinto y lo no asignado queda como reserva flotante por tipo.
- Se mantienen independientes la cuota de la unidad de negocio (garantizada, contractual o dinámica) y la categoría física del espacio.
- Las entradas Estándar no consumen capacidad Accesible. Si no quedan plazas Accesibles en el recinto, se puede confirmar una plaza Estándar disponible tras una alerta. Si otra área aún tiene cupo Accesible, se sugiere esa área primero.
- La configuración y las nuevas admisiones ofrecen solo Estándar y Accesible.

## Artefactos

- Nueva rama: `013-accessible-space-allocation`.
- Nueva especificación de producto: `specs/013-accessible-space-allocation/spec.md`.
- Checklist de calidad de especificación: `specs/013-accessible-space-allocation/checklists/requirements.md` (16/16 criterios revisados).
- `.specify/feature.json` apunta al nuevo directorio de feature en el checkout local.

## Límites y siguiente etapa

- No se modificó código de producción ni se ejecutaron pruebas; esta sesión dejó listo el diseño para revisión.
- No se hizo commit, push ni operación remota.
- Tras revisar y aprobar la especificación, continuar con `$speckit-plan`, registrar decisiones técnicas del modelo de datos en ADR y luego desglosar tareas antes de implementar.
