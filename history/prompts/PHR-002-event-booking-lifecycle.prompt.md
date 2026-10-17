---
id: PHR-002
stage: implementation-and-verification
date: 2026-10-17
branch: main
command: interactive implementation request
model: Codex GPT-6
---

# PHR-002: Gestión de reservas contractuales de eventos

## Prompt exacto del usuario

> No se Permite crear mas?, no se pude editar ni borrar, tambine deberia poder asignarse con feha, asi se pueden reservar con anticipacion, y ucando ya esten caducados, desaparescan de la lista, se debe considerar rango de fecha, y ejemlo si es 1 dia, onsidrar que los eventos duran de dia para otro, entonces para que caduquen deben ser 1 dia despues del la fecha

## Aclaración del usuario

> Hasta las 23:59 del día 18 (Recomendado)

Si el evento termina el día 17, permanece en la lista activa durante todo el día 18 y se oculta a las 00:00 del 19.

## Respuesta y resultado

Configuración ahora permite crear varias reservas contractuales, editarlas y cancelarlas. Cada reserva acepta fechas y horas de inicio y término, incluso si cruza medianoche; se ordena por inicio y se mantiene en la lista hasta el final del día siguiente a su fecha de término. Las reservas canceladas o vencidas se ocultan de la lista activa pero se conservan en el almacén y en la auditoría. Los cupos se comprometen solo durante el intervalo; las reservas superpuestas más las cuotas garantizadas no pueden exceder el aforo.

La prueba manual en el navegador creó una reserva nocturna de QA, cambió su nombre y cupos, y la canceló. La lista volvió al único registro inicial. La persistencia de reservas sigue en memoria en el Worker local y se reinicia junto con ese proceso, según ADR-004.

## Archivos leídos o modificados

- `src/client/components/EventBookingsManager.tsx`
- `src/client/components/FacilityConfigView.tsx`
- `src/client/utils/event-booking.ts`
- `src/core/rules/eventBookingRules.ts`
- `src/core/types/schema.ts`
- `src/server/db/schema.ts`
- `src/server/routes/facilities.ts`
- `src/server/services/allocation-service.ts`
- `tests/unit/core/test_event_booking.test.ts`
- `tests/unit/server/test_event_api.test.ts`
- `specs/002-facility-area-setup/spec.md`
- `specs/002-facility-area-setup/plan.md`
- `specs/002-facility-area-setup/tasks.md`
- `specs/002-facility-area-setup/contracts/api-facilities-areas.md`
- `specs/002-facility-area-setup/data-model.md`
- `specs/002-facility-area-setup/quickstart.md`
- `history/adr/ADR-004-event-booking-lifecycle.md`
- `history/adr/README.md`

## Pruebas y verificaciones

- TDD Red: las pruebas de dominio/API fallaron al no existir aún reglas ni rutas de eventos.
- `npm test`: 92 pruebas en 12 archivos.
- `npm run test:coverage`: cobertura global 94.78% en líneas y 87.14% en ramas.
- `npm run typecheck`: correcto.
- `npm run build`: compilación Vite/PWA correcta.
- `git diff --check`: correcto.
- Navegador local: creación, edición, cruce de medianoche, confirmación de cancelación y ocultamiento de la reserva cancelada.
- Servidores de desarrollo: Vite `5173` y Worker `8787` respondieron HTTP 200.

## Decisiones

- Una reserva “eliminada” se cancela lógicamente para conservar auditoría.
- El día de gracia se calcula en la zona horaria local del navegador/instalación; su vencimiento se actualiza en pantalla cada 30 segundos.
- El almacén de desarrollo sigue en memoria. Persistencia durable en D1 requerirá una migración coherente para el conjunto de configuración.
- No se creó commit ni se publicó el cambio.
