# A column read leaves out fields the caller may not view

- **Status:** Accepted
- **Revisions:** v1 2026-11-12 (initial)
- **Deciders:** Mohit Yadav
- **Guard:** `SubResourceAuthorizationIT.tableColumnReads_leaveOutProfilesAndMetricsTheCallerMayNotView`
- **Related:** ADR:2026-11-03-every-read-path-checks-the-fields-it-returns

## Context
A table's columns are read through `/v1/tables/{id}/columns`, `/v1/tables/name/{fqn}/columns`,
their `/search` variants and `/v1/columns/name/{fqn}`. Each needs ViewBasic on the table and can
also return two fields that the table's own reads guard with more: a column's `profile`
(ViewDataProfile, as on `tableProfile/latest` and `columnProfile`) and its `customMetrics`
(ViewTests, as on the table's `customMetrics` field). The schema tab and the column panel request
both fields for every caller.

## Decision
- `ColumnFieldAccess.readableFields` takes the requested fields apart and keeps a field that names
  `profile` or `customMetrics` only when the caller holds that field's operation on the table. A
  field that merely contains one of those names, and the `*` wildcard, are held to it too, since
  column enrichment matches requested fields by substring.
- The read still answers with the columns. A field the caller may not view is left out rather than
  the read refused, so a caller who may view the table keeps its schema tab and column panel.
- The decision is made on the table context the read was already authorized on; nothing is loaded
  again.

## Consequences
A column field cannot be read through a column endpoint by a caller its table's own read would
refuse it to. A new restricted column field joins `ColumnFieldAccess.RESTRICTED_FIELDS`; a new column
endpoint passes its requested fields through `readableFields` before enriching the columns.
