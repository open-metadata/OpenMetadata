# The Trino table comments query is restricted to the filtered tables only when a table filter is set and keeps at most 500 tables

- **Status:** Accepted
- **Revisions:** v1 2026-11-11 (initial)
- **Deciders:** joaopamaral
- **Guard:** `ingestion/tests/unit/topology/database/test_trino_metadata.py` (`TestTrinoTableCommentsFilter`)
- **Related:** #37595, #37596

## Context
The Trino source reads table comments with one `system.metadata.table_comments` query per schema,
filtered only on catalog and schema. On Iceberg, Trino opens every table's metadata to answer it,
so a metadata run scoped by `tableFilterPattern` to one table of a large schema paid for the whole
schema: 18.4 s against 0.2 s for the same comment in a 111-table schema. Adding the kept table
names as an `IN` list fixes that, but applying it to every run would change the default query for
all users and, on schemas with thousands of tables, push the SQL text towards Trino's
`query.max-length` (1,000,000 characters by default) and slow planning.

## Decision
- `TrinoSource.get_tables_name_and_type` records the schema's kept table names on the dialect only
  when `tableFilterPattern` is set and at most `MAX_COMMENT_TABLE_NAMES` (500) tables are kept.
  The entry is removed when the schema's tables are done.
- `get_table_comment` appends `and "table_name" IN (...)` only when a list is recorded for the
  schema. Otherwise the query is the schema-wide one.
- The cap is 500 because a filter keeping that many tables gains little from a narrower scan, and
  500 quoted names stay far below `query.max-length`.

## Consequences
Scoped runs (a few tables of a large schema) read only their tables' comments. Unfiltered runs and
broad filters behave as before. A filter that keeps 501 tables of a much larger schema still scans
the whole schema; raising the cap, or batching the names into several queries, would be the fix if
that case matters.
