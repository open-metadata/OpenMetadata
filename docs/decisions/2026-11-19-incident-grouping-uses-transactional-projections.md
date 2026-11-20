# Incident grouping reads compact projections maintained in source transactions

- **Status:** Superseded by ADR:2026-11-19-incident-grouping-uses-a-generated-key-index
- **Revisions:** v1 2026-11-19 (initial) · v2 2026-11-19 (replaced before deployment)
- **Deciders:** Teddy Crepineau
- **Guard:** `IncidentGroupingProjectionSqlTest`, `IncidentGroupQueriesSqlTest`, `IncidentGroupTrendSqlTest`
- **Related:** https://github.com/open-metadata/OpenMetadata/pull/38164

## Context

At 110,038 incidents, grouping still spends seconds joining the large test-case JSON table and
the general relationship table after historical trends were changed to indexed open intervals.
An indexed compact-table prototype reduced grouping-query time by 30–44% on the local fixture.
Those measurements exclude the rest of the API request and are not a production latency promise.

## Decision

Native migration 2.1.2 adds two projections: test-case grouping fields keyed by FQN hash, and
test-definition memberships keyed by `(fromId, toId, relationType)`. Indexes support joins by
test-case ID, table FQN, and definition ID. Grouped reads and trend scoping use these tables;
the entity tables remain authoritative. Owner relationships retain their existing query path.

Database triggers maintain the projections in the same transaction as source inserts, updates,
and deletes. This covers bulk writes and renames as well as repository writes, without a
separate asynchronous consistency mechanism. MySQL triggers read JSON because references to
generated source columns through `NEW` or `OLD` are prohibited. Preserve multiple memberships
and the existing behavior that does not filter definition relationships by their deleted flag.

Install the triggers before backfilling. Backfill uses indexed keyset batches of 1,000 test cases
or membership target IDs, locking source rows before copying them. This bounds test-case memory
and lock duration; a target with multiple memberships contributes multiple rows. Upsert only
the locked rows: deleting a whole target's projection first could erase a concurrent insert.
The migration's completion marker avoids repeating a successful full backfill. The native SQL
statement log gates trigger creation on replay, allowing plain `CREATE TRIGGER` on MySQL 8.0
versions before `IF NOT EXISTS` was introduced in 8.0.29.

## Consequences

Reads avoid large source rows and general relationship indexes. Writes pay for trigger execution
and projection maintenance; migrations require permission to create triggers (and PostgreSQL
functions). The projection is internal database state, not another API or search-index contract.
Rolling back application code leaves additive tables and triggers in place; it does not require
deleting source data. Changing projection semantics needs a new migration, including any repair
backfill. Ordinary row operations synchronize the tables; administrative operations that bypass
row triggers, such as `TRUNCATE`, must explicitly rebuild or clear the projections too.

## Amendment: replaced before deployment

Independent review found that MySQL binary logging can require global privileges to create
triggers, while normal OpenMetadata accounts have schema-scoped grants. The implementation was
replaced before shipping with ADR:2026-11-19-incident-grouping-uses-a-generated-key-index. No
projection tables or triggers from this design are installed by the final migration.
