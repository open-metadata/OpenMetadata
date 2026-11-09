# dbt override lineage deletes a model's lineage only when its manifest declares no parent

- **Status:** Accepted
- **Revisions:** v1 2026-11-09 (initial)
- **Deciders:** OpenMetadata ingestion maintainers
- **Guard:** TestDbtOverrideLineageWithoutUpstream (`ingestion/tests/unit/test_dbt.py`), including test_the_delete_runs_before_query_lineage; TestDeleteLineageBySource (`ingestion/tests/unit/sink/test_metadata_rest_lineage.py`)
- **Related:** Issue #37092, PR #37429

## Context

With `overrideLineage`, the sink deleted a table's old `DbtLineage` edges only while writing a new
edge into it. A dbt model that no longer has parents produces no edge, so it kept its stale
upstream. An empty upstream list after resolution cannot be trusted for the same purpose: parents
that were filtered out, parents that are not in OpenMetadata yet, and models of another project all
leave it empty while the model still has upstream. The delete also has an ordering dependency that
no single file shows. `create_dbt_query_lineage` writes `DbtLineage` edges taken from the compiled
SQL into the same table, so a delete that ran after it would remove them.

## Decision

`create_dbt_lineage` yields `OMetaDeleteLineageBySource(entity=<table id>, source=DbtLineage)` when
`overrideLineage` is true and the node is a model or snapshot whose raw manifest
`depends_on.nodes` is empty (`DataModelLink.declared_no_upstream`). An empty resolved upstream never
triggers the delete, and seeds and sources never do.

The record deletes only the `DbtLineage` upstream edges into that table, by id, or by FQN when the
reference has no id. It never touches downstream edges, edges from other sources, or other
entities, and the sink counts it neither as a scanned record nor as a failure.

`create_dbt_lineage` stays registered before `create_dbt_query_lineage` in
`DbtServiceTopology.process_dbt_entities`, so the delete always runs before that model's
compiled-SQL edges are written.

## Consequences

A model whose parents are filtered out or not ingested yet keeps its lineage, at the cost that a
manifest which wrongly lists a parent leaves stale lineage in place. Reordering the dbt stages, or
moving the delete into another stage, has to keep it ahead of every stage that writes `DbtLineage`
for the same table; `test_the_delete_runs_before_query_lineage` fails otherwise. Revisit if dbt
lineage stops being written by more than one stage.
