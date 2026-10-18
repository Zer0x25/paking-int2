# Implementation Plan: Capacidad por Tipo de Espacio

**Branch**: `013-accessible-space-allocation` | **Date**: 2026-10-18 | **Spec**: [spec.md](./spec.md)

## Summary

Configurar la capacidad del recinto y de cada área en dos tipos físicos: Estándar y Accesible. El administrador ingresa el total y el número de plazas Accesibles del recinto; el sistema calcula Estándar. Las áreas reciben cupos separados. La admisión, tanto directa como sincronizada desde modo offline, valida tipo, área, capacidad global y la cuota comercial existente. Dashboard y configuración mostrarán capacidad, ocupación y disponibilidad desglosadas. La solución reutiliza `space_categories` para el aforo del recinto y agrega capacidad por tipo a cada área, conservando el total actual como suma compatible.

## Technical Context

**Language/Version**: TypeScript, modo estricto
**Primary Dependencies**: React 18, Vite 6, Hono 4, Drizzle ORM 0.45, Zod 3, Wrangler 4
**Storage**: Cloudflare D1 (SQLite); IndexedDB mantiene la caché PWA y las mutaciones offline existentes
**Testing**: Vitest unitario, `@cloudflare/vitest-pool-workers` para D1/Worker, Testing Library
**Target Platform**: Cloudflare Workers + D1; desarrollo local con Vite y Wrangler
**Project Type**: Aplicación web offline-first con dominio hexagonal
**Performance Goals**: Usar el snapshot batched actual; no agregar consultas periódicas ni viajes de red para calcular disponibilidad por categoría
**Constraints**: Mantener sesiones históricas y APIs agregadas; solo STD/ACC para nuevas altas; las cuotas garantizadas, contractuales y dinámicas conservan su semántica
**Scale/Scope**: Configuración de un recinto activo por identidad, sus áreas, las entradas/salidas, sincronización offline y el dashboard

## Constitution Check

- Especificación funcional aprobada y clarificaciones del usuario registradas en `spec.md`: **PASS**.
- Se completará auditoría de consistencia `$speckit-analyze` antes de código: **GATE**.
- Pruebas de dominio y Worker se escribirán primero y se ejecutarán en rojo antes de la implementación: **PASS / requerido**.
- Dominio puro en `src/core`; persistencia, HTTP y auditoría permanecen en `src/server`; UI/caché en `src/client`: **PASS**.
- Payloads nuevos y almacenados se validan con Zod; nuevas migraciones D1 son aditivas: **PASS**.
- Mutaciones usan batch, versión del recinto, auditoría y el flujo offline vigente: **PASS**.
- La suite y cobertura objetivo del repositorio (>=85%), `typecheck`, `lint` y `build` se ejecutarán antes de dar por terminado el cambio: **PASS / requerido**.
- Sin excepciones constitucionales propuestas.

## Design

### Capacity source and compatibility

- `space_categories` seguirá siendo la fuente del aforo por categoría del recinto. `STD + ACC` suma exactamente el total; `VIP`/`OTHER` se conservan para referencias históricas, con cero capacidad nueva.
- `ParkingArea` tendrá `standardCapacity` y `accessibleCapacity`; `allocatedCapacity` se conservará como su suma para no romper integraciones existentes.
- Las sesiones seguirán guardando `spaceCategoryId`; una sesión activa ACC ocupa ACC y cualquier categoría histórica no-ACC se cuenta como Estándar. No se reescribe el historial.
- La migración 0004 preserva el total del recinto y cada capacidad agregada de área. Su reparto inicial cubre la ocupación activa ACC y no-ACC; asigna a ACC los espacios de área necesarios para mantener las asignaciones STD dentro del pool STD. El resto de la capacidad legacy migra a STD y las categorías VIP/OTHER quedan con cero capacidad nueva.

### Admission and concurrency

- El motor del dominio recibirá el tipo físico solicitado además de la unidad y el área. Verificará cuota de negocio y capacidad global y específica por tipo.
- Con área seleccionada, una entrada debe caber en el cupo de ese tipo en el área y en el aforo global del tipo. Sin área, solo puede consumir el buffer flotante del tipo, sin invadir cupos asignados a áreas.
- La API online y el endpoint de sincronización aplicarán la misma regla. Un conflicto no persiste la sesión; el compare-and-swap existente de versión del recinto resuelve escrituras concurrentes.
- Si se solicita ACC y el área no tiene disponibilidad, se recomendará otra área ACC. Solo si ACC está agotado en todo el recinto, la interfaz permitirá al operador elegir STD tras una alerta explícita.

### Configuration and metrics

- Crear/editar recinto: campo de total y campo Accesibles; Estándar se calcula en pantalla. El backend deriva STD y valida ocupación y asignaciones existentes.
- Crear/editar área: campos Estándar y Accesibles, total derivado, guardado conjunto con auditoría. Los ajustes rápidos legacy se adaptan a la división Estándar sin alterar el cupo Accesible.
- Los contratos, esquemas Zod y métricas existentes mantienen campos agregados y agregan desglose por tipo.
- La vista de configuración recibe el catálogo de categorías ya cargado en App; no agrega una consulta periódica.

### Risks and mitigations

- **Capacidad antigua inconsistente con STD/ACC**: migración conserva los totales y backfill de áreas; Worker tests cubren el demo y bases con áreas ocupadas.
- **Carrera entre dos garitas**: revalidación del snapshot y compare-and-swap de versión antes de persistir.
- **Sesiones sin área o con categoría legacy**: buffer flotante explícito y clasificación legacy no-ACC como STD.
- **Entrada accesible sin plaza accesible**: el servidor responde conflicto; UI exige confirmación y reintenta como STD solo si hay disponibilidad.

## Project Structure

```text
src/
├── core/
│   ├── rules/                  # capacidad por tipo, admisión y métricas puras
│   └── types/schema.ts         # modelos y validación Zod compartidos
├── server/
│   ├── db/migrations/          # migración D1 0004 y backfill
│   ├── db/repositories/        # snapshot, escrituras por tipo y auditoría
│   └── routes/                 # configuración, entrada online y sincronización
└── client/
    ├── components/             # formularios, garita y dashboard
    ├── db/                     # caché y cola offline existentes
    └── App.tsx                 # cableado de catálogos

tests/
├── unit/core/                  # reglas de capacidad y métricas
├── unit/server/                # contratos y validaciones de rutas
├── unit/client/                # formularios y flujo de confirmación
└── workers/                    # migración, persistencia, entrada y sync en D1
```

**Structure Decision**: Mantener la arquitectura existente; no se agrega paquete, dependencia ni endpoint de polling.

## Implementation Phases

1. Finalizar contratos/modelos y tareas, analizar consistencia, y registrar la decisión técnica ADR-022.
2. Escribir y ejecutar pruebas rojas para reparto recinto/área, métricas, altas online/offline y UI.
3. Añadir migración/schema, mapeo, reglas de dominio y escrituras validadas con auditoría.
4. Conectar formularios de configuración y visualización desglosada en garita/dashboard.
5. Ejecutar pruebas focalizadas, convergencia contra spec y quality gates; revisar en navegador real y reiniciar dev para presentar la configuración.

## Complexity Tracking

No hay violaciones constitucionales ni excepciones por justificar.
