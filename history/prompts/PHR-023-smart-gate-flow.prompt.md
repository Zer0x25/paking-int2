---
id: PHR-023
stage: implementation
date: 2026-10-18
branch: 014-smart-gate-flow
command: user-approved implementation and verification of the smart gate flow
model: Codex GPT-6
---

# PHR-023: Flujo inteligente de patente en Garita

## Solicitud

> El usuario aprobó implementar el flujo para que Garita determine automáticamente la acción permitida según si la patente ya tiene una sesión activa y permita buscar vehículos dentro mientras se escribe.

## Decisiones aplicadas

- Se consultan las sesiones activas ya cargadas para el recinto, usando las funciones existentes para normalizar patentes; no se agregó una llamada por tecla, endpoint, tabla ni dependencia.
- Una patente activa muestra el contexto del vehículo y solo permite iniciar una salida explícita. Seleccionar una sugerencia completa la patente, pero no registra el movimiento.
- Una patente válida sin sesión activa ofrece solo continuar con entrada y conserva la confirmación existente de unidad, tipo de espacio y área/sector.
- Se mantuvieron el manejo existente de sesiones offline, cola de mutaciones y conflictos. No se agregó un ADR porque no cambió la arquitectura ni los contratos de datos.

## Trabajo realizado

- Se escribieron primero pruebas de interacción para los dos escenarios y se mostró el estado rojo antes de editar código de producción (15 pruebas fallidas y 1 pasada en el baseline enfocado).
- Se implementaron decisión por sesión activa, sugerencias normalizadas limitadas a cinco vehículos del recinto, contexto de unidad/espacio/sector y navegación de combobox con flechas, Enter y Escape.
- Se adaptaron los estilos de las sugerencias y acciones para pantallas estrechas.
- Se actualizaron las tareas de T001 a T009 como completas.

## Verificación

- `npm test`: 41 archivos de pruebas unitarias con 229 pruebas pasadas y 10 archivos de Workers con 41 pruebas pasadas.
- `npm run test:coverage`: unitarias con 93.92% statements, 88.61% branches, 94.24% functions y 95.43% lines; Workers con 91.09% statements, 85.08% branches, 89.50% functions y 94.48% lines.
- `npm run typecheck`, `npm run lint`, `npm run build` y `git diff --check`: aprobados.
- En navegador local real: una patente activa parcial mostró su sugerencia y datos de contexto; al completar/seleccionar la patente apareció únicamente “Registrar salida”. Una patente válida no activa mostró únicamente “Registrar entrada”. Se probó Arrow Down y Enter; no se ejecutó ninguna entrada ni salida sobre los registros locales.
- A 375 × 812 px, Garita y la lista de vehículos activos se apilaron en una columna; las acciones ocuparon el ancho disponible. Después se restauró el tamaño normal del navegador y se limpió la patente de prueba.

## Límites

- No se hizo commit, push ni despliegue.
- El checklist UX sigue siendo un artefacto de revisión de requisitos: sus 11 criterios permanecen sin marcar; la aprobación del usuario permitió continuar con la implementación.

## Archivos modificados

- `src/client/components/VehicleGatePanel.tsx`
- `src/client/index.css`
- `tests/unit/client/test_gate_entry_wizard.test.tsx`
- `tests/unit/client/test_vehicle_gate_panel.test.tsx`
- `specs/014-smart-gate-flow/`
- Este registro PHR.
