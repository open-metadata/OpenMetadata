# An empty child-field page carries no paging cursors

- **Status:** Accepted
- **Revisions:** v1 2026-11-25 (initial)
- **Deciders:** UI and platform maintainers
- **Guard:** `ChildFieldPaginationIT.dataModelColumns_emptyCollection_hasNoCursors`, `ChildFieldEdgeMatrixIT.emptyChildArray_paginatedReadHasNoCursors`
- **Related:** #38665 (the bug), #34182 (the refactor that froze the old shape)

## Context
The paginated child endpoints (`/v1/<entity>/name/{fqn}/columns` for tables, dashboard data models,
topics, containers, pipelines, mlmodels, search indexes, worksheets) answered an entity with no
children with `before: "0"` and `after: offset + limit`. #34182 kept that byte-for-byte to prove its
refactor changed no behavior. The UI's cursor pager trusts `after`, so an empty data model rendered
"Page 1 of 2", and every Next advanced the offset and minted another `after`: "Page 2 of 3", forever.
No SDK or ingestion client pages these endpoints by `after`.

## Decision
An empty child collection returns `data: []`, `total: 0` and no `before` or `after`, the same shape
the column search endpoints already return. A non-empty page keeps its rules: `before` only when
`offset > 0`, `after` only when rows remain.

## Consequences
Pagers hide on empty children without special-casing, and the UI needs no guard of its own: it
ships in the same artifact as the server. Revisit only if a client is found that needs a cursor
past an empty set.
