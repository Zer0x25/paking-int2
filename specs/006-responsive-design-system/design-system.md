# Sistema de diseño Smart Parking

## Principios

- Mantener un lenguaje visual operativo, sobrio y reconocible; conservar el acento índigo/morado de Smart Parking.
- Usar roles semánticos para que Claro y Oscuro cambien los mismos elementos de forma coherente.
- Priorizar lectura, jerarquía de acciones, foco visible y uso táctil en Garita.
- Reordenar contenido en pantallas pequeñas sin retirar información ni acciones.
- Reservar superficies translúcidas para adornos; texto, formularios y estados deben descansar sobre colores opacos y contrastados.

## Temas y tokens

El documento `data-theme="dark"` o `data-theme="light"` en `<html>` selecciona los valores efectivos. Los nombres heredados `--bg-dark`, `--bg-card`, `--bg-input`, `--border-subtle`, `--text-primary`, `--text-secondary`, `--text-muted`, `--accent-primary` y `--color-*` se migran a los roles nuevos, evitando mantener dos paletas paralelas.

| Token | Uso | Oscuro | Claro |
|---|---|---:|---:|
| `--color-canvas` | Fondo general de página | `#0b1020` | `#f5f7fb` |
| `--color-surface` | Tarjetas, paneles y navegación | `#111a2d` | `#ffffff` |
| `--color-surface-raised` | Tarjetas internas, menús y hover | `#1b2740` | `#eef2f8` |
| `--color-surface-sunken` | Controles de entrada y áreas agrupadas | `#080d19` | `#e8edf5` |
| `--color-text` | Texto principal | `#f1f5f9` | `#172033` |
| `--color-text-secondary` | Texto auxiliar y etiquetas | `#c2ccdc` | `#3f4d63` |
| `--color-text-muted` | Metadatos e información secundaria | `#a3b0c4` | `#56657a` |
| `--color-border` | Separadores y límites de controles | `#667892` | `#64748b` |
| `--color-border-strong` | Límites activos | `#94a3b8` | `#475569` |
| `--color-accent` | Enlaces, selección y acento de marca | `#a5b4fc` | `#4338ca` |
| `--color-accent-strong` | Fondo de acción primaria | `#4f46e5` | `#4f46e5` |
| `--color-on-accent` | Texto/icono sobre acción primaria | `#ffffff` | `#ffffff` |
| `--color-focus` | Anillo de teclado | `#a5b4fc` | `#4338ca` |
| `--color-success` | Texto e iconos de estado correcto | `#6ee7b7` | `#047857` |
| `--color-warning` | Texto e iconos de advertencia | `#fcd34d` | `#92400e` |
| `--color-danger` | Texto e iconos de error | `#fca5a5` | `#b91c1c` |
| `--color-danger-strong` | Fondo de acciones destructivas con texto blanco | `#b91c1c` | `#b91c1c` |
| `--color-info` | Texto e iconos informativos | `#7dd3fc` | `#0369a1` |
| `--color-success-surface` | Fondo de estado correcto | `#102c2b` | `#ecfdf5` |
| `--color-warning-surface` | Fondo de advertencia | `#332713` | `#fffbeb` |
| `--color-danger-surface` | Fondo de error | `#351c28` | `#fef2f2` |
| `--color-info-surface` | Fondo informativo | `#10283b` | `#eff6ff` |
| `--color-overlay` | Fondo de diálogos | `rgb(3 8 20 / 76%)` | `rgb(23 32 51 / 42%)` |

Los estados no se diferencian solo por color: conservan texto explícito, icono o etiqueta. Se verifican pares reales de texto/fondo antes de dar por cumplido el contraste del requisito.

## Tipografía

- Texto de interfaz: Outfit con fallback de sistema; código y patentes: JetBrains Mono con fallback monospace.
- Escala: `--font-size-xs: .75rem`, `--font-size-sm: .875rem`, `--font-size-md: 1rem`, `--font-size-lg: 1.25rem`, `--font-size-xl: 1.5rem`, `--font-size-display: clamp(1.5rem, 3vw, 2rem)`.
- Interlineado de cuerpo: `1.5`; encabezados y números operativos usan peso 600–700.
- No reducir texto de formularios por debajo de `1rem` para evitar zoom automático en navegadores móviles.

## Espaciado, forma y elevación

- Escala base de 4 px: `--space-1: .25rem`, `--space-2: .5rem`, `--space-3: .75rem`, `--space-4: 1rem`, `--space-5: 1.25rem`, `--space-6: 1.5rem`, `--space-8: 2rem`, `--space-10: 2.5rem`.
- Radios: `--radius-sm: .5rem`, `--radius-md: .75rem`, `--radius-lg: 1.25rem`, `--radius-pill: 999px`.
- Elevación: sombra corta para controles elevados, media para paneles y alta para diálogos. En tema claro las sombras son más suaves; en oscuro nunca sustituyen el borde.
- Contenedor de contenido: máximo `80rem`; padding de página `1.5rem` en escritorio y `1rem` en móvil.

## Patrones de interfaz

- **Botón primario**: fondo `--color-accent-strong`, texto `--color-on-accent`; secundario usa `--color-surface-raised` y borde; peligro usa `--color-danger` con texto legible o una superficie de peligro y texto explícito.
- **Campo**: fondo `--color-surface-sunken`, texto principal, borde `--color-border`; foco agrega anillo de al menos 2 px y no elimina el indicador del navegador sin reemplazo.
- **Panel/tarjeta**: `--color-surface`, borde persistente y radio medio. El modo claro no utiliza vidrio oscuro translúcido.
- **Avisos/estados**: pareja semántica fondo/texto, icono/etiqueta y `role="status"` o `role="alert"` cuando corresponda.
- **Navegación**: el estado activo combina fondo de acento y texto; se expone también mediante semántica accesible (`aria-current` o `aria-pressed`).
- **Tema**: control nativo etiquetado “Tema visual” con opciones Sistema, Claro y Oscuro; está disponible antes del login y en la cabecera autenticada.
- **Foco**: `:focus-visible` dibuja anillo de 2 px con separación; permanece visible en ambos temas y sobre superficies/acento.
- **Movimiento**: transiciones breves de color y elevación; desactivar movimiento no esencial en `prefers-reduced-motion: reduce`.

## Adaptación responsive

- **375 px**: ancho móvil objetivo; un solo flujo vertical, padding lateral 12–16 px, controles principales de al menos 44×44 px y campos apilados cuando la fila no quepa.
- **320–480 px**: una columna en Garita, métricas y configuración; encabezado y navegación se ajustan a varias filas; acciones pueden envolver; textos largos parten línea; no se usa `overflow-x: hidden` para tapar contenido.
- **481–768 px**: contenido apilado y rejillas de dos columnas solo si cada elemento conserva ancho legible.
- **769–1024 px**: navegación compacta, tarjetas con rejillas fluidas y formularios sin anchuras mínimas rígidas.
- **Más de 1024 px**: marco actual de escritorio con contenedor centrado hasta 1280 px; se conservan las operaciones y jerarquías.
- Validación adicional a 320 px detecta fallos de reflujo; 1280 px confirma que no se pierde el diseño de escritorio.

## Accesibilidad visual

- Texto normal: contraste mínimo 4.5:1; texto grande y gráficos necesarios para identificar controles: mínimo 3:1.
- Controles táctiles principales: objetivo de 44×44 CSS px como decisión ergonómica del producto.
- Nombres accesibles, orden de teclado lógico, foco visible, estados anunciables y respeto por movimiento reducido.
- El test de tokens calcula los pares de texto, estado, acción, foco y borde de esta tabla sobre los colores opacos efectivamente usados:

| Par foreground / background | Oscuro | Claro | Umbral |
|---|---:|---:|---:|
| Texto principal / canvas | 17.28:1 | 15.17:1 | 4.5:1 |
| Texto principal / superficie | 15.85:1 | 16.27:1 | 4.5:1 |
| Texto auxiliar / superficie | 10.72:1 | 8.56:1 | 4.5:1 |
| Texto secundario / canvas | 8.62:1 | 5.53:1 | 4.5:1 |
| Acento / superficie | 8.71:1 | 7.90:1 | 4.5:1 |
| Blanco / acción primaria | 6.29:1 | 6.29:1 | 4.5:1 |
| Blanco / acción destructiva | 6.47:1 | 6.47:1 | 4.5:1 |
| Éxito / superficie de éxito | 9.72:1 | 5.21:1 | 4.5:1 |
| Advertencia / superficie de advertencia | 10.11:1 | 6.84:1 | 4.5:1 |
| Error / superficie de error | 8.21:1 | 5.91:1 | 4.5:1 |
| Información / superficie informativa | 9.07:1 | 5.45:1 | 4.5:1 |
| Borde / control hundido | 4.31:1 | 4.05:1 | 3:1 |
| Borde fuerte / superficie | 6.77:1 | 7.58:1 | 3:1 |
| Foco / canvas | 9.50:1 | 7.37:1 | 3:1 |
