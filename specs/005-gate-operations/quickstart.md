# Quickstart: Verificación de Operación de Garita

1. Iniciar la PWA y el Worker de desarrollo según el procedimiento existente del proyecto.
2. Iniciar sesión como operador o administrador y abrir **Garita Operativa**.
3. Confirmar que se muestra una ficha con los controles **Entrada** y **Salida**, y debajo la lista de vehículos activos.
4. Registrar una entrada con una patente como `aa1a11`; comprobar que aparece como `AA-1A-11` con hora, unidad y área.
5. Usar **Editar patente** en esa fila; confirmar que se actualiza la patente y se conserva la hora.
6. Registrar la salida desde esa misma fila sin escribir la patente; confirmar que la fila desaparece y Dashboard actualiza ocupación.
7. Probar la salida manual desde el modo **Salida**.
8. Repetir una entrada, desactivar la conectividad del navegador y comprobar que la sesión/corrección/salida se reflejan localmente y aparecen como pendientes de sincronizar.
9. Probar longitudes distintas de seis caracteres, duplicados activos y conflicto de versión; comprobar que cada error explica el motivo y conserva los datos anteriores.

Comprobaciones de código: `npm run test:coverage`, `npm run typecheck`, `npm run build` y `git diff --check`.
