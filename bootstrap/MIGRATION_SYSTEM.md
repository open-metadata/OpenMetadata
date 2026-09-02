# OpenMetadata Migration System

## Overview

OpenMetadata manages its own database schema. There are two kinds of input:

1. **The baseline** (`bootstrap/sql/migrations/baseline/`) — the consolidated pre-2.0 schema,
   installed once on an empty database instead of replaying the history that produced it.
2. **Native migrations** (`bootstrap/sql/migrations/native/{version}/`) — everything from `2.0.0`
   onward, applied incrementally, plus optional **extension migrations** supplied by downstream
   distributions via `extensionPath`.

Flyway is gone entirely — the runner, the legacy `v0xx` scripts, and the dependency itself.
Statement splitting is handled by `SqlStatementSplitter`.

## Execution order

```
baseline (empty database only)
   └── native >= 2.0.0, in version order
          └── extension migrations, in version order
```

## Upgrade gate

A database must already be on **2.0.0 or later** for this release to migrate it. Anything older —
including a database still carrying the pre-native `DATABASE_CHANGE_LOG` table — is rejected with
instructions to upgrade through the latest 2.0.x first. The gate runs before the force branch, so
`--force` cannot skip it.

## Baseline decision

On every migrate the runner resolves one of:

| Action | When | Effect |
|---|---|---|
| `RUN` | Empty database | Install the baseline, record one `2.0.0-baseline` step |
| `RESUME` | Only a `STARTED` baseline row exists (a crash) | Wipe and re-install, refusing if entity rows are present |
| `SKIP` | Real migration history already exists | Nothing |
| `ABORT` | Entity tables but no migration history | Refuse and tell the operator to restore or drop-create |
| `DISABLED` | No baseline files shipped | Continue for an existing database; fail with the missing path when an empty database requires the baseline |

Once a database is baseline-managed, every version below 2.0.0 is filtered out of the available
set — so a stray pre-2.0 directory can never be replayed on top of the baseline.

## Tracking tables

`SERVER_CHANGE_LOG` (one row per step) and `SERVER_MIGRATION_SQL_LOGS` (one row per executed
statement, keyed by MD5). Both are created and maintained by the runner itself — see
`MigrationHistoryTable` for the DDL and `MigrationHistoryTableUpgrader` for the in-place column
upgrade applied to databases that predate them.

Each history row describes a step:

- `migrationType` — `BASELINE`, `NATIVE`, `EXTENSION`, or `FLYWAY` (legacy rows, backfilled).
- `status` — `STARTED` when the step begins, then `COMPLETED`, or `FAILED` if a phase threw while
  running under `--force`. Only `COMPLETED` counts as applied, so a crash leaves a visible marker
  and the version stays pending.

`./bootstrap/openmetadata-ops.sh info` prints this as a Version / Type / Status / Installed-On
table; `repair` clears unfinished (`STARTED` / `FAILED`) native and extension rows so the next run
retries them. It preserves a `STARTED` baseline row because that marker is what selects the guarded
wipe-and-resume path after an interrupted fresh install.

## File layout

```
bootstrap/sql/migrations/
├── baseline/
│   ├── README.md                     # freeze policy + regeneration
│   ├── mysql/schema.sql
│   └── postgres/schema.sql
└── native/
    └── {version}/
        ├── mysql/{schemaChanges,postDataMigrationSQLScript}.sql
        └── postgres/{schemaChanges,postDataMigrationSQLScript}.sql
```

## Key classes

- `MigrationWorkflow` — discovery, the upgrade gate, the baseline floor, pending computation, execution
- `BaselineWorkflow` / `BaselineFiles` — baseline decision and installation
- `MigrationProcessImpl` — default per-version process (SQL only); a version with Java work supplies
  `org.openmetadata.service.migration.{mysql,postgres}.v{version}.Migration`
- `MigrationFile` — one native/extension directory; parses SQL and resolves the Java class
- `SqlStatementSplitter` — statement splitting (comments, quoting, PostgreSQL dollar-quoting)
- `MigrationVersionUtil` — version parsing/comparison, the 2.0.0 floor, the baseline version constant

## Configuration

```yaml
migrationConfiguration:
  nativePath: "./bootstrap/sql/migrations/native"
  extensionPath: ""
  # baselinePath: defaults to a "baseline" directory beside nativePath
```

`flywayPath` is accepted but ignored; it remains only so existing configuration files still parse.

## Adding a migration

1. Create `native/{version}/{mysql,postgres}/schemaChanges.sql` (both dialects, idempotent).
2. Add `postDataMigrationSQLScript.sql` if work must follow the data migration.
3. For Java work, add `migration/{mysql,postgres}/v{version}/Migration.java`.
4. Never touch the baseline or re-add a pre-2.0 version.
