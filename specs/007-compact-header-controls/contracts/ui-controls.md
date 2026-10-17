# Contrato de interfaz: Controles compactos de cabecera

## Botón de tema

- Único control de tema, icono de sol/luna según el cambio disponible.
- Nombre accesible anuncia el tema al que cambiará; el control indica el modo efectivo en texto accesible.
- Sin preferencia explícita, el primer tema coincide con el sistema antes del primer render.
- Cada activación cambia inmediatamente entre claro y oscuro y recuerda el resultado en el navegador.
- Aparece en el inicio de sesión y en la cabecera autenticada; área táctil de al menos 44×44 CSS px.

## Indicador de conexión

- Se muestra junto al botón de tema únicamente en la cabecera autenticada.
- El icono diferencia conectado y sin conexión; el nombre accesible comunica el estado con independencia del color.
- Un contador visible aparece si hay mutaciones pendientes.
- Con conexión y cambios pendientes, el control inicia sincronización manual y comunica espera/progreso de forma visual y accesible; si está desconectado, no intenta enviar.
- La reconexión mantiene el proceso automático de sincronización que ya existe.
- Se elimina el banner horizontal del contenido.
