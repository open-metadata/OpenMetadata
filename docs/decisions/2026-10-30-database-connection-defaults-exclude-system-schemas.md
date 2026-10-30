# Database connection filter defaults exclude engine-owned system schemas, by exact name

- **Status:** Accepted
- **Revisions:** v1 2026-10-30 (initial)
- **Deciders:** ulixius9
- **Guard:** `ingestion/tests/unit/test_connection_default_filters.py`
- **Related:** —

## Context
The `databaseFilterPattern` / `schemaFilterPattern` `default` on a database connection schema
pre-fills the filters of every newly created ingestion pipeline (UI add-ingestion form and
`CreateIngestionPipelineImpl`). Ingestion reads filters from the pipeline's `sourceConfig`, so the
default never changes an existing pipeline. MySQL, Postgres, MSSQL, Snowflake and a few others had
defaults; 47 connectors had none, so new pipelines ingested `information_schema`, `system`,
`_impala_builtins`, Mongo's `admin`/`local`/`config` and similar engine catalogs.

## Decision
A database connector whose engine exposes its own system databases/schemas to the listing the
connector uses gets a connection-level `default` that excludes them.

- Patterns are anchored exact names (`^name$`). A prefix wildcard is allowed only when the prefix
  is engine-reserved (`^db_.*` on SQL Server roles, `^TD_SYS.*` on Teradata) — never `^SYS.*` or
  `^system_.*`, which would hide user schemas such as `SYSTEM_DATA` or `system_logs`.
- SAP HANA excludes `^_SYS_(?!BIC$).*`: `_SYS_BIC` holds the calculation views its lineage
  resolves against and must stay ingested.
- No default is added where it would be a no-op: the Vertica dialect already drops `v_*` schemas
  and the StarRocks source already skips its system schemas in code.

## Consequences
New pipelines no longer ingest engine catalogs by default; users can still clear the default.
Existing pipelines are untouched. A connector added later should ship its system-schema default
in the same PR. Matching is case-insensitive (`filters._filter` uses `re.IGNORECASE`), so one
pattern covers engines that upper-case their catalog names.
