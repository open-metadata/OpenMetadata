# ClickHouse Distributed lineage follows the engine arguments on a local cluster

- **Status:** Accepted
- **Revisions:** v1 2026-11-19 (initial); v2 2026-11-27 (sink-owned deletion)
- **Deciders:** FreakingMind
- **Guard:** `TestDistributedTableLineage` in `ingestion/tests/unit/topology/database/test_clickhouse_lineage_utils.py`
- **Related:** #37174, #37827, ADR:2026-11-05-connectors-adapt-view-lineage-parsing

## Context
A Distributed table holds no rows; it reads from the table named by
`Distributed(cluster, database, table, ...)` on each shard of the cluster. The ClickHouse lineage
workflow builds a local table -> Distributed table `ViewLineage` edge from those arguments. The
service ingests one server, so a same-named table there is only a shard when the server belongs to
the cluster. Recreating the table over another local table left the old edge in place. The generic
`overrideViewLineage` deletes every `ViewLineage` edge into the target, which would also delete the
edges of materialized views writing `TO` the Distributed table. The table search returns nothing
both for a missing table and for a failed lookup, and matches names regardless of case, while
ClickHouse names are case-sensitive.

## Decision
- An edge is built only when the cluster, after expanding `{macro}` names from `system.macros` the
  way `Macros::expand` does (ten substitutions at most), has a row in `system.clusters` with
  `is_local = 1`, and exactly one table of the same service has the schema and name the arguments
  give, compared case-sensitively. The Distributed table itself is matched the same way. A failed
  read of `system.tables`, `system.clusters` or `system.macros` is a workflow error, and no
  Distributed table gets an edge in that run.
- The edge is not marked for the generic override. With `overrideViewLineage`, the workflow
  deletes, one by one, the `ViewLineage` edges into the Distributed table that come from another
  table of the same service whose schema and name differ from the local table the arguments name.
  A cluster that `system.clusters` lists with no local replica, or arguments naming the Distributed
  table itself, name no local table here, so all those edges go.
- It keeps the edge of a materialized view whose `TO` clause names the Distributed table (an
  unqualified target resolves against the view's schema), and the edge of a materialized view whose
  definition is unknown (missing, blank or not a `CREATE MATERIALIZED VIEW` statement). A
  materialized view without `TO`, a plain view and a regular table are possible local tables, so
  their edges are deleted when no longer named.
- Edges of any other source, `Manual` included, and edges from other services are never deleted.
- Nothing is deleted when the arguments cannot be read or the cluster cannot be placed: an unparsed
  engine, an empty database, a macro this server does not define, or a cluster `system.clusters`
  does not list. A local table that is named but not found, or found more than once, removes only
  edges from other names.
- The source selects obsolete edges and emits `OMetaDeleteLineageRequest` records with an explicit
  `operation: delete`. Only the metadata REST sink executes their deletion. A file sink serializes
  those records alongside additions, leaving the catalog unchanged during an export.

## Consequences
A Distributed table over a cluster this server is not part of gets no edge, even with a matching
table name, and with override its earlier edge is deleted. A failed table lookup never removes an
edge: deletion compares names from the ClickHouse definition, not search results. Each processed
Distributed table costs one lineage read, plus one entity read per candidate edge, and only with
override on. A table that stops being Distributed, or is filtered out, is not revisited, so its
inferred edge stays, as the view lineage of a view recreated as a table does. A Distributed table
whose shards live on servers of other services gets no edge; revisit if a source needs to resolve
local tables across services.
