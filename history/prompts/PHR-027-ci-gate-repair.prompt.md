---
id: PHR-027
stage: ci-gate-repair
date: 2026-10-18
branch: main
command: user-authorized repair, commit, push, and GitHub Actions verification
model: Codex GPT-6
---

# PHR-027: Reparación de fallos de CI en pruebas de Workers

## Solicitud

> commit and psuh qpero asegurate que github de verde

El push de `2dd2d15` activó GitHub Actions, pero el workflow falló en dos pruebas de Workers.

## Hallazgos y cambios

- `security-routes.worker.test.ts` intentaba validar credenciales incorrectas sin inyectar los secretos que requiere el login. Funcionaba localmente por `.dev.vars`, pero en el runner limpio respondía 500. El test ahora instala credenciales efímeras y autocontenidas.
- `configuration-persistence.worker.test.ts` suponía que una operación perdedora de una carrera de capacidad siempre devolvería el error de buffer. El Worker también puede rechazarla con el conflicto de edición desactualizada; la prueba acepta ambos 409 y sigue comprobando que la suma no exceda la capacidad.

## Verificación local

- Los dos archivos de Workers afectados pasaron; la prueba de carrera pasó cinco ejecuciones consecutivas.
- `npm run test:coverage`: 229 pruebas frontend y 41 de Workers pasaron; cobertura de statements 93.92% / 91.09%.
- `npm run typecheck`, `npm run lint`, `npm audit`, `npm run build` y `npm run worker:dry-run` pasaron; auditoría con cero vulnerabilidades.
- El nuevo workflow de GitHub se verificará después de publicar esta corrección.

## Archivos

- Modificados: `tests/workers/security-routes.worker.test.ts`, `tests/workers/configuration-persistence.worker.test.ts`.
- Añadido: este PHR.

## Límites

- No se modificó código de ejecución ni la configuración del Worker; las correcciones hacen que los tests cubran el comportamiento sin depender de secretos locales ni del orden exacto en que la concurrencia detecta el conflicto.
- El despliegue de producción permanece en la versión ya verificada; esta publicación actualiza los tests y su registro.
