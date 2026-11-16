# Wells and secondary buttons inside a surface card fill with bg-primary, and inline forms use the active card

- **Status:** Accepted
- **Revisions:** v1 2026-11-16 (initial)
- **Deciders:** UI team (Ontology Studio dark-mode design review)
- **Guard:** reviewer; `card.test.tsx` and `button.test.tsx` in `openmetadata-ui-core-components`
- **Related:** ADR:2026-10-12-dark-mode-targets-ai-mode-core-surfaces-only, ADR:2026-10-11-migrated-antd-components-adopt-core-styling

## Context
In dark mode a card is `bg-surface` (gray-800). Secondary buttons and the lists and read-only blocks
nested inside a card used the same `bg-surface`, so they merged with the card they sat on. The
Ontology Studio design review asked for those nested elements to use the page tone (gray-950) and
for every inline add/edit form to carry the brand edge the rules form already had. Call sites could
not reach those colours without `tw:dark:*` overrides on core components, which the styling rules
forbid.

## Decision
- The core `Card` gains two variants. `inset` (`border-secondary`, `bg-primary`) is a list or
  read-only block inside a surface. `active` (`border-brand`, `bg-surface`, a 4px
  `utility-brand-100` outline) is an inline add/edit form.
- Every `secondary*` `Button` colour and the `secondary` `ButtonUtility` fill with `bg-primary`
  instead of `bg-surface`.
- `bg-primary` and `bg-surface` are both white in light mode, so light mode is unchanged. In dark
  mode these elements now read as recessed against the card around them.

## Consequences
Callers pick `variant="inset"` or `variant="active"` instead of hand-rolling a bordered box with
background classes. A secondary button placed directly on the dark page (no card) now matches the
page fill and relies on its outline for its edge. A hand-built segmented control that marked the
selected option with a secondary button loses its selected state, so it must use core `Tabs`
instead.
