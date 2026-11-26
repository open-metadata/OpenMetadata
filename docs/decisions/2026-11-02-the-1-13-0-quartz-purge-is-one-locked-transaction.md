# The 1.13.0 Quartz purge runs as one locked transaction in the Java data migration

- **Status:** Accepted
- **Revisions:** v1 2026-11-02 (initial)
- **Deciders:** Ram Narayan Balaji
- **Guard:** `QuartzTablePurgeMigrationIT` (concurrent scheduler write, rollback, retry budget) and
  `QuartzTablePurgeTest`
- **Related:** #36816, #36817, #26473

## Context
1.13.0 renamed the App field `preview` to `enabled`, and Quartz keeps copies of App JSON in its job
data, so the 1.13.0 migration empties the Quartz tables and the server reschedules everything at
startup. It did this with nine `DELETE` statements in `schemaChanges.sql`, each committed on its
own. Upgrades that keep a 1.12.x server up during `migrate` let that server's clustered scheduler
write a trigger back between the trigger and job deletes, and the job delete failed on its foreign
key. A rerun failed the same way: the earlier deletes were recorded in `SERVER_MIGRATION_SQL_LOGS`
and skipped.

## Decision
- The purge lives in `QuartzTablePurge`, called first from both `v1130` data migrations and never
  wrapped in a swallow-and-log `try/catch`.
- It runs in one transaction behind locks on all nine tables: `LOCK TABLE … IN ACCESS EXCLUSIVE
  MODE` on Postgres, autocommit off then `LOCK TABLES … WRITE` on MySQL, with `UNLOCK TABLES` only
  after the transaction ends. `QRTZ_LOCKS` is locked first so the purge queues behind a scheduler
  that is firing a trigger, but Quartz acquires triggers in another table order without
  `QRTZ_LOCKS`, so a deadlock with a live scheduler stays possible.
- Only deadlocks and serialization failures (SQLState `40P01`, `40001`) are retried, up to 3
  attempts; anything else fails `migrate` at once with the transaction rolled back.
- The purge runs once per database. Its transaction records a marker row in
  `SERVER_MIGRATION_SQL_LOGS`, and it is skipped when that marker, or the log row of the old
  schemaChanges.sql purge's last statement (`DELETE FROM QRTZ_SCHEDULER_STATE`), exists under
  1.13.0. `migrate --force` reruns every data migration, and a second purge would drop the live
  server's schedules.
- A `QRTZ_SCHEDULER_STATE` check-in newer than twice its interval logs a warning and does not fail
  the migration: the lock already prevents the failure, and refusing would fail every upgrade that
  keeps the old server up during `migrate`.
- The nine `DELETE`s are removed from the shipped `1.13.0/{mysql,postgres}/schemaChanges.sql`. This
  is an exception to the append-only rule, safe here because statements are tracked by their own
  checksum and the parse of both files before and after the edit differs only by those nine
  statements. Flyway includes leading comments in a statement's text, so nothing replaced them.

## Consequences
- Clusters already past 1.13.0 are unaffected; 1.12.x upgrades and half-applied 1.13.0 databases
  get the purge from the Java step, so no manual SQL is needed.
- An old server left running after the purge can still write jobs back; on 2.0
  `AppScheduler.scheduleApplication` keeps an existing job, so stopping the old server before
  startup remains the operator's job.
- Removing statements from another shipped migration needs its own check that no remaining
  statement's text changes; this record does not license editing statements.
