# Consolidated migration baseline

`{mysql,postgres}/schema.sql` captures the exact schema produced by running every migration
**strictly below 2.0.0** (legacy Flyway `v000`–`v015` + native `1.1.0`–`1.13.4`) on an empty
database. On a fresh install the runner executes the baseline once instead of replaying that
history, records a single `2.0.0-baseline` row (`migrationType=BASELINE`) in `SERVER_CHANGE_LOG`,
and then applies the live `native/2.0.0+` migrations incrementally on top.

**Schema only — the baseline never carries table data.** Migrations write rows to fix up databases
that already exist; a brand-new database has nothing to fix, and everything a running system needs
in its tables is created by the application itself at boot: default settings
(`SettingsCache.createDefaultConfiguration`), search index-mapping versions (written when indexes
are created), and all seeded entities — policies, roles, workflow definitions, event
subscriptions, Data Insight charts — via `initSeedDataFromResources` from `json/data/**`. Freezing
copies of those rows here would pin them to whatever they looked like the day the baseline was cut,
with no migration left to ever update them.

The single exception is counter initialization (`task_sequence`), which is schema bootstrap rather
than data: the row carries no information, the table is useless without it, and the live 2.0.0
migration initializes its `new_task_sequence` replacement the same way.

Also not included, by design:

- `SERVER_CHANGE_LOG` / `SERVER_MIGRATION_SQL_LOGS` — owned and created by the migration runner
  itself (`MigrationHistoryTable`).
- Flowable `ACT_%` / `FLW_%` tables — Flowable creates and upgrades its own schema at runtime;
  freezing it here would pin a Flowable version.

## Freeze policy

**The baseline is frozen.** Never edit these files by hand, never append to them, and never
re-add a pre-2.0 version directory under `native/`:

- New schema changes go into `bootstrap/sql/migrations/native/2.1.0+` (both dialects).
- A fix cherry-picked from the 2.0 release branch lands in the still-live `native/2.0.0`
  directory; release-train reprocessing applies it to upgraded and baseline-installed databases
  alike, and the global statement-hash dedup in `SERVER_MIGRATION_SQL_LOGS` prevents
  double-application of byte-identical statements.
- The next re-freeze (raising the baseline past 2.0) is a deliberate release decision, done by
  regenerating these files.

## Regenerating (re-freeze only)

```bash
scripts/generate_migration_baseline.sh   # both dialects; requires Docker + full Maven build
```

The script checks out the pinned pre-consolidation revision into a temporary directory and builds
the generator there. This is deliberate: the current tree no longer contains Flyway, the historical
SQL files, or their Java migrations, so replaying the current `native/` directory cannot reproduce
the baseline. Update the pinned revision only as part of an intentional re-freeze review.

Data Insight charts under
`openmetadata-service/src/main/resources/json/data/dataInsight/custom/` are normal application seed
resources, not frozen baseline output. Maintain them with the application behavior they represent;
`DataInsightChartMigrationTest` guards the data-asset scope shared by fresh and upgraded databases.

After regeneration, review the SQL diff and run the fresh-install and crash-resume coverage against
both dialects:

```bash
mvn test -pl openmetadata-integration-tests -Dtest=BaselineFreshInstallIT,BaselineCrashResumeIT
mvn test -pl openmetadata-integration-tests -Dtest=BaselineFreshInstallIT,BaselineCrashResumeIT -DdatabaseType=mysql
```
