# BigQuery daily shard families use stable logical tables with recorded execution sources

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial)
- **Deciders:** OpenMetadata maintainers
- **Guard:** `test_bigquery_sharding.py`, `test_resolver.py`, `TableShardingIT`, `TableSharding.spec.ts`
- **Related:** #36867; ADR:2026-11-03-source-lifecycle-merges-earliest-creation-and-latest-activity

## Context

Cataloging every daily shard separately fragments governance and history. Choosing a physical
table as the catalog identity would move that identity whenever a newer shard appears. Ingestion,
the server and consumers need one naming and provenance contract that survives representative
rollover without assuming that every shard has the same schema or contents.

## Decision

A native daily table name ends in a valid eight-digit `YYYYMMDD` date. Its exact prefix is empty
or ends in a non-digit; separators are not required. Thus `events_20260101`, `events20260101`
and `20260101` belong to distinct families. Views do not become shard members. A `$YYYYMMDD`
partition decorator is a reference to a table, not another discovered member.

Within one database and schema, a family is a Table named `<prefix>yyyymmdd`, with
`tableType: Sharded` and a `tableSharding` descriptor. The type and descriptor require each other;
the descriptor is part of the Table, not a separate entity. It records the exact prefix, suffix
format, member count, first/last dates and representative. The representative is the physical
member with the greatest valid date suffix, regardless of creation time. Its name must equal
`<prefix>` plus `lastShardDate` formatted as `yyyyMMdd`, in the family's database and schema.

The family retains its ID, catalog creation audit and governance across representative rollover.
Columns and SQL execution use the representative. Table/column profiles and samples persist
`executionSource`; quality results persist `evaluationScope.executionSource`. Historical records
use their recorded source, never today's representative. Source-specific INSERT/UPDATE/DELETE
system metrics for sharded tables are deferred; existing records and ordinary-table behavior
remain intact.

`sourceConfig.config.shardedTables` belongs to metadata ingestion and contains only `enabled`.
New BigQuery metadata pipelines created in the UI explicitly start enabled unless supplied
configuration says otherwise. Editing a pipeline, or omitting the property in API/YAML configuration,
does not enable grouping. Profiling, samples and quality use the persisted Table descriptor.
Normal metadata filter patterns remain available; there is no separate shard exclusion setting.

Discovery uses complete dataset inventories even when incremental ingestion is configured.
If a selected representative disappears during extraction, inventory is refreshed once. A
remaining member becomes the representative; confirmed disappearance allows reconciliation.
Failed inventory, extraction or identity-collision scopes cannot authorize stale deletion.
There is no deletion grace timer.

Changing the grouping toggle creates or restores the appropriate logical or physical identities
and, with `markDeletedTables`, retires replaced identities through ordinary soft deletion. It does
not convert one identity into the other or transfer their histories. A physical placeholder whose
name collides with a logical family requires operator resolution, including when the conflicting
catalog identity is soft-deleted. Retirement uses discovery state rather than a transaction with
replacement persistence; a failed replacement write is not currently a rollback barrier.

Discovery retains at most 10,000 families per dataset and tracks at most 10,000 dataset scopes per
run. Crossing either limit reports failure instead of accepting a truncated discovery scope.
These initial limits bound retained state while allowing large daily-shard inventories; changing
them requires evidence about memory and request volume.

With grouping enabled, ordinary-table lifecycle and physical-table DDL lookups read ordered
windows of at most 1,000 metadata rows starting at the requested name. A topology context retains
at most 2,000 rows across those queries, including cached misses; query keys include the database
and schema. Discovery and its inventory refresh clear these observations. The window size
amortizes query setup without retaining an entire dataset. Out-of-order requests remain correct
but may need more reads. Family lifecycle aggregation still reduces the full member inventory.

Catalog wildcard resolution allows at most 100 candidates, with overflow reported rather than
silently truncated. Missing candidates during hydration produce partial matches with a warning;
existing lineage override behavior applies to those partial results. Date-constrained wildcards
without member evidence remain unsupported. Best-effort shared table search logs resolution
failures at debug level and continues with other services/references; direct resolver callers
retain exceptions. Physical-name UI suggestions are separately bounded to 10 candidates, preserve
query/post filters and do not alter ordinary search pagination or accumulate physical aliases.

## Consequences

Governance and history follow a stable logical asset, while execution remains attributable to a
physical shard. Profiles describe that representative, not an aggregation of every member.
Switching grouping modes does not migrate history between identities, and replacement plus
retirement is not atomic. Full inventory and bounded catalog hydration add requests; optimizing
them must preserve collision detection, authoritative validation and incomplete-scope handling.
