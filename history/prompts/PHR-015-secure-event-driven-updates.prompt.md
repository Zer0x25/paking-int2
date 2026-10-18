---
id: PHR-015
stage: implementation
date: 2026-10-17
branch: 011-secure-event-driven-updates
command: interactive continuation of secure event-driven updates
model: Codex GPT-6
---

# PHR-015: Acceso protegido y refresco por cambios

## Prompt del usuario

> 1. Proteger las rutas de datos y limitar las consultas al usuario autenticado y a la vista activa.
> 2. Reducir la frecuencia de consulta o actualizar los datos al ocurrir cambios. me inclino mas por actualizar al ocurrir ambios

## Decisiones confirmadas

- Exigir JWT, alcance por recinto y permisos por rol antes de leer o modificar datos.
- Cargar exclusivamente los datos de la vista activa después del inicio de sesión y eliminar el polling de datos.
- Propagar invalidaciones autenticadas entre equipos por recinto; los clientes vuelven a leer datos desde rutas protegidas.
- No cachear respuestas privadas de API en el service worker; mantener catálogos offline en IndexedDB con claves por recinto y lectura después de autenticar.
- No crear recursos remotos ni desplegar como parte de esta feature.

## Auditoría de especificación

- Constitución, especificación, plan, contratos, modelo, quickstart y tareas fueron revisados antes de modificar código.
- Las dos listas de calidad tienen 30/30 puntos completos.
- 13 requisitos funcionales y 8 criterios de éxito tienen tareas asociadas. Se amplió T013 para verificar 100 cambios y exigir que al menos 95 se propaguen en 2 segundos.
- `git diff --check` no reportó problemas. El hook opcional de commit se omitió porque el usuario no pidió commit.

## Estado inicial de implementación

- La rama es `011-secure-event-driven-updates`.
- El código de producción todavía no fue modificado al registrar este PHR.
- Las pruebas de aceptación y unidades se redactarán y ejecutarán antes de las implementaciones correspondientes, según la Constitución.
- No se hizo commit, push ni despliegue.
