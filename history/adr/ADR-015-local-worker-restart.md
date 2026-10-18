# ADR-015: Reinicio seguro del Worker local y puerto estable

- **Estado**: Aceptado
- **Fecha**: 2026-10-17
- **Feature**: [009-d1-persistence](../../specs/009-d1-persistence/spec.md)

## Contexto

Wrangler elige otro puerto cuando una instancia anterior ocupa 8787. Vite mantiene su proxy `/api` dirigido a 8787, por lo que iniciar una segunda instancia en 8788 separa la interfaz del Worker correcto. El inicio repetido debe recuperar el puerto sin afectar aplicaciones ajenas.

## Decisión

- `npm run worker:dev` buscará procesos `wrangler dev src/server/index.ts` cuya ruta ejecutable pertenezca al checkout actual.
- Enviará `SIGINT` solo a esas instancias, esperará su terminación y conservará un único Worker de este proyecto.
- Iniciará Wrangler con el puerto 8787 esperado por Vite y verificará el puerto anunciado en la salida `Ready`.
- Si no puede identificar el dueño del puerto, no lo señalizará. Informará el conflicto y terminará; si Wrangler aun así elige un puerto alternativo, el nuevo proceso se cerrará ordenadamente.
- No se agrega un gestor de procesos externo ni se modifica la configuración del proxy de Vite.

## Alternativas consideradas

- **Matar cualquier proceso en 8787**: rechazado porque podría detener un servicio ajeno.
- **Aceptar el puerto alternativo de Wrangler**: rechazado porque Vite seguiría enviando `/api` a 8787.
- **Cambiar Vite dinámicamente al puerto elegido**: rechazado porque mantiene instancias duplicadas y agrega estado de coordinación innecesario.

## Consecuencias

- Repetir `npm run worker:dev` recupera el puerto esperado y carga nuevamente `.dev.vars`.
- Si 8787 pertenece a otra aplicación, el arranque falla de forma segura y requiere que el desarrollador resuelva el conflicto.
- El launcher debe probarse con procesos simulados para verificar detección, cierre ordenado, timeout y rechazo de procesos desconocidos.
