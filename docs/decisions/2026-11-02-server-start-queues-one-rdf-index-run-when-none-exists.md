# Server start queues one `RdfIndexApp` run when none exists

- **Status:** Accepted
- **Revisions:** v1 2026-11-02 (initial)
- **Deciders:** Ontology Studio program
- **Guard:** `RdfInitialIndexRunTest`, `RdfFirstIndexRunIT`, `RdfProjectionStateResolverTest`
- **Related:** ADR:2026-09-16-agent-sparql-execution, `AppResource.loadDefaultApplications`, `OmAppJobListener`, `RdfProjectionStateResolver`

## Context
`RdfProjectionStateResolver` reads the latest `RdfIndexApp` run record. With no record it reports
`REBUILDING`, and the agent SPARQL path answers 503 `PROJECTION_NOT_READY` in every state except
`READY` (ADR:2026-09-16-agent-sparql-execution). The seed in `json/data/app/RdfIndexApp.json`
schedules the app weekly (`0 0 * * 6`), and installing it does not run it. A new install with RDF
enabled therefore refused agent queries until the first Saturday run, up to seven days.

## Decision
- When `AppResource.loadDefaultApplications` reaches `RdfIndexApp` at server start, it calls
  `RdfInitialIndexRun.enqueueIfNeverRun`. If RDF is enabled and the app has no `status` record in
  the app extension time series, the call queues one on-demand run through
  `ApplicationHandler.triggerApplicationOnDemand`, with `triggeredBy` set to
  `system:rdf-initial-index`.
- The idempotency key is the existence of any run record, whatever its status: `SUCCESS`,
  `FAILED`, `RUNNING`, `STOPPED` or any other. A restart, an upgrade or a reinstall that finds a
  record queues nothing.
- The call comes after the app row is persisted. `OmAppJobListener.jobToBeExecuted` loads the app
  by name, so a run that starts before `repository.initializeEntity` has written the row fails.
  The ordering spans two classes and no single file shows it.
- The call never fails startup. A refused enqueue is logged as a warning. No record exists then,
  so the next start tries again, and the weekly run remains the fallback.
- The weekly schedule is unchanged.

A failed first run is not retried at the next start. `OmAppJobListener` writes the run's terminal
status, so a failed run leaves a `FAILED` record. The resolver maps that record to `DEGRADED`,
agent SPARQL keeps answering 503, and the next start finds a record and queues nothing. The
projection is built by the next weekly run, or by an administrator who runs `RdfIndexApp` from
**Settings > Applications**. A retry on every start would repeat a full rebuild
(`recreateIndex: true`) at each restart, including the restarts an administrator makes while
fixing the cause.

Two servers that start together on a new install can both find no record, because the check and
the enqueue are not one transaction. Both use the same on-demand job identity in the clustered
Quartz store. `AppScheduler.scheduleOnDemandJob` replaces a queued job that has no active run
record and refuses a second job while a run is active.

## Consequences
On a new install with RDF enabled, the projection reaches `READY` once the first run finishes,
without waiting for the weekly schedule. An install whose first run fails stays `DEGRADED` until
a later run succeeds. Waiting for the weekly run was the alternative, and it left agent SPARQL
unavailable for up to a week on every new install. Revisit this record if the resolver stops
reading the run store, or if another job starts building the projection.
