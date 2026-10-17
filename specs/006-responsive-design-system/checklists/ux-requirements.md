# UX Checklist: Sistema visual adaptable para Smart Parking

**Purpose**: Revisar claridad, cobertura y consistencia de los requisitos del sistema visual y sus vistas móviles.
**Created**: 2026-10-17
**Feature**: [spec.md](../spec.md)

**Note**: Checklist generado para revisar la calidad de los requisitos, no para indicar que la implementación está terminada.
**Review Ownership**: Artifact de revisión del usuario/producto. Solo quien revisa puede marcar `[x]` cuando confirme que el requisito está bien definido.

## Tema y consistencia visual

- [ ] CHK001 ¿La especificación distingue claramente Sistema, Claro y Oscuro, incluyendo qué pasa cuando cambia la preferencia del dispositivo? [Clarity, Spec §US1, FR-002–FR-006]
- [ ] CHK002 ¿Están definidos los colores semánticos para fondos, superficies, texto, bordes, foco y estados, y su legibilidad en ambos temas? [Completeness, Spec §FR-001, FR-011]
- [ ] CHK003 ¿La pantalla de inicio, la navegación autenticada y las tres vistas están cubiertas por el mismo lenguaje visual? [Coverage, Spec §Assumptions]

## Adaptación móvil

- [ ] CHK004 ¿Los 375 px están definidos como ancho base y se explica qué contenido y acciones deben permanecer accesibles? [Clarity, Spec §US2, FR-007–FR-009]
- [ ] CHK005 ¿Los requisitos definen cómo se apilan formularios, indicadores, listas y navegación sin perder información en móviles? [Completeness, Spec §US2]
- [ ] CHK006 ¿Los casos de texto largo, aumento de texto, desbordamiento y contenido alto tienen resultados esperados? [Edge Cases, Spec §Edge Cases]

## Accesibilidad y verificación

- [ ] CHK007 ¿Los límites de contraste separan texto normal, texto grande y elementos gráficos, e indican qué estados deben verificarse? [Measurability, Spec §FR-011]
- [ ] CHK008 ¿La especificación define tamaño táctil, teclado, nombre accesible, foco visible y movimiento reducido para todos los controles principales? [Coverage, Spec §US4, FR-010–FR-013]
- [ ] CHK009 ¿Los criterios de éxito cubren explícitamente tema claro/oscuro, viewport móvil y escritorio con resultados que puedan verificarse? [Acceptance, Spec §Success Criteria]

## Notes

- Revisar estos requisitos antes de cerrar la feature; el estado de cada casilla pertenece al revisor, no al estado del código.
