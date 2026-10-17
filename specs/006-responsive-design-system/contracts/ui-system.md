# Contrato de interfaz: Sistema visual adaptable

## Selector de tema

- Nombre accesible: **Tema visual**.
- Opciones exactas: **Sistema**, **Claro**, **Oscuro**.
- Selección inicial: Sistema si no existe una opción explícita válida.
- La elección aplica el tema de todas las superficies inmediatamente y se conserva en el navegador.
- En Sistema, cambios posteriores de preferencia del dispositivo cambian el tema efectivo sin recargar.
- El selector está disponible en la pantalla de inicio de sesión y en la navegación autenticada.

## Vistas y anchos

- Vistas principales: Garita Operativa, Dashboard y Configuración.
- Ancho base confirmado: 375 CSS px.
- Verificación adicional de reflujo: 320 CSS px; no se introduce overflow horizontal de página para contenido normal.
- Escritorio: conservar acceso a la información y operaciones de las vistas en 1280 CSS px.
- En ancho pequeño se permite scroll vertical; acciones esenciales, navegación y campos no pueden quedar ocultos, montados unos sobre otros ni cortados.

## Contraste e interacción

- Texto normal >=4.5:1; texto grande y elementos gráficos esenciales >=3:1.
- Áreas táctiles principales >=44x44 CSS px.
- Todos los controles conservan nombre accesible, operación por teclado y foco visible.
- Los movimientos no esenciales respetan la preferencia de movimiento reducido.
- La semántica del estado no se comunica solo mediante color.
