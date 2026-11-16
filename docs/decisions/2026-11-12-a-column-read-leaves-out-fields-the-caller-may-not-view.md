# A column read leaves out fields the caller may not view

- **Status:** Accepted
- **Revisions:** v1 2026-11-12 (initial) · v2 2026-11-16 (`*` stands for the fields each endpoint returns for it)
- **Deciders:** Mohit Yadav
- **Guard:** `SubResourceAuthorizationIT.tableColumnReads_leaveOutProfilesAndMetricsTheCallerMayNotView`,
  `SubResourceAuthorizationIT.tableColumnWildcard_returnsTheColumnFieldsTheCallerMayView`,
  `ColumnFieldAccessTest`
- **Related:** ADR:2026-11-03-every-read-path-checks-the-fields-it-returns

## Context
A table's columns are read through `/v1/tables/{id}/columns`, `/v1/tables/name/{fqn}/columns`,
their `/search` variants and `/v1/columns/name/{fqn}`. Each needs ViewBasic on the table and can
also return two fields that the table's own reads guard with more: a column's `profile`
(ViewDataProfile, as on `tableProfile/latest` and `columnProfile`) and its `customMetrics`
(ViewTests, as on the table's `customMetrics` field). The schema tab and the column panel request
both fields for every caller.

## Decision
- `ColumnFieldAccess` takes the requested fields apart and keeps a field that names `profile` or
  `customMetrics` only when the caller holds that field's operation on the table. A field that
  merely contains one of those names is held to it too, since column enrichment matches requested
  fields by substring.
- `*` stands for the column fields the endpoint returns for it, and each of those is held to its
  own operation. A column search loads the table with every field for `*`, which fills in tags,
  `customMetrics` and `extension`, so `readableSearchFields` reads `*` as those three. The other
  column reads match fields by substring and return none of them for `*`, so `readableFields` leaves
  it out.
- The read still answers with the columns. A field the caller may not view is left out rather than
  the read refused, so a caller who may view the table keeps its schema tab and column panel.
- The decision is made on the table context the read was already authorized on; nothing is loaded
  again.

## Consequences
A column field cannot be read through a column endpoint by a caller its table's own read would
refuse it to, and a field that needs only ViewBasic is never lost to a missing ViewTests or
ViewDataProfile. A new restricted column field joins `ColumnFieldAccess.RESTRICTED_FIELDS`; a new
column endpoint passes its requested fields through `readableFields` or `readableSearchFields`
before enriching the columns; a change to what an endpoint returns for `*` changes its wildcard
fields in `ColumnFieldAccess`.

## Amendment — 2026-11-16: `*` stands for the fields each endpoint returns for it
v1 kept `*` only for a caller holding both ViewDataProfile and ViewTests. A column search returns
tags for `*`, which need only ViewBasic, so a caller holding just one of the two got no tags. `*` is
now read as the endpoint's own fields first, and each is held to its operation like any requested
field.
