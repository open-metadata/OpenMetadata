# An empty child-field page carries no paging cursors

- **Status:** Accepted
- **Revisions:** v1 2026-11-25 (initial) · v2 2026-11-25 (2.0 backport)
- **Deciders:** UI and platform maintainers
- **Guard:** `TableResourceIT#get_tableColumns_emptyTable_hasNoCursors`, `DashboardDataModelResourceIT#get_dataModelColumns_emptyModel_hasNoCursors`
- **Related:** [Issue #38665](https://github.com/open-metadata/OpenMetadata/issues/38665),
  [PR #38666](https://github.com/open-metadata/OpenMetadata/pull/38666) (the fix and its record on
  main, where `ChildFieldPageReader` serves every child endpoint)

## Context
The paginated column endpoints (`/v1/tables/name/{fqn}/columns` and
`/v1/dashboard/datamodels/name/{fqn}/columns`) answered an entity with no columns with
`before: "0"` and `after: offset + limit`. The UI's cursor pager trusts `after`, so an empty data
model rendered "Page 1 of 2", and every Next advanced the offset and minted another `after`:
"Page 2 of 3", forever. No SDK or ingestion client pages these endpoints by `after`.

## Decision
An empty column collection returns `data: []`, `total: 0` and no `before` or `after`, the same shape
the column search endpoints already return. A non-empty page keeps its rules: `before` only when
`offset > 0`, `after` only when rows remain.

## Consequences
Pagers hide on empty children without special-casing, and the UI needs no guard of its own: it
ships in the same artifact as the server. Revisit only if a client is found that needs a cursor
past an empty set.
