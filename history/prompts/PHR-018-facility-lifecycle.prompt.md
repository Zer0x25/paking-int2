---
id: PHR-018
stage: implementation-and-verification
date: 2026-10-18
branch: 012-cloudflare-production-readiness
command: user-requested facility creation, editing, and deletion completion
model: Codex GPT-6
---

# PHR-018: Alta y ciclo de vida del recinto

## Prompt del usuario

> entonces nos falto poder crear el recinto y editar y borrar

## Alcance y decisiones

- Completar el alta inicial del recinto para un administrador autenticado sin asignación; no habilitar alta de múltiples recintos por cuenta porque el ámbito actual de identidad y datos es de un recinto.
- Mantener la edición de nombre, dirección y capacidad.
- “Borrar” desactiva lógicamente el recinto, conserva historial/auditoría y se bloquea si quedan vehículos activos.
- Al desactivar, cerrar la sesión local; el siguiente login queda sin recinto si no hay otro activo y puede completar un nuevo alta.
- No hacer commit, push, despliegue ni cambios a Cloudflare remoto.

## Implementación

- Se añadió la migración aditiva `0002_facility_lifecycle.sql`, persistencia de estado activo, bootstrap atómico de recinto y administrador, JWT actualizado, baja lógica y filtrado de datos de recintos inactivos.
- El ID del recinto ahora se genera en el servidor; el esquema de alta rechaza propiedades adicionales.
- Configuración ahora muestra el formulario del primer recinto cuando corresponde, mantiene la edición existente y agrega confirmación de eliminación y cierre de sesión al finalizar.
- La D1 local aplicó `0002_facility_lifecycle.sql`; staging mantiene esta migración pendiente.
- Se actualizó la especificación 002, sus contratos, modelo, quickstart, ADR-020, índice ADR, checklist de staging y quickstart de release.

## Verificación

- `npm run test:coverage`: unidad 39 archivos/205 pruebas, 95,11% de líneas; Workers 9 archivos/37 pruebas, 85,36% de ramas y 94,65% de líneas.
- `npm run typecheck`, `npm run lint` y `npm run build`: pasaron.
- El navegador real quedó en la pantalla de login; no se realizó una mutación manual porque la D1 local contiene el catálogo persistente de demostración. Queda T045 para probar creación, edición y baja con una D1 aislada.
- No se desplegó el código ni se aplicó la migración en staging.
