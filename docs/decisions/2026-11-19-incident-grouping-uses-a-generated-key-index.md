# Incident grouping uses the full generated table name

- **Status:** Accepted
- **Revisions:** v1 2026-11-19 (initial) · v2 2026-11-20 (consolidated unreleased DDL into 2.1.1) · v3 2026-11-20 (support 3,072-character table names)
- **Deciders:** Teddy Crepineau
- **Guard:** `IncidentGroupingIndexSqlTest`, `IncidentGroupQueriesSqlTest`, `IncidentGroupTrendSqlTest`, `IncidentGroupTrendScaleIT`
- **Related:** https://github.com/open-metadata/OpenMetadata/pull/38164; ADR:2026-11-19-incident-grouping-uses-transactional-projections

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
grouping key without an additional index.

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

## Regression checks

`IncidentGroupTrendScaleIT`, tagged `@Tag("scale")`, runs the production trend query on MySQL and PostgreSQL with
10,000 incidents across 200 table groups and 40,000 history rows. It checks all nine counts
for a 25-table page and a single large group, with 30 measured requests at concurrency 1 and 5.
The workload runs only in the `scale-it` profile; regular SQL tests retain the smaller correctness
fixtures. The default five-second p95 budget is a coarse regression alarm, not a production SLO; override
`-Dincident.trend.scale.p95Millis=...` for a calibrated runner. End-to-end HTTP concurrency
measurements are recorded separately in PR #38164. The scale runner writes JSON measurements under
`openmetadata-integration-tests/target/benchmark/`.

For this isolated SQL workload, select `-Pscale-it -Dit.test=IncidentGroupTrendScaleIT` and
`-Dskip.embedded.bootstrap=true`; it starts its own database and does not need the application/search
stack. Select an engine with `-DdatabaseType=postgres` or `-DdatabaseType=mysql`; `databaseImage`
can override that engine's container image.

The nine-row `samplesSql()` result supplies evenly spaced timestamps in a shared seven-day window.
It is a time axis, not random sampling of incidents. Each count includes periods opened on or before
the sample and excludes periods closed at or before it.

Open intervals cascade from their incident summary through a foreign key. Explicit history-record
deletion refreshes the summary and rebuilds its intervals in the same transaction. Test hard deletion
captures status and incident IDs before asynchronous cleanup, including unlinked records and summaries
whose audit history has expired. Cleanup deletes complete incident histories in batches. It removes
relationships in the database transaction and deletes the captured search documents after commit. Surviving parent relationships take precedence over reusable test
names. Soft deletion retains the data; group queries hide deleted tests until restored.

The interval-table existence check is restricted to migration-context writes. The older 2.0.0 task
cutover can invoke current incident writers before the 2.1.1 schema migration has run, especially on
forced replay. Those early events are covered by the later backfill. Normal writes always maintain
intervals and do not query `information_schema`.
