# Dashboard chart batches only create missing lineage

- **Status:** Accepted
- **Revisions:** v1 2026-11-26 (initial)
- **Deciders:** OpenMetadata contributors
- **Guard:** `LineageResourceIT` and `test_dashboard_chart_lineage.py`
- **Related:** [#38698](https://github.com/open-metadata/OpenMetadata/issues/38698)

## Context

Dashboard ingestion was checking each structural edge over HTTP. An ordinary lineage PUT can replace
fields on an existing edge, including a description, a pipeline, or SQL supplied by another writer.
Dashboard requests may also succeed for fewer charts than the connector attempted to write.

## Decision

The worker reads committed dashboard membership and submits at most 100 distinct pairs per batch.
The server validates current membership, requires lineage view and edit access to both endpoints, and
atomically inserts missing edges. An existing relationship returns `present` without updating the
relationship or emitting a change event. The result for each pair is returned in request order.

The worker checks the authenticated capability route once per workflow. Servers without the route and
override runs use the existing flow. Other failures surface in ingestion status.

## Consequences

Retries can safely resubmit a batch after a lost response. The worker still reads dashboard membership,
and connector stages that read their own writes still flush before those reads. Membership and active
endpoints are checked again in the server transaction so a stale worker read cannot add an edge.
