# UX Requirements Quality Checklist: Operación unificada de Garita

**Purpose**: Revisar claridad, completitud y consistencia de los requisitos de experiencia, no el comportamiento del código.
**Feature**: [spec.md](../spec.md)
**Ownership**: Reviewer-owned. `[x]` significa que quien revisa aprobó la calidad del requisito; no indica que la implementación esté terminada.

## Jerarquía y contenido

- [x] CHK001 ¿La especificación define con claridad la ficha única y el panel separado de lista activa? [Claridad, FR-001, FR-004]
- [x] CHK002 ¿Los campos que aparecen en los modos Entrada y Salida están definidos por separado? [Completitud, US1]
- [x] CHK003 ¿La información mínima de cada vehículo activo está enumerada y distingue datos opcionales? [Completitud, FR-004]

## Interacción y estados

- [x] CHK004 ¿La salida rápida identifica la fila/sesión afectada y define qué ocurre ante un conflicto concurrente? [Seguridad de interacción, FR-005, edge cases]
- [ ] CHK005 ¿La edición está limitada a sesiones activas y define estados de guardado, cancelación y error? [Completitud, FR-007, FR-008]
- [x] CHK006 ¿Los estados de carga, sin resultados, error/reintento y offline especifican qué acciones siguen disponibles? [Estados, FR-011, FR-013]

## Entrada y accesibilidad

- [x] CHK007 ¿El patrón `XX-XX-XX` define longitud, caracteres, guiones opcionales, mayúsculas y agrupación progresiva al escribir? [Claridad, FR-009, FR-010]
- [x] CHK008 ¿La ficha única define cómo se señala cuál modo está activo y qué datos se conservan al cambiar de modo? [Consistencia, FR-001, FR-002, FR-003]
- [ ] CHK009 ¿Los requisitos de accesibilidad cubren teclado, lector de pantalla, foco y controles de cada fila? [Accesibilidad, US1, US2, US3]

## Notas

- El resultado seleccionado por el usuario para formato y alcance de edición está documentado en `spec.md`; no se vuelve a preguntar.
- Revisión de implementación, 2026-10-17: 7 de 9 criterios de calidad cubiertos; CHK005 requiere describir explícitamente cancelar/guardar/error y CHK009 requiere detallar teclado, foco y lector de pantalla en los requisitos.
