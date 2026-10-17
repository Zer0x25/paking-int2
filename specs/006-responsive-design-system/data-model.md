# Data Model: Preferencia visual

La feature no agrega datos de negocio ni cambia los modelos de estacionamiento. Solo usa una preferencia de presentación local.

## ThemePreference

Representa la opción de apariencia para el navegador actual.

| Campo | Tipo | Regla |
|---|---|---|
| `mode` | `system`, `light` o `dark` | Allowlist exacta; valor ausente/desconocido se interpreta como `system` |

### Resolución

- `system`: tema efectivo derivado de la preferencia de color del dispositivo; se actualiza ante cambios del dispositivo.
- `light`: tema claro efectivo sin depender del dispositivo.
- `dark`: tema oscuro efectivo sin depender del dispositivo.

La preferencia se conserva en el almacenamiento del navegador, no se envía al servidor y no se incluye en auditoría de operaciones. Si el almacenamiento local no está disponible, el tema sigue funcionando durante la sesión usando `system` y el valor actual del dispositivo.

## VisualToken

Rol de presentación compartido (por ejemplo, fondo, superficie, texto, borde, foco, acento o estado). Sus valores cambian por tema; el rol semántico y el propósito permanecen iguales.

## ComponentPattern

Patrón de interfaz con roles visuales y estados comunes: navegación, formulario, botón, tarjeta, indicador, lista o aviso. No representa datos persistidos.
