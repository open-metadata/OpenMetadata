# A non-nullable single-column UNIQUE is NOT_NULL_UNIQUE

- **Status:** Accepted
- **Revisions:** v1 2026-11-20 (initial)
- **Deciders:** Kefia-02, ulixius9
- **Guard:** `ingestion/tests/integration/sql_server/test_metadata.py`, `ingestion/tests/unit/topology/database/test_complex_column_constraints.py`, `openmetadata-service/src/test/java/org/openmetadata/service/util/ODCSConverterTest.java`
- **Related:** #37986, #38251

## Context
`Column.constraint` holds one value from `table.json#/definitions/constraint`. Ingestion wrote
`UNIQUE` for every single-column unique key, so a `NOT NULL UNIQUE` column lost its
nullability, and no other column field records it.

## Decision
The enum gains `NOT_NULL_UNIQUE`. A column in a single-column unique key is `UNIQUE` when
nullable and `NOT_NULL_UNIQUE` when not; a single-column primary key stays `PRIMARY_KEY`.
Everything that reads the enum treats `NOT_NULL_UNIQUE` as both unique and non-nullable:
table-diff key selection, foreign-key cardinality, RDF (`om:isUnique` + `om:isNullable false`)
and ODCS (`unique` + `required`, imported back as `NOT_NULL_UNIQUE`).

## Consequences
No migration: stored values stay valid. The first ingestion after upgrade moves existing
non-nullable unique columns from `UNIQUE` to `NOT_NULL_UNIQUE`, one version bump per affected
table. New code that checks `constraint == UNIQUE` to mean "unique" must also accept
`NOT_NULL_UNIQUE`.
