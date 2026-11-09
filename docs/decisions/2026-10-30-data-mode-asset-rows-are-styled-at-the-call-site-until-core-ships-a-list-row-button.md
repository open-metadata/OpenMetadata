# Data mode's asset rows and legend labels are styled at the call site until core ships a list-row button and text colours

- **Status:** Accepted
- **Revisions:** v1 2026-10-30 (initial)
- **Deciders:** Sriharsha Chintalapani
- **Guard:** reviewer
- **Related:** ADR:2026-10-11-migrated-antd-components-adopt-core-styling, ADR:2026-10-23-landing-page-segmented-controls-are-styled-at-the-call-site, ADR:2026-10-26-conversation-drawers-style-the-reply-count-and-message-like-the-inbox, open-metadata/OpenMetadata#36714, open-metadata/OpenMetadata#36724

## Context
Ontology Studio's Data mode lists a concept's bound assets as full-width rows inside a card, divided
by a rule, and shows the card's name in a header row of the same shape. No core component expresses
a row. Every core `Button` size sets its own radius and padding (`button.tsx:46-87`: `rounded-md px-2`
for `xs`, `rounded-lg px-3` to `px-4` for the rest), and none is full-bleed. The `tertiary` colour
also sets `text-tertiary`, so the name inside the row inherits a muted colour. `TypographyColor` is
`secondary | success | warning | danger | brand` (`typography.tsx:74`); it has no primary text step
and no `text-secondary` step, and `secondary` maps to `text-tertiary`.

## Decision
Until `@openmetadata/ui-core-components` ships a full-bleed list-row `Button` variant and a primary
and a secondary `Typography` colour, these Data mode elements may restyle core components from the
call site, as an exception to ADR:2026-10-11-migrated-antd-components-adopt-core-styling:

- the asset row `Button` in `OntologyDataGraph.tsx` — `tw:rounded-none tw:px-5 tw:py-3` and, on every
  row after the first, the `tw:border-t tw:border-secondary` divider;
- the concept card's header `Button` in the same file — `tw:rounded-none tw:px-5 tw:py-3.5` and its
  `tw:border-b tw:border-secondary`, which predates #36724 and has the same shape;
- the asset name `Typography` in the row, and the card name `Typography` in the header — `tw:text-primary`,
  which lifts the name out of the button's `text-tertiary`;
- the legend label `Typography` in `OntologyDataGraphChrome.tsx` — `tw:text-secondary`, a step darker
  than `color="secondary"` and a step lighter than the primary text it would otherwise inherit.

The overrides stay in those two modules; no other call site copies them. Every other `Typography`
colour in Data mode uses the `color` prop.

## Consequences
These rows can drift when core changes `Button` radius or padding or the `tertiary` colours, so a
core change to them is checked against Data mode in both themes. When core ships a full-bleed
list-row variant and a primary and a secondary text colour, these call sites move to them and this
record is superseded.
