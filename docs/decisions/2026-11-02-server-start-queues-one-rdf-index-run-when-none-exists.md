# Server start queues one `RdfIndexApp` run when none exists

- **Status:** Accepted
- **Revisions:** v1 2026-11-02 (initial) · v2 2026-11-12 (a server that ran with RDF off marks the projection not ready; the key stays any run record)
- **Deciders:** Ontology Studio program
- **Guard:** `RdfInitialIndexRunTest`, `RdfDisabledMarkTest`, `RdfDisabledMarkLifecycleIT`, `RdfFirstIndexRunIT`, `RdfProjectionStateResolverTest`, `RdfLiveWriteRecoveryIT`
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

## Amendment — 2026-11-12: a server that ran with RDF off marks the projection not ready (#36440)

The key above, any run record, left a case wrong. A server with RDF off still ran the weekly
`RdfIndexApp`, which completed with nothing indexed and wrote a `SUCCESS` record. Turning RDF on
later found that record and reported `READY` over a graph that was never built, or that missed
every change made while RDF was off. The key stays "any run record" (v1 is unchanged); what
changes is that the state no longer trusts the graph after RDF was off.

- **A server with RDF off marks the projection like a lost write.** `RdfDisabledMark` calls
  `RdfLiveWriteStore.recordRdfDisabled`, which raises `failureVersion` and sets `lastError`, as
  `markDegraded` does. `/v1/rdf/status` then reports `DEGRADED` through the existing health check,
  and only a completed rebuild of the entire projection that started afterwards repairs it: the
  agent SPARQL path answers 503 until then. `REBUILDING` while a run is in flight is unchanged.
- **A run that finds RDF off does not count.** It is recorded as a `SUCCESS` flagged on its success
  context, and the resolver skips it, as it skips a flagged failure
  (ADR:2026-11-06-an-rdf-index-run-that-ends-before-indexing-leaves-the-projection-state-alone).
  With only such runs the state is `REBUILDING`.
- **The mark is written three times.** A server with RDF off drops its writes for as long as it
  runs. A rebuild that began while it was still up (a rolling restart) read `failureVersion` after
  the start mark, so on completion it would repair the projection over a graph that misses
  whatever the old server wrote after the rebuild passed it. So the mark is written when the
  server starts; when its stop begins (a Jetty lifecycle listener), because a shutdown that
  outlasts the platform's grace period is killed before any later hook runs (Jetty waits up to 30 s
  for open requests and Kubernetes kills a pod after 30 s by default), with a wait of at most 5 s,
  because nothing has stopped yet and a database that does not answer must not hold the whole
  shutdown; and at the end of its stop, from a hook registered before `ManagedShutdown`, so after
  the hooks that stop the server's background writers. Each write raises `failureVersion` after any
  rebuild read it, so from the stop onwards the state is `DEGRADED`. Recording on every skipped
  write was rejected: it adds a statement to every write of every install that does not use RDF.
- **Only a running server writes the mark, after migration validation, decided from
  `rdfConfiguration.enabled`.** `OpenMetadataOperations` (the ops CLI) loads app seed data through
  `CollectionRegistry.loadSeedData` and never initializes `RdfRepository`; a mark written from
  there, or from `AppResource`, would claim RDF was off on a stack where it is on.
  `CollateApplication.run` calls `super.run`, so Collate records it too. The call does not live in
  `initializeCoreSearchInfrastructure`, which Collate overrides. A failure to write it only logs a
  warning that names the consequence.
- **The rebuild after enabling RDF is an explicit step.** A start-up rebuild after RDF was off was
  built and then rejected. It queued a full in-place rebuild at start-up on any enablement. On a
  rolling restart it still ended `DEGRADED`, because the old server's stop mark follows the
  rebuild, so a second rebuild was needed anyway. And the team handles reindexing as an explicit
  step, like search: a deploy step, the application page, the API or `openmetadata-ops.sh
  reindex-rdf`. The weekly schedule remains the fallback.
- **A column for the time of the last RDF-off start was removed with it.** It existed only so the
  start-up run could ask whether a run had started since. With no such run, nothing reads it, and
  deciding the state by comparing it with a run's start time was rejected earlier: any successful
  run after the mark, a partial or non-recreate one included, would read as `READY` over a graph
  that still misses the changes, and two servers' clocks would decide the state. The change adds
  no schema.

**Known gaps, not closed here:**
- A rolling restart that turns RDF on is `DEGRADED` after the old server stops, until a full
  rebuild runs after that. Until the old server stops, a rebuild that has already completed leaves
  the state `READY`, and a write through the old server in that interval is missing from the graph.
- A server with RDF off that is killed while it drains has only the mark from the beginning of
  its stop. A rebuild that starts inside that interval repairs the projection although the
  server's last writes are missing.
- A server with RDF off that is killed without a stop signal writes no stop mark. Writes it took
  after a rebuild passed them are then missed while the state reads `READY`, until the next full
  rebuild.
- A wiped or replaced Fuseki store is not detected: the state follows the run records and the
  health row, which say nothing about the store's contents.
- A database already at 2.1.0 that gets this change and RDF enabled in the same deploy never
  starts the new build with RDF off, so it records no mark and behaves as before, and no run is
  queued. Where the earlier build stored its RDF-off run as a `SUCCESS` the state reads `READY`
  over a graph that was not built, until a full rebuild runs. An upgrade from 2.0.x is not
  affected: the 2.1.0 migration deletes earlier `RdfIndexApp` run records, so the first-install
  rule above queues the run.

**Follow-up idea, not built:** let the agent SPARQL path answer from a graph that only misses some
changes, with a staleness hint in the response, instead of refusing in every state but `READY`.
That would make the interval after RDF was off less costly, and needs its own decision on what
an agent may be told about a graph it cannot vouch for.
