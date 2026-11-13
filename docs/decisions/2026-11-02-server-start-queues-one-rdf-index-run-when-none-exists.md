# Server start queues one `RdfIndexApp` run when none exists

- **Status:** Accepted
- **Revisions:** v1 2026-11-02 (initial) · v2 2026-11-12 (the key becomes a run started after a server last started or stopped with RDF off)
- **Deciders:** Ontology Studio program
- **Guard:** `RdfInitialIndexRunTest`, `RdfDisabledMarkTest`, `RdfFirstIndexRunIT`, `RdfProjectionStateResolverTest`, `RdfLiveWriteRecoveryIT`
- **Related:** ADR:2026-09-16-agent-sparql-execution, `AppResource.loadDefaultApplications`, `OmAppJobListener`, `RdfProjectionStateResolver`, ADR:2026-11-06-an-rdf-index-run-that-ends-before-indexing-leaves-the-projection-state-alone, #36440

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

## Amendment — 2026-11-12: nothing indexed since RDF was last off (#36440)

The key above, any run record, left two cases wrong. A server with RDF off still ran the weekly
`RdfIndexApp`, which completed with nothing indexed and wrote a `SUCCESS` record. Turning RDF on
later found a record, queued no run, and reported `READY` over a graph that was never built, or
that missed every change made while RDF was off. The same happened to an old `SUCCESS` record
after any off period.

- **The key is a run that touched the projection and started at or after `rdfDisabledAt`.** The
  column `rdf_projection_health.rdfDisabledAt` holds the last time a server started or stopped
  with RDF off, written with `GREATEST` so several servers cannot move it back. `RdfInitialIndexRun` queues one
  run when RDF is on and `RdfProjectionStateResolver.hasProjectedSinceRdfWasOff` is false. "No
  such run at all" is false, so the first-install case is unchanged. `triggeredBy` stays
  `system:rdf-initial-index`.
- **A run record that started after the mark stops further triggers, whatever its status.** A failed
  run is still not retried at every restart; the paragraph above on a failed first run holds.
- **A run that finds RDF off does not count.** It is recorded as a `SUCCESS` and flagged on its
  success context (ADR:2026-11-06-an-rdf-index-run-that-ends-before-indexing-leaves-the-projection-state-alone).
- **A start or stop with RDF off degrades the projection like a lost write.** The statement that writes
  `rdfDisabledAt` also raises `failureVersion`, so `/v1/rdf/status` reports `DEGRADED` through the
  existing health check, and only a completed rebuild of the entire projection that started
  afterwards repairs it. `REBUILDING` while a run is in flight is unchanged. The time is the
  trigger's key only. Deciding the state by comparing it with a run's start time was rejected: any
  successful run after the mark, a partial or non-recreate one included, would read as `READY`
  over a graph that still misses the changes, and two servers' clocks would decide the state.
- **The mark is written again when the server stops, twice.** A server with RDF off drops its writes for
  as long as it runs. A rebuild that began while it was still up (the new server of a rolling
  restart queues one at its own start) read `failureVersion` after the start mark, so on
  completion it would repair the projection and report `READY` over a graph that misses whatever
  the old server wrote after the rebuild passed it. The stop mark raises `failureVersion` after
  that read, so from the stop onwards the state is `DEGRADED`, whether or not the rebuild has
  completed. It is written when the stop begins (a Jetty lifecycle listener), because a
  shutdown that outlasts the platform's grace period is killed before any later hook runs: Jetty
  waits up to 30 s for open requests and Kubernetes kills a pod after 30 s by default. It is
  written once more by a lifecycle hook registered before `ManagedShutdown`, so after the hooks
  that stop the server's background writers; a scheduled job that is still running is not waited
  for. Recording on
  every skipped write was rejected: it adds a statement to every write of every install that does
  not use RDF.
- **Only a running server writes the mark, after migration validation, decided from
  `rdfConfiguration.enabled`.** The start mark is written in `OpenMetadataApplication.run` once
  the schema is validated, because it uses a column a pending migration adds.
  `OpenMetadataOperations` (the ops CLI) loads app seed data through
  `CollectionRegistry.loadSeedData` and never initializes `RdfRepository`; a mark written from
  there, or from `AppResource` or `RdfInitialIndexRun`, would claim RDF was off on a stack where
  it is on. `CollateApplication.run` calls `super.run`, so Collate records it too. The call does
  not live in `initializeCoreSearchInfrastructure`, which Collate overrides. A failure to write it
  only logs a warning that names the consequence.

**Exception to "no full reindex at deploy time".** A start with RDF on now queues a run after any
start with RDF off, not only on a new install. That is the one case where the graph is known to be
out of date, and the alternative is to serve it as current. The run uses the app's stored
configuration, which is a full rebuild (`recreateIndex: true`, all entity types) unless an admin
changed it. Where it is not a full rebuild the state stays `DEGRADED` until one is run; the
trigger does not override the configuration an admin chose.

**Known gaps, not closed here:**
- A database already at 2.1.0 that gets this change and RDF enabled in the same deploy never
  starts the new build with RDF off, so it records no mark and behaves as before: no run is
  queued. Where the earlier build stored its RDF-off run as a `SUCCESS` (builds of `main` between
  #37155 and this change) the state reads `READY` over a graph that was not built, until a full
  rebuild runs; where it stored it as `FAILED` the state reads `DEGRADED` until then. An upgrade
  from 2.0.x is not affected: the 2.1.0 migration deletes earlier `RdfIndexApp` run records, so
  the first-install rule above queues the run.
- A rolling restart that turns RDF on does not end `READY` by itself. The old server's stop mark
  follows the rebuild the new server queued, so the state is `DEGRADED` until another full rebuild
  runs: on demand, at the next RDF-on start, or by the weekly schedule. With several replicas each
  new server can queue a rebuild of its own. Nothing re-checks after the last old server stops;
  that needs RDF-on servers to re-evaluate the trigger while running, which is not built.
- Until the old server stops, a rebuild that has already completed leaves the state `READY`, and
  a write through the old server in that interval is missing from the graph.
- A server with RDF off that is killed without a stop signal writes no stop mark. Writes it took after a rebuild passed
  them are then missed while the state reads `READY`, until the next full rebuild.
- The scheduler is shared, so a server with RDF off can pick up the queued run and complete it
  with nothing indexed. The run is flagged and does not count; the state stays `DEGRADED` until
  the next RDF-on start or the weekly run.
