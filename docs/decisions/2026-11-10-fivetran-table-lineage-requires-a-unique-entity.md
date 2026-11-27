# Fivetran table lineage requires a unique active entity

- **Status:** Accepted
- **Revisions:** v1 2026-11-10 (initial)
- **Deciders:** Vamsi-klu
- **Guard:** `TestFivetranUniqueTableLineage` in `ingestion/tests/unit/topology/pipeline/test_fivetran.py`
- **Related:** https://github.com/open-metadata/OpenMetadata/issues/36948; https://github.com/open-metadata/OpenMetadata/pull/31266

## Context

Several database services can contain the same database, schema and table names.
Fivetran previously selected the first matching service, assigning lineage to the
wrong source when service order was the only distinction. Its source metadata does
not supply a reliable OpenMetadata service identity. The issue accepts warning and
skipping an ambiguous edge.

## Decision

Resolve each table endpoint across all configured database services as peers.
Deduplicate by entity ID and emit the edge only when exactly one active entity
matches. Missing database or schema names retain their FQN positions as wildcards;
supplied name components stay literal. The no-service fallback introduced in
#31266 remains available, but it also requires a unique entity.

Use the existing entity resolver's exact-first policy, completeness checks and
bounds, including 10 candidates per lookup, 100 candidates per plan and 512 cache
entries. An incomplete or failed lookup cannot establish uniqueness after another
service matched. Each table lookup owns and closes its resolver while borrowing
the metadata client, so no match or ambiguity state survives the lookup.

Warn for ambiguous or failed source and destination resolution even when another
table in the pipeline succeeds. Include the pipeline, logical table and at most
two candidate FQNs, without transport exception payloads. Do not request column
lineage for a rejected endpoint. Topic resolution keeps its existing behavior.

## Consequences

Ambiguous deployments emit fewer edges instead of new edges with guessed
identities. Operators can use one Fivetran ingestion agent per source service,
with a matching `pipelineFilterPattern` and only that service in `dbServiceNames`.
Restrict the set only when it identifies both endpoints of the intended edge.

This change does not delete wrong lineage from previous runs. Cleanup requires a
separate operation with explicit edge ownership. Automatic host-based service
inference would need its own identity contract and is outside this decision.
