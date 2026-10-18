# Quickstart: Flujo inteligente de patente en Garita

## Prerequisites

- Node dependencies are installed.
- Local Worker variables and local D1 setup are available as described by the repository's development setup. Do not copy credentials into this guide.
- The local Worker/PWA is running with the repository's supported dev command (`npm run worker:dev`).

## Automated validation

1. Run the focused gate component suite:

   ```sh
   npx vitest run tests/unit/client/test_gate_entry_wizard.test.tsx
   ```

2. Run the complete local checks:

   ```sh
   npm test
   npm run typecheck
   npm run lint
   npm run build
   ```

## Observable scenarios

1. Load Garita with one active session. Type its plate with mixed case or without hyphens. Confirm the formatted exact plate shows only `Registrar salida`; selecting a suggestion alone does not change the active list.
2. Type a partial prefix shared by active sessions. Confirm no more than five current-facility results appear. Navigate with arrow keys, select with Enter, then activate `Registrar salida` explicitly.
3. Type a complete plate with no active session. Confirm only `Registrar entrada` appears; open it and confirm unit, space type, and area before submitting.
4. Force an entry/exit conflict or failed request. Confirm the plate remains available for correction/retry and the list reconciles through existing behavior.
5. Disconnect the browser and confirm local active sessions still drive suggestions and exit uses the current offline mutation flow.
6. Repeat the primary flows at 375 px and with keyboard-only navigation.

Expected outcome: movement is inferred from the active session list, search creates no network request per keystroke, and all writes continue through existing entry/exit handlers.
