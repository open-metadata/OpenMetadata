# Incident grouping uses the full generated table name

- **Status:** Accepted
- **Revisions:** v1 2026-11-19 (initial)
- **Deciders:** Teddy Crepineau
- **Guard:** `IncidentGroupingIndexSqlIT`, `IncidentGroupQueriesSqlIT`, `IncidentGroupTrendSqlIT`, `IncidentGroupTrendScaleIT`
- **Related:** https://github.com/open-metadata/OpenMetadata/pull/38164

## Context

Grouping 110,038 incidents still spends seconds reading test-case JSON and extracting table
names. Compact projection tables improved the prototype, but their synchronization triggers
would fail on managed MySQL with binary logging and ordinary schema-scoped grants. Application
hooks would have to cover many independent single, bulk, conditional and rename write paths.

## Decision

Native migration 2.1.1 adds `test_case.incidentTableFqn`, generated from the third `::` component
of the JSON entity link with trailing `>` removed. This is the existing grouping expression,
including its behavior for column test cases. Group queries read that column; relationships,
filters, ranking, paging and historical counts retain their existing semantics.

The grouping column supports the schema limit of 3,072 characters. The migration also widens the
older `entityLink` and `entityFQN` generated columns to hold the full link and field path.
MySQL derives the grouping key from the stored entity link. It indexes the first 512 characters
of the table name followed by the deletion flag, ID and ASCII FQN hash. A lookup can use the
prefix to find candidate rows and compare their complete names. PostgreSQL stores the full
grouping key without an additional index. The shared-framework PostgreSQL scale run measured the
25-table trend at 25.7 ms p95 (one reader) and 69.4 ms p95 (five readers), with 10,000 incidents
across 200 tables. Those warm SQL timings do not establish full HTTP listing latency or upgrade
rewrite duration. An additional PostgreSQL equality index remains a separate, plan-driven optimization.

Generated columns and the MySQL index are maintained by the database for all writers and participate
in transaction rollback. There is no separate projection table, backfill worker, synchronization
hook or trigger privilege requirement. Ordinary MySQL `ALTER TABLE` and `CREATE INDEX` statements
use the native migration journal to skip completed statements when resuming between column and index
creation. PostgreSQL additionally supports `IF NOT EXISTS` for its column addition. The MySQL SQL
file is run through the migration runner; it is not an independently replayable SQL script.

## Consequences

Widening the source columns and building the MySQL index can rebuild or scan existing test cases.
PostgreSQL rewrites the table to store the generated key. Upgrade time and DDL locking depend on catalog size. MySQL writes maintain one additional
index. Returning to older application code leaves additive columns/indexes in place safely.
The MySQL timings in the original PR benchmark were measured with the earlier covering index.
They do not establish latency for the prefix index. A change in grouping-key semantics requires a new migration.

## Guard

`IncidentGroupingIndexSqlIT` applies the actual migration, checks generated values after all write
shapes and verifies full-name equality when two names collide in the MySQL prefix index.
`IncidentGroupQueriesSqlIT` executes grouping and preview queries against the migrated column on
both engines. Scale workload details and commands live in the [implementation plan](../plans/2026-11-17-incident-open-count-trend.md).
