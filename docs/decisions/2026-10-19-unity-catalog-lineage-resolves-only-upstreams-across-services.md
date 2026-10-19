# Unity Catalog lineage resolves only upstreams across services

- **Status:** Accepted
- **Revisions:** v1 2026-10-19 (initial)
- **Deciders:** Ingestion maintainers (#35756)
- **Guard:** `TestCrossServiceLineage` in `ingestion/tests/unit/topology/database/test_unity_catalog_lineage.py`
- **Related:** #35755, #35756

## Context
`system.access.table_lineage` and `column_lineage` cover the whole metastore, but a metastore is
often ingested as several database services (one per environment or catalog group). Each service's
lineage run sees every edge in the metastore and resolved both ends in its own `serviceName`, so an
edge whose upstream belongs to another service was dropped at DEBUG and the run still reported 100%
success. `processCrossDatabaseLineage` / `crossDatabaseServiceNames` were already in the lineage
pipeline config but the Unity Catalog source never read them.

## Decision
- With `processCrossDatabaseLineage` on, an **upstream** is looked up in this service first, then in
  each of `crossDatabaseServiceNames` in the configured order; the first match wins.
- A **target** is resolved in this service only. An edge is emitted by the run of the service that
  owns its target, so an A → B edge needs B's run to list A — not the reverse.
- An upstream no searched service holds is a run-status warning, once per upstream name.

For this source the two fields mean "where else to look for an upstream". In the SQL-parser
lineage path (`lineage_source.py`) they drive `yield_cross_database_lineage`; the names are shared,
the mechanism is not.

## Consequences
- Each edge is emitted by exactly one run. Resolving targets across services too would make every
  run that lists another service re-emit that service's internal edges, and `addLineage` replaces
  an edge's details, so a run could overwrite the column mappings the owning run wrote.
- When the same `catalog.schema.table` is ingested under more than one searched service, the
  edge links to the first in order. Revisit if a source needs a different tie-break (e.g. by
  catalog-to-service mapping).
- Warnings do not change the pipeline state; success is still computed from failures.
