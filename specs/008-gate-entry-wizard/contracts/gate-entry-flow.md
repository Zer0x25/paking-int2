# UI Contract: Gate Entry Flow

## State sequence

```text
plate --valid Registrar--> movement --Entrada--> entry-details --Confirmar entrada--> plate
                                  |                          |
                                  +-- Salida / execute ------+--> plate on success
             movement <-------- Volver -------- entry-details
             plate <---------- Volver ---------- movement
```

## Step contract

| Step | Visible controls | Action | Required behavior |
|---|---|---|---|
| `plate` | Patente, format hint, Registrar | Validate and continue | Keep the step and announce an error for invalid format; otherwise keep normalized plate and show movement choices |
| `movement` | Formatted plate, Entrada, Salida, Volver | Choose movement | Entrada opens destination review; Salida calls the existing exit path with this plate |
| `entry-details` | Formatted plate, unit, space type, area/sector, Confirmar entrada, Volver | Confirm or return | Create an entry only on explicit confirmation; return preserves all selections |

## Operation behavior

- Entry and exit retain the existing online requests and offline local persistence/outbox behavior.
- Entry success retains the existing ticket/confirmation and active-list refresh.
- Exit success retains the current success message and active-list refresh.
- Validation and operation failures retain the entered plate and keep the operator at the relevant step.
- Success resets the wizard for the next vehicle.
- Active list quick-exit and active-session plate correction remain available.

## Accessibility and responsive behavior

- Each step has a visible heading or step label and an accessible name for every input and action.
- Validation failures use an alert; operation results use a status announcement.
- Movement choices and back/confirm actions are keyboard-operable buttons with visible focus.
- The controls reflow at 375 px and use existing semantic light/dark tokens.
