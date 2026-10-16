# react-hook-form rules are the only validation that blocks a HookForm submit

- **Status:** Accepted
- **Revisions:** v1 2026-10-13 (initial)
- **Deciders:** Harshit Shah
- **Guard:** `openmetadata-ui-core-components/src/main/resources/ui/src/components/base/form/hook-form.test.tsx`
- **Related:** open-metadata/OpenMetadata#35285

## Context
`HookForm` wraps react-aria's `Form`, which validated natively by default. A core field with
`isRequired` rendered a native `required` attribute, so the browser blocked the submit event
before react-hook-form ran: no inline message appeared, and react-hook-form never validated the
form (the KPI and semantics forms showed this). Mixing the two validators also left two sources
of truth for whether a field is required.

## Decision
`HookForm` sets react-aria `validationBehavior="aria"` by default. Inside a `HookForm`,
react-hook-form `rules` are the only thing that blocks submit; `isRequired` on a core control is
presentational (asterisk and ARIA state). Every required field carries a react-hook-form
`required` rule: `FieldProp.required` adds one automatically for `FormFields`/`getField`, and a
render-prop `FormField` passes it in `rules`. A control bound outside `FormField` (for example
through `form.setValue`) validates in the submit handler or is gated by a disabled submit.

## Consequences
Errors render inline through `fieldState` in every `HookForm`. A field marked `isRequired`
without a matching rule is not enforced, so reviewers check new required fields for the rule.
A caller that needs native validation passes `validationBehavior="native"` explicitly.
