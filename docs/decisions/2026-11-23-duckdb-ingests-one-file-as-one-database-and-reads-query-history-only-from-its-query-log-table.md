# The DuckDB connector ingests one file as one database and reads query history only from its query log table

- **Status:** Accepted
- **Revisions:** v1 2026-11-23 (initial)
- **Deciders:** Aydin Geeringh
- **Guard:** `ingestion/tests/unit/source/database/duckdb/` (`test_connection.py`, `test_query_log.py`, `test_types.py`), `ingestion/tests/unit/topology/database/test_duckdb.py`
- **Related:** #13543, #14468 (first DuckDB connector), #14934 (its revert: data type translation and connection configuration needed work)

## Context

DuckDB is embedded: the ingestion opens the database file itself rather than a server. The
SQLAlchemy dialect, `duckdb-engine`, reflects through the Postgres dialect, which does not fit
DuckDB. Column reflection joins `pg_catalog.pg_collation`, which DuckDB lacks. Schema and table
listings mix every attached catalog (`system`, `temp`, any ATTACHed file). Primary keys and unique
constraints come back empty on DuckDB 1.x, and all constraint reflection fails on 2.x, aborting the
transaction it ran in. DuckDB's own query log, `duckdb_logs`, is held in memory per process, so an
ingestion process only ever finds its own statements there.

## Decision

1. The service type is `DuckDB`. The connection is a file path, opened with
   `access_mode=read_only`. `connectionOptions` are passed to DuckDB as configuration and cannot
   override the access mode.
2. One file is one OpenMetadata database, named `databaseName` when set and otherwise the DuckDB
   catalog name (the file name without its extension). Every reflection query is scoped to
   `current_database()`; attached catalogs are not ingested. Usage and lineage attribute queries to
   that same database name.
3. Column types come from `duckdb_columns()`. Nested types (`STRUCT`, `LIST`, `ARRAY`, `MAP`) are
   rewritten into the Hive-style syntax `ColumnTypeParser` expands into child columns. Scalars
   without an OpenMetadata equivalent map to the nearest wider type: `UBIGINT`, `HUGEINT`,
   `UHUGEINT` → `LARGEINT`; `UINTEGER` → `BIGINT`; `USMALLINT` → `INT`; `UTINYINT` → `SMALLINT`;
   `VARINT`, `BIGNUM` → `NUMERIC`; `TIMESTAMP_NS`/`_MS`/`_S` → `TIMESTAMP`; `TIME_NS` → `TIME`.
   Scalar columns keep the DuckDB spelling as their display type.
4. Usage and query lineage read only `main.duckdb_query_log(query_text, user_name, schema_name,
   start_time, duration_ms, aborted)`, which the user populates; never `duckdb_logs`. Values the
   table leaves `NULL` stay unknown, except `schema_name`, which falls back to `main` as DuckDB's
   name resolution does, and the end time, which is `start_time` plus `duration_ms` or else
   `start_time`. Without the table both workflows read no queries.

## Consequences

Metadata, constraints, comments and nested columns ingest on DuckDB 1.x and 2.x without a running
DuckDB process, and concurrent workflows can open the same file. A file another process holds open
for writing cannot be ingested; DuckDB's locking allows no reader beside a writer.

Ingesting attached catalogs, DuckLake, or MotherDuck databases means mapping each catalog to its own
OpenMetadata database. That changes FQNs, so it needs a record superseding point 2. Reading
`duckdb_logs` becomes worthwhile only if DuckDB persists it with the database. Renaming the
`DuckDB` service type after release needs a data migration.
