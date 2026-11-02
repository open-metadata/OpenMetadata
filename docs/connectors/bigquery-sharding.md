# BigQuery daily sharded tables

BigQuery daily tables can be cataloged as a stable logical table. For example,
`events_20260101` and `events_20260102` become `events_yyyymmdd` with
`tableType: Sharded`. The greatest valid date suffix selects the representative;
its columns, partitioning, DDL and source link describe that physical table.
Adding or expiring a member updates the descriptor without replacing the logical
entity ID or curated governance metadata.

## Configuration and scheduling

New BigQuery services created in the UI select and persist grouping by default.
Existing services and API/YAML configurations that omit `shardedTables` remain
disabled. An explicit `enabled: false` disables grouping. Review existing catalogs
with the migration command before enabling it.

```yaml
serviceConnection:
  config:
    type: BigQuery
    shardedTables:
      enabled: true
      excludePatterns:
        - '^backup_'
```

Exclusions are regular expressions against physical names. Excluded tables retain
ordinary ingestion behavior. Only native tables with a valid terminal ASCII
`YYYYMMDD` date are grouped; views and external tables are unchanged. Prefixes are
exact: `events_`, `events`, and `events_intraday_` are separate families. A date-only
name such as `20260101` belongs to `yyyymmdd`. Partition decorators such as
`events$20260101` are references to a base table, not shard members.

Table inclusion/exclusion filters apply to **logical names** in grouped mode.
A filter containing yesterday's physical date will not select the family. Grouped
mode performs full discovery even when incremental ingestion is configured. The
inventory limit is 10,000 families per dataset; exceeding it fails the dataset
instead of reconciling a partial inventory. Failed discovery or extraction skips
stale table deletion for that dataset. Successful empty discovery follows the
existing `markDeletedTables` setting immediately. Deletion grace is deferred;
`markDeletedTables: false` retains all missing tables and requires manual cleanup.

Run metadata ingestion before profiling or quality workflows. A separately
started workflow reads the persisted descriptor and pins one representative for
its execution. If that target disappears, rerun metadata ingestion and start a new
execution; an in-flight execution must not silently switch shards.

## Results and source activity

Table and column profiles, samples, and sampler-backed quality checks measure the
representative only. Their saved `executionSource` records the physical project,
dataset, table, and shard date. Historical results keep their original scope after
representative rollover. Old results without scope display it as unavailable.
Custom SQL remains unchanged and receives no inferred representative scope.
Rule-library SQL and data-diff checks on Sharded tables are unsupported and fail
before executing against a logical placeholder.

INSERT/UPDATE/DELETE system metrics for Sharded tables are deferred. New operation
records are not collected or published; existing records remain stored. The UI
shows an unsupported message instead of zero activity. Ordinary profiling,
quality, samples, usage, lineage, and lifecycle remain enabled. Ordinary tables
retain their existing system-metric behavior.

Family lifecycle combines the minimum known source creation and maximum known
source update/access timestamps. It describes observed source activity, not
metadata-ingestion freshness. The shared lifecycle merge also applies to ordinary
entities; it preserves missing aspects and catalog creation audit fields.

## References and search

Concrete physical references resolve to an active physical catalog entity first,
then to a verified family in the same service/project/dataset. Partition decorators
are stripped before lookup. Usage counts a family once per query execution, even
when that execution references multiple members; repeated executions still count.

Wildcards can return multiple families and ordinary tables. Lineage resolution is
bounded at 100 candidates and reports overflow instead of publishing a truncated
match set. Date-constrained wildcards require member evidence; absent that evidence,
they are reported as incomplete rather than inferred from the first/last date.

Explore keeps its ordinary search results, counts and pagination. A separate
“Matching sharded families” group offers up to ten verified naming matches for a
physical identifier, preserving the current search constraints. These suggestions
are naming matches, not proof that a particular physical member exists. Raw search
APIs and autocomplete are unchanged.

## Collisions and intentional replacement

An ordinary physical `events_yyyymmdd` conflicts with the logical family name.
Initial collisions retain physical identities and report the conflict. Existing
or soft-deleted ordinary and Sharded identities block conversion in either
direction. A failed lookup is not proof that an identity is absent. Resolve the
conflict before expecting that family's extraction to resume; other families can
continue. Existing descriptors remain last-known family metadata.

Soft-deleting and upserting restores the old identity. If intentional replacement
is required, an operator must explicitly hard-delete the old identity and complete
its dependent cleanup before restarting ingestion. This loses its catalog history,
tests and references. Export and review what must be retained first. Ingestion
never performs that reset. When both physical and family sources still exist,
resolve the naming conflict rather than treating either as replaced.

## Existing catalog migration

Use a normal BigQuery metadata workflow configuration, with credentials managed in
the usual way. Keep grouping disabled while preparing the physical catalog and
reviewing the manifest. The latest representative must already be ingested.
Database, dataset and logical table filters also constrain migration. Preview is
bounded to 10,000 families and 10,000 physical catalog members; narrow the workflow
filters if either limit is exceeded. An incomplete preview cannot be applied.

```sh
metadata migrate-bigquery-shards --config workflow.yaml --output shard-migration.json
metadata migrate-bigquery-shards --config workflow.yaml --apply shard-migration.json
metadata migrate-bigquery-shards --config workflow.yaml --apply shard-migration.json --retire
```

The first command only reads source/catalog data and writes a local manifest. It
records source IDs/versions, destinations, conflicts, test-case mappings,
relationships and retirement blocks. Keep the manifest outside version control.
Review every conflict before applying. Source discovery and catalog versions are
revalidated. States progress through `planned`, `created`, `validated`, and
`retired`; each successful write is checkpointed for recovery.

Apply creates a distinct logical identity and preserves old identities. It copies
non-conflicting descriptions, owners, tags/glossary terms and custom properties,
and compatible column annotations. Supported tests are recreated with new IDs and
family-linked FQNs using existing definitions. Old cases and histories are never
repointed or merged. Supported table-level incoming/outgoing lineage is copied and
reread. Column lineage and other unsupported relationships block retirement for
explicit operator review. Families with old test cases also remain active when
retirement cannot guarantee their historical accessibility.

`--retire` is an explicit soft-delete phase, permitted only after destination
validation and with no retirement blocks. It never hard-deletes. Until retirement,
concrete references continue to prefer physical entities. Do not clear a retirement
block merely to advance the manifest: first resolve the underlying relationship
and review a fresh plan. Rerunning a checkpoint resumes completed work.

## Manual acceptance exercise

Use a disposable dataset and generic fixture names. Create native tables
`events_20260101`, `events_20260102`, `events_intraday_20260102`, `events`, and
`20260101`, with an `id` column and a few distinct rows. Ingest with grouping enabled.
Verify four independent identities, including `events_yyyymmdd` with count two.
Record its ID, add a curated description, and run profiling, samples, and a
sampler-backed quality check. Inspect saved results for `events_20260102` scope.

Add `events_20260103`, ingest again, and verify the same logical ID/description,
count three, Jan 3 representative and updated columns. The first results must still
show Jan 2; new results must show Jan 3. System charts must show unsupported while
ordinary-table charts still work. Search for Jan 1 on a later primary results page;
the separate suggestion must open the family without changing primary pagination.

Exercise an isolated naming collision, a failed listing/extraction, an empty
successful dataset, exclusions, and a date-only family. Failed scopes must not
remove existing tables. Separately preview and apply migration on a populated
physical catalog, interrupt/resume it, and confirm old identities remain readable.
Only test retirement after reviewing its manifest and supported relationships.
Cloud fixture creation and cleanup are operator actions; local automated checks
do not establish that live BigQuery acceptance has passed.
