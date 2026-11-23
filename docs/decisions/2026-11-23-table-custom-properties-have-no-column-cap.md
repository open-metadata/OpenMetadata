# Table custom properties have no column cap; the UI shows three columns and scrolls

- **Status:** Accepted
- **Revisions:** v1 2026-11-23 (initial)
- **Deciders:** Rohit0301
- **Guard:** `TypeResourceIT.test_tableCustomPropertyStoresValueWithTenColumns`, `TablePropertyValue.test.tsx`
- **Related:** #38473

## Context
Table-type custom properties were capped at three columns in three places: `tableConfig.json`
(`maxItems`, `maxColumns` default), the `table-cp` value schema in `complexTypes.json`, and the
create form. The cap kept tables readable on asset pages, but customers need more columns.

## Decision
- No upper bound on columns: neither schema sets `maxItems`, `TypeRepository` checks only the
  minimum, and the create form has no count rule. `TableConfig.maxColumns` stays in the schema,
  unenforced, so stored configs that carry it still validate under `additionalProperties: false`.
- Every UI surface renders the value through `TablePropertyValue.tsx`. Each column takes a third of
  its container (`100cqw/3`), so at most three columns are visible and the rest scroll horizontally,
  whatever the host width (230px schema cell to 960px modal).
- A container-query host needs a definite width: a host that sizes to its content collapses it to
  zero, so wide values render in a full-width slot (`CustomPropertyRow`).

## Consequences
Existing deployments pick up the relaxed `table-cp` schema when field types are re-seeded at
startup; no migration. Very wide tables cost only horizontal scroll. Reintroducing a cap means
re-adding it in both schemas and the form.
