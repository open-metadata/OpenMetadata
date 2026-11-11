# A migration step's keyset page over a composite key is a row comparison on Postgres and an OR chain on MySQL

- **Status:** Accepted
- **Revisions:** v1 2026-11-11 (initial)
- **Deciders:** Adrià Manero
- **Guard:** `LineageEdgePipelineCleanupMigrationTest` (`postgresReadsEachPageAsARangeOfThePrimaryKey`, `mysqlReadsEachPageAsARangeOfThePrimaryKey`)
- **Related:** ADR:2026-10-09-data-migration-backfills-walk-ids-in-batches; v210 `LineageEdgePipelineCleanupMigration`

## Context

A data migration that walks `entity_relationship` pages through it by its full primary key
`(fromId, toId, relation, relationType)`, 500 rows at a time. The 2.1.0 lineage clean-up wrote the
"after the cursor" condition as an `OR` chain:
`fromId > :f OR (fromId = :f AND toId > :t) OR ...`.

MySQL reads that chain as a range of the primary key. Postgres does not: it reads an index from the
start and discards every row before the cursor, so each page costs more than the last and the walk
grows with the square of the table. On a Postgres copy with 931k relationships, one page in the
middle of the table took 923 ms and discarded 465,001 rows; the same page written as
`(fromId, toId, relation, relationType) > (:f, :t, :r, :rt)` was a range of the primary key and took
0.6 ms. MySQL is the reverse: it does not turn a row comparison with `>` into an index range.

Adding a `relation = 13` filter to the Postgres page made the planner leave the primary key for the
`(fromId, relation)` index and sort the rows of each `fromId`, which is slow again when one entity
has many edges.

## Decision

A data migration step that pages a table by a composite key carries its own page query, written
per engine:

- **Postgres:** one row comparison over the whole key, in key order.
- **MySQL:** the expanded `OR` chain over the same key.

The page has no predicate beyond the cursor, so both engines read it as a range of the primary key.
Any filtering happens on the rows the page returns, in Java.

## Consequences

Every page is an index range on both engines, so a walk costs time in proportion to the table. A
step that pages this way carries two queries, and a test reads each one's plan. A filter that would
cut the rows read needs its own index whose leading columns are the filter and then the key;
revisit this record if such an index is added.
