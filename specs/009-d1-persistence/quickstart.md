# Quickstart: Verificar Persistencia Local con D1

## Requisitos

- Node.js y dependencias del proyecto instaladas.
- Un archivo `.dev.vars` local con `JWT_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `OPERATOR_USERNAME` y `OPERATOR_PASSWORD`. Crea la plantilla con `cp .dev.vars.example .dev.vars` y completa credenciales propias. No copies valores secretos a archivos versionados ni los compartas por consola.

## Inicializar

1. Aplicar las migraciones al D1 local y cargar el catálogo de desarrollo si la base está vacía:

   ```bash
   npm run db:local:init
   ```

2. Iniciar el Worker:

   ```bash
   npm run worker:dev
   ```

3. En otra terminal, iniciar la PWA:

   ```bash
   npm run dev
   ```

4. Iniciar sesión con las credenciales configuradas en `.dev.vars` y revisar que aparezcan la instalación y los catálogos base. D1 conserva identidad y rol; la contraseña permanece en `.dev.vars`.

## Validar persistencia

1. Crear o editar un área, unidad de negocio y reserva; reiniciar solo el Worker y comprobar que Configuración conserva los cambios.
2. Registrar una entrada; reiniciar solo el Worker y comprobar que Garita y Dashboard todavía muestran el vehículo activo.
3. Corregir la patente, registrar la salida y consultar el resultado; cada acción debe conservar su auditoría.
4. Habilitar modo offline en el navegador, crear una entrada, volver a habilitar la conexión y sincronizar. Repetir el envío de la misma mutación y comprobar que no se crea otra sesión ni auditoría.
5. Enviar una mutación con una versión obsoleta y comprobar que la API comunica el conflicto sin cambiar silenciosamente el registro más reciente.
6. Verificar el inicio como operador y administrador; el operador conserva sus restricciones de rol.

## Gates automatizados

```bash
npm run test:workers
npm run test:coverage
npm run typecheck
npm run lint
npm run build
npm audit
```

Las pruebas de integración aplican las migraciones sobre D1 local aislado. No ejecutar comandos `--remote`, no crear bases productivas y no resetear el almacenamiento local existente durante esta feature.
