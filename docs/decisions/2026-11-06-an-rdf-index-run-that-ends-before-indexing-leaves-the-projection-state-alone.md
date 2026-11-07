# An `RdfIndexApp` run that ends before indexing leaves the projection state alone

- **Status:** Accepted
- **Revisions:** v1 2026-11-06 (initial)
- **Deciders:** Chirag Madlani
- **Guard:** `RdfProjectionStateResolverTest`, `RdfIndexAppTest` (`RunLockTests`, `AdmissionTests`)
- **Related:** ADR:2026-11-02-server-start-queues-one-rdf-index-run-when-none-exists, ADR:2026-10-28-rdf-storage-maintenance-pauses-serving-writes-and-compacts-on-a-schedule, `RdfProjectionStateResolver`, `RdfIndexApp`

## Context
`RdfProjectionStateResolver` derived `/rdf/status` `projectionState` from the newest `RdfIndexApp`
run record and mapped `STOPPED` and `FAILED` to `DEGRADED`. Three kinds of run end before they
read or write a single triple: one that finds the reindex lock held by another run (an earlier
reindex, the start-up run, or a compaction), one that cannot take the lock at all, and a cron run
deferred behind a search reindex. Each still writes a `STOPPED` or `FAILED` record, so a redundant
trigger made the projection read `DEGRADED`, and agent SPARQL answered 503, until the next run
that actually indexed. The Playwright `rdf` lane hit this whenever its reindex trigger landed
while another run held the lock.

## Decision
- A run that ends before indexing (lock held, lock unavailable, deferred) records
  `failureContext.projectionUnchanged: true`. `RdfProjectionStateResolver.failureContext` is the
  only writer of that key; the resolver is the only reader.
- The resolver skips flagged records and derives the state from the newest record that is not
  flagged. Its status keeps the existing mapping, so a run stopped or failed mid-indexing is still
  `DEGRADED`. If only flagged records exist, it reports `REBUILDING`, as with no records.
- The run's own status is unchanged (`STOPPED`, or `FAILED` when the lock could not be taken),
  so the app's run history and failure alerting still show it.
- Every status read pages back through flagged records ten at a time and stops after five pages
  (50 records), reporting `REBUILDING` past that. The read runs on every agent SPARQL query and
  status call; 50 consecutive redundant runs with no indexing run between them means the
  projection has not been rebuilt for a long time, and `REBUILDING` says so.

## Consequences
A redundant trigger no longer takes agent SPARQL offline. A new early-exit path in `RdfIndexApp`
must set `projectionUnchanged` or it reintroduces the bug; the `RdfIndexAppTest` cases feed the
pushed record through the real resolver to catch that. Revisit this record if the resolver stops
reading the run store, or if a run can end before indexing but still change the projection.
