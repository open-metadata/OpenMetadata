# Toolbar filter triggers turn brand-coloured only while they filter

- **Status:** Accepted
- **Revisions:** v1 2026-11-06 (initial)
- **Deciders:** Harshit Shah, Chirag Madlani
- **Guard:** `Execution.component.test.tsx` (trigger neutral by default, brand once a status is picked); reviewer
- **Related:** core `FilterSelect` (`selectedTriggerClassName`, `TriggerCountBadge`)

## Context
The Pipeline Executions status trigger was always blue while it read "Status" for the default
"All", so it looked active with no visible value. The Data Quality "Advanced" trigger was
always blue too. Core `FilterSelect` already draws a neutral trigger that turns blue (with a
count badge for multi-select) once a value is picked; hand-built `Dropdown` filters drifted from it.

## Decision
- A toolbar filter trigger is neutral (secondary button, field name as label) while it does not
  narrow the results: no selection, "All", or its default selection.
- Once it narrows the results it shows the value (single-select) or the count (multi-select) and
  takes the brand look from core `selectedTriggerClassName(true)` / `TriggerCountBadge`.
- A trigger that only chooses which filter fields are shown (e.g. "Advanced") is not a filter and
  stays neutral.
- Prefer core `FilterSelect`; a filter built on `Dropdown` reuses the two core exports above
  instead of its own brand classes.

## Consequences
Blue always means "this narrows what you see". Hand-built triggers follow the core look without
re-declaring its classes. Revisit if design wants the default value echoed on a neutral trigger.
