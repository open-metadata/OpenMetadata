# Numeric fields preserve decimal edits and nullable API values

- **Status:** Accepted
- **Revisions:** v1 2026-10-12 (initial)
- **Deciders:** Harshit Shah
- **Guard:** core `number-input.test.tsx`, `ProfilerSettingsModal.test.tsx`, `ContractSLAFormTab.utils.test.ts`
- **Related:** open-metadata/openmetadata-collate#7302, open-metadata/openmetadata-collate#7303

## Context
Migrating numeric fields must retain decimal editing, clearing, bounds, and numeric payloads.
A grid-based stepper changes 3.5 to 5 with a step of 1; existing fields increment it to 4.5.
Browser step/min validation can also reject stored profiler samples of zero when saving an
otherwise untouched configuration. Clearing a field must remain distinguishable from zero.

## Decision
Core `NumberInput` maintains an editable string and reports finite numbers or `null`. Bounds
apply when editing is committed; loading a controlled value does not silently rewrite it.
Arrow keys add the requested step relative to the edited value rather than snapping to a grid.
Native spinner buttons are hidden because they use grid stepping. Decimal arithmetic avoids
binary rounding drift; explicit precision is limited to 0–20 fractional digits.

Forms bind numeric callbacks directly to React Hook Form. Serializers distinguish `null` from
zero and omit cleared optional durations. Wall-clock SLA availability remains an HH:mm string;
selecting a timezone does not convert that clock time.

## Consequences
Core owns numeric behavior and styling. Callers keep domain validation and serialization,
including compatibility with existing stored values. These contracts are covered by interaction
and payload tests rather than assertions about Ant Design markup.
