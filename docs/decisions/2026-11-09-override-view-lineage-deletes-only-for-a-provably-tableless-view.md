# Override view lineage deletes a view's lineage only when a grammar parser finds it reads no table

- **Status:** Accepted
- **Revisions:** v1 2026-11-09 (initial)
- **Deciders:** OpenMetadata ingestion maintainers
- **Guard:** TestViewWithoutUpstream (`ingestion/tests/unit/lineage/test_lineage_processors.py`), test_delete_lineage_by_source_clears_the_view_lineage_of_the_entity
- **Related:** Issue #37091, PR #37430, Issue #37092

## Context

With `overrideViewLineage`, the sink deleted a view's old `ViewLineage` edges only while writing a
new edge into it. A view redefined to read no table produces no edge, so it kept its stale upstream.
But "no edge" does not mean "no upstream". A view also yields nothing when its definition is
missing, when parsing fails or times out, when its tables are not ingested yet, or when only the
SqlParse fallback accepted the SQL. SqlParse accepts SQL it cannot read and then reports no tables.
Deleting in any of those cases would erase correct lineage on a transient failure.
`LineageParser.query_parsing_success` cannot tell the cases apart, because it turns False as soon as
SqlGlot fails, even when SqlFluff then reads the view (`out`, a SqlGlot keyword, is one trigger).

## Decision

`get_view_lineage` yields `OMetaDeleteLineageBySource(entity=<view id>, source=ViewLineage)` only
when all of these hold:

- the view is in the catalog and has a definition;
- SqlGlot or SqlFluff parsed it, that is, `LineageParser.used_fallback_parser` is False;
- the parser reports no source tables (a table function or a table that is not ingested yet counts
  as a source);
- the connector's view-lineage extension yielded nothing;
- nothing raised on the way.

`query_parsing_success` is not part of the gate. `view_lineage_processor` forwards the record only
when `overrideViewLineage` is true.

`OMetaDeleteLineageBySource` means one thing for every producer: delete the upstream edges into
`entity` whose source is `source`, by id, or by FQN when the reference has no id. It never touches
downstream edges, edges from other sources, or other entities. The sink counts it neither as a
scanned record nor as a failure. Other producers that need a delete with no edge to carry it, such
as dbt (#37092), reuse this record with this meaning.

## Consequences

A parse failure, a missing definition or an upstream that is not ingested yet can no longer wipe
view lineage. The cost is that a view only SqlParse can read keeps its stale lineage until SqlGlot
or SqlFluff can read it. A view with no upstream does not get `processedLineage` patched, so under
`incrementalLineageProcessing` it is read again on every run and the delete repeats, which is a
no-op on the server. Databend runs its own delete path and is not covered here. Revisit the
fallback check if the parsers gain a reliable signal that a query was read in full.
