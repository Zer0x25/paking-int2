# ADR-011: Botón único de tema e indicador compacto de sincronización

- **Estado**: Aceptado
- **Fecha**: 2026-10-17
- **Feature**: [007-compact-header-controls](../../specs/007-compact-header-controls/spec.md)

## Contexto

La persona usuaria pidió reducir el selector de tema a un único botón que alterne claro/oscuro y que la aplicación siga la preferencia del sistema al iniciar. También pidió sacar de la zona de contenido el aviso horizontal de conexión y dejar un indicador pequeño en la cabecera junto al control de tema.

El aviso actual incluye conectividad, cantidad de mutaciones pendientes, última sincronización y acción manual para sincronizar. Retirarlo sin conservar esas capacidades haría menos visible el estado offline-first y quitaría un acceso operativo.

## Decisión

1. Mantener `system` como preferencia hasta la primera interacción. El botón muestra sol o luna, alterna el tema efectivo, y al activarse guarda `light` o `dark` como elección explícita.
2. Mostrar el control de tema en acceso y cabecera autenticada.
3. Convertir el estado de sincronización en un icono accesible en la cabecera autenticada. El icono refleja conectado/sin conexión, muestra el contador pendiente y ofrece sincronización manual al estar conectado con pendientes.
4. Mantener la sincronización automática al reconectar y eliminar el banner que ocupaba el área de contenido.
5. Dibujar iconos SVG inline con tokens actuales, sin sumar dependencias.

## Alternativas consideradas

- Mantener el selector de tres opciones: rechazado porque agrega pasos y no corresponde al control único solicitado.
- Ocultar completamente el estado o quitar la sincronización manual: rechazado porque escondería cambios pendientes o retiraría una acción existente.
- Añadir una librería de iconos: rechazado porque dos iconos inline no justifican otra dependencia.

## Consecuencias

- El tema sigue automáticamente al sistema mientras la persona no lo cambie; luego recuerda la elección manual por navegador.
- Se conserva el acceso a la sincronización manual desde el control compacto y el conteo de pendientes permanece visible.
- El estado de conexión tiene que anunciarse también por nombre accesible y no puede depender únicamente del color.
- La cabecera mantiene dos objetivos táctiles de 44×44 px, tema y conexión.
