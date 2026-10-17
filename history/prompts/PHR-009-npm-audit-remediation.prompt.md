---
id: PHR-009
stage: dependency-security-remediation
date: 2026-10-17
branch: 006-responsive-design-system
command: interactive dependency audit request
model: Codex GPT-6
---

# PHR-009: Remediación de `npm audit`

## Prompt del usuario

> commit, verifica y soluciona npm audit

## Hallazgos iniciales

- `npm audit` reportó cinco vulnerabilidades: una alta en `drizzle-orm <0.45.2` y cuatro moderadas en `drizzle-kit`/`esbuild`.
- `npm audit --omit=dev` confirmó que el hallazgo alto estaba en dependencias de producción.
- El proyecto usaba `drizzle-orm` únicamente para declarar el esquema SQLite; `drizzle-kit` no aparecía en scripts, configuración ni migraciones presentes en el repositorio.

## Remediación aplicada

- Actualizar `drizzle-orm` de `^0.38.3` a `^0.45.4` para incluir la corrección publicada para el problema de escape de identificadores SQL.
- Retirar `drizzle-kit` de dependencias de desarrollo porque no se usa y su cadena `@esbuild-kit/core-utils` seguía instalando `esbuild@0.18.20` vulnerable.
- No aplicar `npm audit fix --force` ni mantener un override fuera del rango declarado por el paquete transitivo.
- Registrar la decisión en [ADR-010](../adr/ADR-010-drizzle-security-remediation.md).

## Verificación

- `npm audit`: 0 vulnerabilidades.
- `npm audit --omit=dev`: 0 vulnerabilidades.
- `npm ls drizzle-orm drizzle-kit esbuild --all`: ORM en 0.45.4; no queda Drizzle Kit ni `esbuild` anterior a 0.25.0.
- `npm run lint`: correcto.
- `npm run typecheck`: correcto para cliente y Worker.
- `npm run test:coverage`: 21 archivos, 153 pruebas unitarias y 1 prueba Worker aprobadas; cobertura 94.09% sentencias, 85.06% ramas, 93.85% funciones y 94.67% líneas.
- `npm run build`: correcto; PWA y service worker generados.
- Commit solicitado: esta remediación y su registro se incluyen en el commit de cierre.
