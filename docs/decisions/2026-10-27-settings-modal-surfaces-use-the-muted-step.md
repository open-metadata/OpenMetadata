# Settings-modal panels sit on the muted step, and a muted container never nests another

- **Status:** Accepted
- **Revisions:** v1 2026-10-27 (initial)
- **Deciders:** Rohit Jain
- **Guard:** reviewer; `table.test.tsx` and `field-doc-popover.test.tsx` pin the muted variants
- **Related:** open-metadata/openmetadata-collate#7851, ADR:2026-10-12-dark-mode-targets-ai-mode-core-surfaces-only

## Context
The settings modal's panel is `bg-overlay-surface`, which in dark mode is the same gray-800 as
`bg-surface`. Cards, tables, accordions and field-hint popovers built on the default surface
therefore vanished into the modal; a table's 8%-white outline over its own rows landed on the
modal's colour, so the header lost its top edge, and the `bg-secondary` row hover equalled the row.

## Decision
- Every section-level container inside the settings modal uses the muted step (`bg-primary_alt`,
  gray-900 in dark, white in light): `Card variant="muted"`, `TableCard.Root variant="muted"`,
  legacy `TableV2 variant="muted"`, `FieldDocPopover variant="muted"` (`HookForm`
  `fieldDocVariant="muted"`), `AccordionItem variant="muted"`.
- The muted table variants carry their own frame (`border-primary` in dark), outer-table row
  background and a translucent `primary_hover` row hover; nested tables keep the default.
- A muted container never holds another muted one: a card, skeleton or table nested inside a
  muted container uses `default`.
- The look is expressed through core variants, not call-site colour classes, so a shared component
  reused on a classic page keeps its default; shared components take a `variant` prop that only the
  modal sets.

## Consequences
A new settings-modal panel picks a variant instead of inventing a background. Light mode is
unchanged (muted and default are both white). Revisit if the modal panel stops being the surface
colour in dark mode, at which point the default step would no longer blend in.
