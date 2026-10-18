# UI Contract: Flujo inteligente de patente en Garita

## Plate combobox

- Accessible name: `Patente`.
- The displayed plate keeps the existing `XX-XX-XX` format; matching ignores separators and letter case.
- During the initial active-session load, announce `Consultando vehículos activos…`; do not show suggestions or a movement action.
- After loading, a non-empty normalized prefix may expose a listbox with zero to five sessions from the current facility whose active plate starts with that prefix.
- Each option shows formatted plate, unit, space type, area/floating status, and entry time when those catalog values are available.
- Arrow Down/Up moves the active option. Enter selects it and fills the plate. Escape closes the list. The active option is announced through the combobox/listbox relationship.
- Typing a complete, valid plate that matches an active session shows that session's context and only `Registrar salida`.
- Typing a complete, valid plate without an active session shows only `Registrar entrada`.
- Selecting or highlighting a result does not register a movement. Exit requires activating `Registrar salida` explicitly.
- Incomplete or invalid plate input shows no movement action.
- Search filters client-side and issues no request for each keystroke.

## Entry confirmation

- `Registrar entrada` opens the existing form with unit, space category, and area/sector.
- The operator must explicitly submit the existing entry confirmation; selecting a suggestion cannot open or submit an entry for an active plate.
- Going back returns to plate input while retaining the selected destination as in the current guided flow.

## Errors and reconciliation

- Existing online, offline, conflict, and retry behavior remains in effect.
- Failed operations retain the formatted plate and any entry destination choices.
- Successful operations refresh/reconcile the existing active-session list.

## Responsive behavior

- The input, options, status, and available action remain readable and operable at 375 px and larger.
- Suggestion options and actions are usable by touch, keyboard, and assistive technology.
