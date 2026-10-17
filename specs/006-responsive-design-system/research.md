# Research: Sistema visual adaptable

## Preferencia de color del dispositivo

- **Decision**: La opción Sistema sigue la preferencia de color del dispositivo; Claro y Oscuro la sustituyen hasta que el usuario vuelva a elegir Sistema.
- **Rationale**: `prefers-color-scheme` permite leer la preferencia sin servicio externo y `matchMedia` permite detectar cambios durante la sesión. Ambos están disponibles en navegadores modernos y la preferencia del sistema se conserva automáticamente al usar la opción Sistema.
- **Alternatives considered**: Fijar Claro como opción inicial ignoraría el requisito explícito del usuario; pedir una cuenta o guardar en Worker añade backend y sincronización innecesarios para una preferencia de presentación.
- **Sources**: [MDN: prefers-color-scheme](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40media/prefers-color-scheme), [MDN: matchMedia](https://developer.mozilla.org/en-US/docs/Web/API/Window/matchMedia).

## Persistencia y primera pintura

- **Decision**: Guardar solo `system`, `light` o `dark` en almacenamiento local del navegador; validar el valor leído y resolver valores ausentes o inválidos como `system`. Aplicar el tema antes de que aparezca el contenido.
- **Rationale**: La preferencia no es dato operativo ni requiere sincronización; el fallback evita bloquear la app si almacenamiento está deshabilitado o corrupto. La metadata `color-scheme` y un bootstrap de tema temprano coordinan estilos de la página y controles nativos.
- **Alternatives considered**: Guardarlo en el perfil de usuario ampliaría modelo, APIs y comportamiento offline; esperar a React para poner el tema puede mostrar brevemente la paleta equivocada.
- **Sources**: [MDN: color-scheme](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/color-scheme), [MDN: meta color-scheme](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/meta/name/color-scheme).

## Contraste, reflujo y controles táctiles

- **Decision**: Diseñar ambos temas con contraste mínimo 4.5:1 para texto normal y 3:1 para texto grande y elementos gráficos necesarios; usar 44x44 px como objetivo de interacción táctil principal; comprobar la composición solicitada a 375 px y hacer una comprobación adicional a 320 px para detectar problemas de reflujo.
- **Rationale**: WCAG 2.2 establece los umbrales de contraste citados. Su criterio AA de tamaño objetivo es 24x24 px con excepciones; 44x44 px corresponde a la guía mejorada y se elige aquí por el uso de Garita en operación rápida. WCAG define reflujo vertical en 320 CSS px; se mantiene 375 px como base acordada con el usuario y 320 px como verificación adicional.
- **Alternatives considered**: Limitarse a 24x24 px satisface el mínimo AA en tamaño pero deja controles pequeños para uso táctil en una garita; validar solo escritorio no cubre la solicitud.
- **Sources**: [W3C: Contrast Minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [W3C: Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html), [W3C: Target Size Minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum), [W3C: Target Size Enhanced](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced), [W3C: Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html).

## Sistema visual y alcance

- **Decision**: Crear roles semánticos reutilizables con CSS y aplicarlos a inicio de sesión, navegación, Garita, Dashboard y Configuración; conservar el morado de marca y reemplazar colores fijos de superficies/estados donde impiden el tema claro.
- **Rationale**: Las vistas actuales comparten `index.css` pero contienen estilos inline y colores ligados a fondos oscuros. Un mapa de roles evita duplicar paletas y mantiene un solo cliente.
- **Alternatives considered**: Añadir una biblioteca de componentes no está justificado para el alcance actual y contradice el objetivo de usar dependencias existentes; duplicar hojas separadas por vista produciría variaciones en superficies y estados.
