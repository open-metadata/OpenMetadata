# Incident grouping reads a generated table key through a covering index

- **Status:** Accepted
- **Revisions:** v1 2026-11-19 (initial)
- **Deciders:** Teddy Crepineau
- **Guard:** `IncidentGroupingIndexSqlTest`, `IncidentGroupQueriesSqlTest`, `IncidentGroupTrendSqlTest`
- **Related:** https://github.com/open-metadata/OpenMetadata/pull/38164; ADR:2026-11-19-incident-grouping-uses-transactional-projections

## Context

Grouping 110,038 incidents still spends seconds reading test-case JSON and extracting table
names. Compact projection tables improved the prototype, but their synchronization triggers
would fail on managed MySQL with binary logging and ordinary schema-scoped grants. Application
hooks would have to cover many independent single, bulk, conditional and rename write paths.

## Decision

Native migration 2.1.2 adds `test_case.incidentTableFqn`, generated from the third `::` component
of the JSON entity link with trailing `>` removed. This is the existing grouping expression,
including its behavior for column test cases. Group queries read that column; relationships,
filters, ranking, paging and historical counts retain their existing semantics.

MySQL uses a virtual generated column and a covering index on `(fqnHash, deleted, id,
incidentTableFqn)`. The full indexed key fits InnoDB's 3072-byte limit because the existing hash
column uses ASCII. The optimizer can read all grouping fields without fetching the large JSON
row. No forced index hint is added. PostgreSQL stores the generated key and indexes `fqnHash`
with `deleted` and `id` included; the potentially wide UTF-8 table key is excluded to avoid its
smaller index-tuple limit. PostgreSQL still benefits from avoiding repeated JSON extraction.

Generated columns and indexes are maintained by the database for all writers and participate
in transaction rollback. There is no separate projection table, backfill worker, synchronization
hook or trigger privilege requirement. MySQL guarded DDL and PostgreSQL `IF NOT EXISTS` make
the migration replayable, including after interruption between column and index creation.

## Consequences

Index creation scans existing test cases once; PostgreSQL also rewrites the table to store the
generated key. Upgrade time and DDL locking depend on catalog size. Writes maintain one additional
index. Returning to older application code leaves additive columns/indexes in place safely.
MySQL gains from a covering index; do not claim the same performance gain on PostgreSQL without
measuring it. A change in grouping-key semantics requires a new migration.
