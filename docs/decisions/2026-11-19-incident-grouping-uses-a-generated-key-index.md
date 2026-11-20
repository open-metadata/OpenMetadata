# Incident grouping reads a generated table key through a covering index

- **Status:** Accepted
- **Revisions:** v1 2026-11-19 (initial) · v2 2026-11-20 (consolidated unreleased DDL into 2.1.1)
- **Deciders:** Teddy Crepineau
- **Guard:** `IncidentGroupingIndexSqlTest`, `IncidentGroupQueriesSqlTest`, `IncidentGroupTrendSqlTest`
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

MySQL uses a virtual generated column and a covering index on `(fqnHash, deleted, id,
incidentTableFqn)`. The full indexed key fits InnoDB's 3072-byte limit because the existing hash
column uses ASCII. The optimizer can read all grouping fields without fetching the large JSON
row. No forced index hint is added. PostgreSQL stores the generated key without adding another index. Its smaller index-tuple
limit cannot safely cover arbitrary full UTF-8 table keys, and an incomplete covering index has
no measured benefit to justify another index build. PostgreSQL still avoids repeated JSON extraction.

Generated columns and the MySQL index are maintained by the database for all writers and participate
in transaction rollback. There is no separate projection table, backfill worker, synchronization
hook or trigger privilege requirement. Ordinary MySQL `ALTER TABLE` and `CREATE INDEX` statements
use the native migration journal to skip completed statements when resuming between column and index
creation. PostgreSQL additionally supports `IF NOT EXISTS` for its column addition. The MySQL SQL
file is run through the migration runner; it is not an independently replayable SQL script.

## Consequences

MySQL index creation scans existing test cases once; PostgreSQL rewrites the table to store the
generated key. Upgrade time and DDL locking depend on catalog size. MySQL writes maintain one additional
index. Returning to older application code leaves additive columns/indexes in place safely.
MySQL gains from a covering index; do not claim the same performance gain on PostgreSQL without
measuring it. A change in grouping-key semantics requires a new migration.

## Regression checks

`IncidentGroupTrendSqlTest` runs the production trend query on MySQL and PostgreSQL with
10,000 incidents across 200 table groups and 40,000 history rows. It checks all nine counts
for a 25-table page and a single large group, with 30 measured requests at concurrency 1 and 5.
The default five-second p95 budget is a coarse regression alarm, not a production SLO; override
`-Dincident.trend.scale.p95Millis=...` for a calibrated runner. End-to-end HTTP concurrency
measurements are recorded separately in PR #38164.

The nine-row `samplesSql()` result supplies evenly spaced timestamps in a shared seven-day window.
It is a time axis, not random sampling of incidents. Each count includes periods opened on or before
the sample and excludes periods closed at or before it.

Open intervals cascade from their incident summary through a foreign key. Explicit history-record
deletion refreshes the summary and rebuilds its intervals in the same transaction. Test hard deletion
captures status and incident IDs before asynchronous cleanup, including unlinked records and summaries
whose audit history has expired. Surviving parent relationships take precedence over reusable test
names. Soft deletion retains the data; group queries hide deleted tests until restored.

The interval-table existence check is restricted to migration-context writes. The older 2.0.0 task
cutover can invoke current incident writers before the 2.1.1 schema migration has run, especially on
forced replay. Those early events are covered by the later backfill. Normal writes always maintain
intervals and do not query `information_schema`.
