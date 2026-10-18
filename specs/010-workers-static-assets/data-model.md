# Data Model: Workers Static Assets

Esta feature no agrega ni modifica datos de negocio. Se conservan D1, IndexedDB, los repositorios y los esquemas existentes.

## Artefactos de entrega

| Artefacto | Origen | Uso |
|---|---|---|
| Aplicación SPA | Build de Vite en `dist/` | Entrega HTML, JavaScript, estilos, iconos y archivos de la PWA. |
| Worker API | `src/server/index.ts` | Procesa salud, autenticación, operación, configuración y sincronización bajo `/api/*`. |

No se requiere binding de runtime a los archivos porque el Worker no los lee ni transforma desde código.
