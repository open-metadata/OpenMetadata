# An app trigger waits briefly for a finishing run before answering 409

- **Status:** Accepted
- **Revisions:** v1 2026-10-20 (initial)
- **Deciders:** Adrià Manero
- **Guard:** the finishing-run cases in `AppSchedulerTest` and `FinishingRunWaiterTest`;
  `AppTriggerConflictIT`
- **Related:** #35792

## Context

An app run reports a terminal status before Quartz releases it. After `execute()` returns, Quartz
calls registered job listeners first (`OmAppJobListener` writes `SUCCESS`), then removes the run from
`getCurrentlyExecutingJobs()`, then deletes the non-durable on-demand job and trigger rows. Apps such
as `DataInsightsApp` write `COMPLETED` even earlier, inside `execute()`. A client that waits for the
run to finish and triggers again was refused with a 500 "Job is already running" on the pod running
the job, and on any pod the leftover rows sent the trigger into the stale-entry recovery, which
deleted and rescheduled the same identity while the old run was still completing. If the new trigger
fired before the old completion committed, that completion deleted the new run's rows. Quartz signals
none of these steps to a listener, so they can only be observed by polling.

## Decision

- A trigger for an app whose run is still active is answered at once with 409
  (`AppAlreadyRunningException`), never 500.
- A run whose in-memory record is already terminal is finishing, not running. The trigger waits for
  Quartz to release it, polling every **200 ms** for at most **10 s**, then proceeds; a run still
  held after that is a 409.
- When scheduling collides with a stored job, the trigger first waits, under its own 10 s budget,
  for Quartz to delete it, re-reading the latest run on every poll. A run that becomes active
  during the wait, or a trigger still queued to fire (Quartz state `NORMAL`), is a 409; only a job
  that outlives the wait is stale and is cleared.
- "Terminal" is not treated as idle without that wait: `SearchIndexApp` still deletes orphaned
  indices after it writes its terminal status, so a new run started then could lose its staged
  indices.

## Consequences

- A trigger right after "completed" is accepted, typically within 0 to 200 ms. A request thread can
  wait up to 10 s per phase, and only while a run is finishing or a stored job is stale.
- Stale-entry recovery after a crashed pod now happens after about 10 s instead of at once.
- On the same pod, stop followed by an immediate re-trigger waits up to 10 s for the stopped run to
  exit and answers 409 only if it is still executing then. It used to start a second run at once,
  because the stop deletes the job.
- A run on another pod that stays in its post-terminal cleanup for longer than 10 s can still be
  cleared as stale. Revisit this, for example with a database-backed run lease, if such cleanups grow
  or the stale-entry WARN appears outside crash recovery.
