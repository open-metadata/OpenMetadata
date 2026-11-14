# A MySQL guarded migration block runs, is recorded and is skipped as one unit

- **Status:** Accepted
- **Revisions:** v1 2026-10-22 (initial)
- **Deciders:** Adrià
- **Guard:** `GuardedBlockMySqlExecutionTest`, `MySqlMigrationUnitsTest`
- **Related:** #35948, PR #35951, PR #35950, PR #35978

## Context

MySQL has no `CREATE INDEX IF NOT EXISTS`, so migrations guard schema changes with a block:
`SET @v = (SELECT IF(exists, 'SELECT 1', '<DDL>')); PREPARE n FROM @v; EXECUTE n; DEALLOCATE
PREPARE n;`. A prepared statement only exists on the connection that prepared it.

The runner recorded and skipped each statement on its own, by the checksum of its text in
`SERVER_MIGRATION_SQL_LOGS`. A `migrate` killed during `EXECUTE` left `SET` and `PREPARE` recorded,
so every rerun ran `EXECUTE` alone on a new connection and failed with `Unknown prepared statement
handler`. Blocks that reused names shared their `PREPARE` and `EXECUTE` text, so every block after
the first was skipped and its change never happened.

## Decision

- A unit is the statements the runner executes, records and skips together. A plain statement is a
  unit of one, and its recorded text and checksum are the statement's, exactly as before units.
- On MySQL a guarded block is one unit: one or more `SET @v`, then `PREPARE n FROM @v`, `EXECUTE n`,
  and optionally `DEALLOCATE PREPARE n` or `DROP PREPARE n`. Its statements run in order on one
  connection. It is recorded once, after its last statement, and a failure records nothing.
- A block's checksum is the MD5 of its statements joined by `";\n"`. The join and the grouping are a
  stored format: changing either makes every recorded block look new and run again.
- Authoring rule for MySQL migration files: a `SET @` must be followed by the `PREPARE` that reads
  it, and `PREPARE`, `EXECUTE` and `DEALLOCATE` appear only in that shape. No other statement may
  rely on a session variable, because only a block is kept on one connection and rerun whole. A file
  that breaks the rule fails to parse, which stops `migrate`, `validate` and server start before any
  statement runs (PR #35978).
- A unit is applied when its checksum is recorded. A block recorded statement by statement by an
  older runner is applied when every one of its statements was recorded under the block's own
  version; rows under another version belong to another block that reused the names.
- The stored text is cut to 10000 UTF-16 units on a code point boundary; the checksum covers the
  full text.

## Consequences

- An interrupted block reruns whole, so an upgrade retry needs no manual cleanup.
- Reuse inside one version, recorded by an older runner, cannot be told apart in the log, so every
  block gets its own variable and statement names.
- Blocks an older runner skipped because another version had recorded their text run once on the
  next `migrate`, which re-runs that version, and once under `--force`. Every block is guarded, so
  this repeats nothing that already happened.
- A database migrated with units, opened by a build from before units, sees its blocks as pending
  until one `migrate`.
- Every distribution with its own MySQL migrations runs
  `MySqlMigrationUnits.assertEveryFileParsesIntoUnits` over them in CI.
- Revisit if the runner stops recording statement by statement, for example by recording a whole
  file in one transaction.
