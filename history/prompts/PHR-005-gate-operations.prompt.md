---
id: PHR-005
stage: specification-and-planning
date: 2026-10-17
branch: 005-gate-operations
command: interactive implementation request
model: Codex GPT-6
---

# PHR-005: Operación unificada de Garita

## Prompt del usuario

> commit, ahora en la garita operativa, las dos fichas fácilmente podrían ser una, fusionamos y agregamos botones entrada y salida; mejorar la interfaz con lista de vehículos activos y salida desde esa lista sin ingresar patente, permitir editar la patente si se equivoca al entrar, y validar seis caracteres alfanuméricos en formato `XX-XX-XX`.

## Aclaraciones recibidas

- Aceptar seis caracteres alfanuméricos con o sin guiones y normalizar la presentación a `XX-XX-XX`.
- Permitir corregir solo sesiones activas.

## Diseño acordado para la especificación

- Commit anterior: `b2bab92 feat: separate gate operations from dashboard`.
- Rama: `005-gate-operations`.
- Una ficha de operación con modo Entrada/Salida; lista activa y salida rápida por sesión.
- Corrección por sesión/versionado, validación exacta de patente, operación offline y auditoría conforme a la Constitución.
- Reutilizar el valor compacto en los registros existentes y aplicar guiones en presentación para evitar migrar datos locales.

## Estado

Se creó la especificación, plan inicial, contrato API, modelo de datos, quickstart, checklists y ADR-006. La implementación de producción queda para la fase TDD después del análisis pre-código.

## TDD Red

- Se agregaron primero pruebas de dominio, API, IndexedDB/outbox y representación de la ficha.
- La ejecución focalizada falló como se esperaba: faltan helpers de patente, mutación offline, listado/local merge, ruta de auditoría/salida por ID y el componente nuevo. Las pruebas existentes de las funciones aún implementadas pasan.

## Implementación TDD Green

- Se implementó una sola ficha Entrada/Salida con la lista activa en un panel independiente debajo de la ficha en escritorio y móvil.
- La patente acepta seis caracteres alfanuméricos con o sin guiones, se guarda compacta y se presenta agrupada como `XX-XX-XX`.
- Las rutas de sesiones activas requieren autenticación, ofrecen salida y corrección por ID/versionado y registran actor, valores relevantes y fecha.
- Entrada, salida y corrección funcionan sobre IndexedDB/outbox sin conexión. Las entradas/correcciones pendientes siguen visibles, las salidas pendientes se ocultan y el outbox aplica las mutaciones por fecha.
- La prueba offline reveló sesiones activas obsoletas en la caché local. Al recibir una lista completa del servidor se eliminan de IndexedDB las sesiones activas no reportadas, conservando las que tienen mutaciones pendientes.
- Los esquemas de las rutas de Garita/sincronización rechazan propiedades desconocidas; cada mutación se valida con `SyncMutationSchema` antes de guardarse en IndexedDB.
- Se añadieron pruebas para rechazar patentes duplicadas en la ruta offline y para reconciliar la caché sin eliminar operaciones pendientes.
- Rojos adicionales observados antes de estas correcciones: faltaban `getLocalEntryValidationError` y `findStaleActiveSessionIds`; una ruta aceptaba propiedades JSON desconocidas; IndexedDB guardaba una mutación inválida. Las pruebas correspondientes pasaron después de las correcciones.

## Verificación final

- `npm run test:coverage`: 18 archivos y 143 pruebas Node aprobadas; 85.12% ramas, 94.53% líneas, 94.18% sentencias y 93.99% funciones. Después, 1 prueba de integración en `workerd` aprobada.
- `npm run typecheck`: aprobado para el cliente/Worker y el `tsconfig` de pruebas Workers.
- `npm run build`: aprobado; se generaron el service worker y 5 recursos precacheados.
- `git diff --check`: aprobado.
- Navegador real: entrada automática `QZ9K17` → `QZ-9K-17`; duplicado online y offline rechazado; corrección solo activa; salida por fila y salida manual; prueba offline `TST493` → `TS-T4-93`, corrección a `TS-T4-96`, salida rápida, tres mutaciones persistidas y sincronizadas al volver a conectar. La lista quedó vacía tras cerrar los vehículos de QA.
- PWA preview: con el servidor de preview detenido, una recarga offline recuperó el shell servido por Service Worker; la sesión `AB-1C-23` y su mutación pendiente siguieron visibles desde IndexedDB/outbox. El servidor Vite dev no registra Service Worker, por lo que esa prueba corresponde al build/preview.
- Se añadió una prueba de componente para que el selector Entrada/Salida use controles nativos accesibles con `aria-pressed` y grupo semántico.
- Revisión de requisitos UX: 7/9 criterios satisfechos. CHK005 (cancelar/guardar/error con mayor detalle en la especificación) y CHK009 (teclado, foco y lector de pantalla) quedan señalados para revisión de producto/accesibilidad.
- La primera convergencia encontró que las rutas solo se probaban desde Node; T028 se resolvió con `@cloudflare/vitest-plugin` y quedó documentada en ADR-007. La convergencia final no añadió tareas pendientes.
- `npm audit` tras actualizar la integración: 0 vulnerabilidades críticas; permanecen 1 alta y 4 moderadas en dependencias existentes de Drizzle/esbuild, sin aplicar actualizaciones forzadas.
- La implementación de esta feature queda sin commit. El commit `b2bab92` corresponde únicamente a la separación anterior de Garita y Dashboard.
