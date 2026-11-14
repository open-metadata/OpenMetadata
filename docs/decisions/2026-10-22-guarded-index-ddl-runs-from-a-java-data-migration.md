# Guarded index DDL runs from a version's Java data migration, not schemaChanges.sql

- **Status:** Accepted
- **Revisions:** v1 2026-10-22 (initial)
- **Deciders:** Ram Narayan Balaji
- **Guard:** reviewer
- **Related:** open-metadata/OpenMetadata#35920, open-metadata/OpenMetadata#35950,
  ADR:2026-10-22-governance-workflow-runs-keep-each-entitys-latest-run

## Context

MySQL has no `CREATE INDEX IF NOT EXISTS` or `ADD COLUMN IF NOT EXISTS`, so existing
`schemaChanges.sql` files (2.0.0, 2.0.2, 2.1.0) guard such DDL with
`SET @ddl = (SELECT IF(EXISTS (...), 'SELECT 1', '<ddl>')); PREPARE stmt FROM @ddl; EXECUTE stmt;
DEALLOCATE PREPARE stmt;`.

The native migration runner (`MigrationProcessImpl.performSqlExecutionAndUpdate`) runs a
`schemaChanges.sql` one statement at a time, records each statement's hash in
`SERVER_MIGRATION_SQL_LOGS` as soon as it succeeds, and skips recorded statements on a retry. A
prepared statement lives only in its session. So if the `EXECUTE` fails (a lock-wait timeout, a
killed session) or the run stops between `PREPARE` and `EXECUTE`, every retry skips the recorded
`SET` and `PREPARE` and runs `EXECUTE` in a new session, where the statement does not exist: the
upgrade can never get past it. (#35950 is a second failure of the same idiom: blocks that reuse
`@ddl`/`stmt` are identical text, so the runner skips all but the first.)

`MigrationWorkflow`, by contrast, records a version's Java data migration only after
`runDataMigration()` returns, so an interrupted Java step runs again on the next `migrate`.

## Decision

- A MySQL DDL that needs an existence guard — a column or index add MySQL cannot write as
  `IF NOT EXISTS` — runs from that version's Java data migration (`migration/mysql/v<NNN>/Migration`
  delegating to a helper under `migration/utils/v<NNN>/`), which checks `information_schema`
  before each statement and executes the DDL only when it is missing. It does not go in
  `schemaChanges.sql` as `SET`/`PREPARE`/`EXECUTE`.
- Each guarded step is independent and idempotent, so a rerun carries on from wherever the
  previous attempt stopped.
- A PostgreSQL index built `CONCURRENTLY` runs from the same Java step: an interrupted
  concurrent build leaves an INVALID index, which `CREATE INDEX CONCURRENTLY IF NOT EXISTS` in
  `schemaChanges.sql` would skip on every retry (the operator notes in 1.13.0 and 2.1.0). The step
  reads `pg_index.indisvalid`, drops an invalid index `CONCURRENTLY`, and builds it again. The Java
  migration handle is opened with autocommit, so `CONCURRENTLY` works there.
- First applied by `migration/utils/v207/MigrationUtil`.

## Consequences

- Existing guarded blocks in 2.0.0, 2.0.2 and 2.1.0 are not rewritten here: those versions are
  already recorded on upgraded databases. New migrations follow this record.
- The DDL now lives in Java rather than next to the version's other SQL; the version's
  `schemaChanges.sql` should say so in a comment so a reader of the SQL finds it.
- The Java step runs after `schemaChanges.sql` and before `postDataMigrationSQLScript.sql`; SQL
  that depends on the guarded column or index belongs in the post-data script or later versions.
- Revisit if the runner learns to group a guarded block into one retry unit.
