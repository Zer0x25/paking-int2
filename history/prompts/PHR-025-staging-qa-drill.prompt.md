---
id: PHR-025
stage: staging-qa
date: 2026-10-18
branch: main
command: user-authorized commit, push, and staging QA
model: Codex GPT-6
---

# PHR-025: Pruebas de aislamiento, sincronización y recuperación en staging

## Solicitud

> El usuario pidió commit y push y planteó iniciar pruebas de staging sobre aislamiento entre recintos, sincronización offline, eventos entre dispositivos, mutaciones de configuración, Logs/Traces y recuperación/rollback.

## Commit y push

- Se publicó el registro anterior de despliegue con `c8ba4aa113305ddf261066420ad2a7f2c0133d4c` (`docs(release): record smart gate staging validation`).
- `git push origin main` pasó la compuerta local, incluidas las 229 pruebas del frontend y las pruebas de Workers; `origin/main` quedó en el mismo SHA y el árbol estaba limpio antes de este registro de QA.

## Pruebas de staging

- Autenticación y permisos: login admin/operator; lecturas privadas sin token devolvieron 401; operador intentando leer o mutar configuración devolvió 403; catálogo y sesiones consultados con un facilityId distinto al claim devolvieron 403. Una consulta D1 de solo lectura confirmó que staging contiene una instalación, así que no se probó aislamiento real entre tenants.
- Mutaciones de configuración: instalación actualizada temporalmente y restaurada; unidad contractual, área y reserva sintéticas creadas/editadas; desactivación de unidad con dependencias activas devolvió 409; reserva cancelada y área/unidad desactivadas. La lectura final confirmó unidad y área inactivas, evento cancelado, nombre del recinto restaurado y seis sesiones activas, igual que antes del flujo.
- IndexedDB/outbox: en una pestaña Chrome se deshabilitó la red, se registró una entrada sintética y la UI mostró un cambio pendiente en outbox. Al recuperar la red, sincronizó y el indicador volvió a cero. Una segunda pestaña recibió la actualización en vivo; la salida posterior devolvió el conteo activo a seis. Ambas pestañas compartían perfil Chrome, por lo que queda probar con dos dispositivos.
- Logs y errores: una solicitud JSON malformada, sin mutación, devolvió 500 genérico y `Cache-Control: no-store`. Workers Observability mostró registros `http.request` y `server.error`. Se observaron campos de trace ID; no se verificó un span/traza muestreada ni una pila remapeada por source map.
- Rollback Worker: versión anterior `cfc76add-fe33-4cd0-a0ff-c72cafea023e` desplegada al 100%; health, login, catálogo y lectura de activos respondieron 200 con seis sesiones. Se restauró inmediatamente la versión `34c12096-dd51-4e8b-8b35-5899820ded66` al 100%. El historial de deployments confirma ambos pasos.
- D1: `wrangler d1 time-travel info` devolvió bookmark para `2026-10-18T22:00:00Z`. No se ejecutó restore porque sobrescribiría datos actuales; requiere una copia aislada para ensayar la recuperación completa.

## Pendientes

- Crear/configurar dos facilities e identidades aisladas de prueba para validar aislamiento tenant-a-tenant.
- Validar invalidación y sincronización usando dos dispositivos/perfiles realmente independientes.
- Confirmar desde Workers Observability una traza muestreada con spans y una pila source-mapped ante un error de Worker.
- Ensayar D1 restore sobre una copia aislada y comprobar sus datos antes de considerar la recuperación validada.
- Producción no se tocó.
