# Research: Controles compactos para tema y conexión

## Decisions

### Alternancia de tema

- **Decision**: Mantener `system` como preferencia inicial y convertir el tema efectivo actual en elección explícita al primer uso del botón. Cada pulsación alterna claro/oscuro y persiste el resultado.
- **Rationale**: Conserva el arranque según el dispositivo y permite una interacción única sin agregar estado nuevo ni quitar la persistencia ya confirmada.
- **Alternatives considered**: Forzar claro al inicio; mantener un selector de tres opciones. El primero ignora la preferencia del dispositivo y el segundo no cumple la simplificación solicitada.

### Indicador de conectividad

- **Decision**: Convertir el aviso existente en un indicador compacto de la cabecera autenticada. Mostrar el estado accesiblemente, el número de mutaciones pendientes y mantener sincronización manual desde el icono cuando sea posible.
- **Rationale**: Quita la franja que interrumpe el contenido sin perder el estado offline-first ni la acción manual de sincronización.
- **Alternatives considered**: Quitar todo el estado o eliminar la sincronización manual. Ambas opciones esconden trabajo pendiente o quitan una acción existente.

### Iconos

- **Decision**: Usar SVG inline de sol/luna y red, con nombres accesibles y tokens semánticos existentes.
- **Rationale**: No añade dependencias, conserva nitidez a cualquier escala y permite controlar el contraste/foco.
- **Alternatives considered**: Agregar una librería de iconos. No aporta suficiente valor para dos pictogramas sencillos.

## Resolved Questions

- La preferencia inicial y la alternancia clara/oscura fueron confirmadas por el usuario.
- Los colores existentes se consideran correctos por revisión del usuario.
- La ubicación del indicador de conexión junto al control de tema en la cabecera fue solicitada directamente.
