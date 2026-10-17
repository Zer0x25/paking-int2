# ADR-008: Sistema visual adaptable y preferencia local de tema

* **Estado**: Aceptado
* **Fecha**: 2026-10-17
* **Decisores**: Líder del Proyecto y equipo de implementación

## Contexto y Declaración del Problema

La aplicación tiene una paleta oscura fija, estilos globales compartidos y valores de color inline en sus pantallas. Garita, Dashboard y Configuración deben seguir el dispositivo o permitir tema claro/oscuro, y poder utilizarse desde 375 px. La preferencia debe continuar funcionando en la PWA sin red.

## Decisión

1. Representar la apariencia como Sistema, Claro u Oscuro y conservarla solo en el navegador local.
2. Resolver Sistema con `prefers-color-scheme` y observar cambios del dispositivo mientras Sistema esté activo.
3. Aplicar la opción efectiva antes del contenido inicial, usar `color-scheme` para los controles nativos y caer a Sistema ante valores inválidos o almacenamiento no disponible.
4. Mantener una paleta central de tokens CSS semánticos para superficies, texto, foco, acento y estados; aplicar esos tokens a inicio de sesión y vistas autenticadas.
5. Adaptar las vistas con CSS responsive, sin añadir una biblioteca de componentes o un servicio de preferencias.
6. Usar 44x44 px como objetivo táctil de los controles principales por comodidad operacional, además de contrastes WCAG 2.2 definidos en el contrato.

## Alternativas Consideradas

### Guardar la preferencia en el perfil remoto

Descartada porque no hay una cuenta de usuario para cada operador y requeriría API, almacenamiento adicional y sincronización offline para una opción puramente visual.

### Instalar una biblioteca visual

Descartada porque los componentes existentes se pueden normalizar con tokens y CSS; agregar una dependencia amplia incrementaría el tamaño y no aporta funcionalidad necesaria.

### Mantener solo la paleta oscura actual y hacerla responsive

Descartada porque no cumple la solicitud explícita de tema claro y de seguir la preferencia del dispositivo.

## Consecuencias

* Ambas paletas deben probar contraste en cada combinación de texto/superficie y no comunicar estados solo con color.
* El tema elegido queda aislado al navegador; no se sincroniza entre dispositivos.
* La primera carga necesita resolver la preferencia antes de pintar el contenido para evitar un cambio brusco de colores.
* Los estilos inline que impiden cambiar de tema deben adoptar tokens semánticos.
* No cambia ningún endpoint ni dato de negocio; el PWA conserva la preferencia durante operación offline.

## Referencias

* [MDN: prefers-color-scheme](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40media/prefers-color-scheme)
* [W3C: WCAG 2.2 Contrast Minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
* [W3C: WCAG 2.2 Target Size Minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum)
