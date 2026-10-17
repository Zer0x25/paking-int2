# UX Requirements Checklist: Separación de Garita Operativa y Dashboard

**Purpose**: Revisar claridad, límites y verificabilidad de los requisitos de interfaz
**Created**: 2026-10-17
**Feature**: [spec.md](../spec.md)

**Note**: Lista de revisión de calidad de requisitos para esta feature.
**Review Ownership**: Criterios marcados tras revisar la especificación, el plan y el contrato visual.
**Marker Semantics**: [x] indica que el criterio de redacción y cobertura está satisfecho; no representa avance de implementación.

## Límites de cada vista

- [x] CHK001 ¿La finalidad de Garita Operativa está descrita como registrar entradas y salidas?
- [x] CHK002 ¿Se enumeran las fichas y paneles que no deben duplicarse en Garita?
- [x] CHK003 ¿Se define qué indicadores y desgloses permanecen en Dashboard?
- [x] CHK004 ¿Se declara explícitamente que Configuración y los permisos no cambian?

## Estados y continuidad

- [x] CHK005 ¿Se aclara el estado compartido de conexión y sincronización?
- [x] CHK006 ¿Se especifica que la carga o indisponibilidad del Dashboard no invade Garita?
- [x] CHK007 ¿Se conserva el refresco actual de métricas tras registrar una entrada o salida?
- [x] CHK008 ¿Los escenarios y criterios permiten verificar ambas vistas por separado en navegador?

## Notes

- Revisión realizada contra spec.md, contracts/view-separation.md y quickstart.md.
