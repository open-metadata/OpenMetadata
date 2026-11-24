# Table custom properties have no column cap; the UI caps column width and scrolls

- **Status:** Accepted
- **Revisions:** v1 2026-11-23 (initial)
- **Deciders:** Rohit0301
- **Guard:** `TypeResourceIT.test_tableCustomPropertyStoresValueWithTenColumns` (schemas + backend), `CustomPropertyRow.test.tsx` (full-width host), `TablePropertyValue.test.tsx` (edge shadows); column widths themselves are reviewer-checked (jsdom has no layout)
- **Related:** #38473

## Context
Table-type custom properties were capped at three columns in three places: `tableConfig.json`
(`maxItems`, `maxColumns` default), the `table-cp` value schema in `complexTypes.json`, and the
create form. The cap kept tables readable on asset pages, but customers need more columns.

## Decision
- No upper bound on columns: neither schema sets `maxItems`, `TypeRepository` checks only the
  minimum, and the create form has no count rule. `TableConfig.maxColumns` stays in the schema,
  unenforced, so stored configs that carry it still validate under `additionalProperties: false`.
- Every UI surface renders the value through `TablePropertyValue.tsx`. A column is a third of its
  container, capped at 12rem: `min(100cqw/3, 12rem)`. Hosts narrower than about 36rem (the 230px
  schema cell) show three columns; wider hosts show more, at 12rem each (about four in the 960px
  modal, five or six on full-width cards). The rest scroll horizontally. The cap is a design
  choice: a third of a wide card left mostly-empty columns.
- Whichever edge hides columns carries a shadow, the same treatment as the core card `Tabs`. It
  is the only scroll cue where the scrollbar is an overlay (macOS). The shadow lives in
  ui-core-components so any table can opt in: `<Table scrollShadows>`, or `ScrollShadow` around
  non-core content (`endShadowClassName` insets the end shadow before a pinned column, as the
  editor's delete column needs). Both use `useOverflowEdges`, shared with the card `Tabs`.
- A container-query host needs a definite width: a host that sizes to its content collapses it to
  zero, so wide values render in a full-width slot (`CustomPropertyRow`, `ColumnCustomPropertyCell`).

## Consequences
Existing deployments pick up the relaxed `table-cp` schema when field types are re-seeded at
startup; no migration. Very wide tables cost only horizontal scroll. Reintroducing a cap means
re-adding it in both schemas and the form.
