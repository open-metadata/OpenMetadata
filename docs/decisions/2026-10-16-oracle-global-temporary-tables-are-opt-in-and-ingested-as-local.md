# Oracle Global Temporary Tables are opt-in and ingested as TableType.Local

- **Status:** Accepted
- **Revisions:** v1 2026-10-16 (initial)
- **Deciders:** Ingestion maintainers
- **Guard:** `TestOracleTemporaryTables` in `ingestion/tests/unit/topology/database/test_oracle.py`;
  `ingestion/tests/integration/oracle/test_temporary_tables.py`
- **Related:** issue #25600; PR #27528

## Context
An Oracle Global Temporary Table (GTT) has a permanent definition in the data dictionary —
`*_TABLES.DURATION` is `SYS$SESSION` or `SYS$TRANSACTION` — and only its rows are session-scoped,
so its columns, constraints and comments reflect like any table's. The connector nevertheless
filtered every GTT out with `DURATION IS NULL` in `ORACLE_GET_TABLE_NAMES`, so none reached
OpenMetadata. Turning them on for every service would add entities to existing catalogs on upgrade.

## Decision
`OracleConnection.includeTemporaryTables` (boolean, default `false`) gates GTT ingestion.
`ORACLE_GET_TABLE_NAMES` keeps `DURATION IS NULL`; when the flag is true, GTTs are listed by
`ORACLE_GET_TEMPORARY_TABLE_NAMES` (`DURATION IS NOT NULL`) and yielded with `TableType.Local`, so
they stay distinguishable from regular tables.

## Consequences
Existing Oracle services ingest exactly what they did before. Enabling the flag only adds entities.
Disabling it again treats the GTTs already ingested like any table the source no longer lists: they
are soft-deleted when the pipeline's `markDeletedTables` is on, and otherwise left un-refreshed.
