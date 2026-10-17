# ADR-010: Remediación de dependencias vulnerables de Drizzle

* **Estado**: Aceptado
* **Fecha**: 2026-10-17
* **Decisores**: Líder del Proyecto y equipo de implementación

## Contexto y Declaración del Problema

`npm audit` identificó una vulnerabilidad alta de inyección SQL en `drizzle-orm` hasta la versión 0.45.1 y cuatro hallazgos moderados en `esbuild` arrastrados por `drizzle-kit`. La aplicación declara tablas con Drizzle; no construye identificadores SQL con datos recibidos de usuarios.

## Decisión

Actualizar `drizzle-orm` a `^0.45.4`, versión posterior a la corrección publicada. Retirar `drizzle-kit` del árbol de desarrollo porque el repositorio no tiene configuración de Drizzle Kit, scripts que lo ejecuten ni archivos de migración; tampoco existe el directorio indicado para migraciones. Se conserva Wrangler para la configuración D1 existente.

## Alternativas Consideradas

### Forzar un override de `esbuild` dentro de `@esbuild-kit/core-utils`

Descartada porque `core-utils` declara `esbuild ~0.18.20`; un override local quedó fuera del rango declarado y npm mantuvo esa versión vulnerable en el lockfile.

### Aplicar `npm audit fix --force`

Descartada porque npm proponía cambios incompatibles, incluido bajar `drizzle-kit` a 0.18.1, sin aportar una herramienta en uso que justificara conservar ese riesgo.

## Consecuencias

* `drizzle-orm` queda en una versión corregida y compatible con el esquema SQLite actual, verificado mediante typecheck y pruebas.
* `drizzle-kit` deja de instalarse; si el proyecto incorpora generación de migraciones con ese CLI, deberá añadirse nuevamente desde una versión que no vuelva a introducir dependencias vulnerables.
* `npm audit` y `npm audit --omit=dev` terminan sin vulnerabilidades.

## Referencias

* [Advisory GHSA-gpj5-g38j-94v9](https://github.com/drizzle-team/drizzle-orm/security/advisories/GHSA-gpj5-g38j-94v9)
* [Releases oficiales de Drizzle ORM](https://github.com/drizzle-team/drizzle-orm/releases)
