# Quickstart: Validación del sistema visual adaptable

1. En terminales separadas, iniciar el Worker API con `npm run worker:dev` y el cliente con `npm run dev`.
2. Abrir `http://localhost:5173/` y comprobar que el tema inicial sigue la preferencia del dispositivo.
3. Elegir Sistema, Claro y Oscuro en el selector; navegar entre Garita, Dashboard y Configuración; confirmar que toda la vista cambia de paleta y que la opción vuelve igual tras recargar.
4. Probar cada una de las tres vistas en 375x812; repetir a 320 px y 1280 px. Confirmar navegación, formularios, indicadores, listas y acciones, sin desplazamiento horizontal ni contenido cortado.
5. Recorrer selector, navegación y acciones de Garita por teclado; revisar foco, nombres accesibles, movimiento reducido, contraste y área táctil.
6. Ejecutar `npm run lint`, `npm run test:coverage`, `npm run typecheck`, `npm run build`, `npm audit` y `git diff --check`.

Los detalles contractuales están en [ui-system.md](contracts/ui-system.md); los roles y decisiones están en [design-system.md](design-system.md).
