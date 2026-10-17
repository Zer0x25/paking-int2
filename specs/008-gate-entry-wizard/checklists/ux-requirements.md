# UX Requirement Quality Checklist: Flujo guiado de garita

**Purpose**: Evaluate whether the operator-flow requirements are complete and clear. Checkbox state belongs to the reviewer.
**Feature**: [spec.md](../spec.md)

## Requirement Completeness

- [ ] Does the initial-step requirement say which controls are available before a valid plate is entered?
- [ ] Does the movement requirement define what selecting Salida does with the entered plate?
- [ ] Does the entry requirement name every value that must be reviewed before a session is created?
- [ ] Does the specification cover returning to earlier steps and preserving corrections?
- [ ] Does the specification distinguish operation errors from successful completion and reset?

## Requirement Clarity

- [ ] Is the meaning of automatic/floating assignment for area/sector explicit?
- [ ] Is it unambiguous when the entry request is allowed to be submitted?
- [ ] Is the plate format requirement consistent across step validation and displayed format?

## Scenario and Edge-Case Coverage

- [ ] Are invalid plate, duplicate active entry and missing active exit cases covered?
- [ ] Are online and offline outcomes covered without changing existing behavior?
- [ ] Are active-list quick exit and active-session plate correction explicitly preserved?
- [ ] Are keyboard, accessible feedback and mobile-width constraints stated?
