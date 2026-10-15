# Live RDF writes wait out store outages without spending attempts, and dead letters are replayed

- **Status:** Accepted
- **Revisions:** v1 2026-10-10 (initial)
- **Deciders:** Sriharsha Chintalapani
- **Guard:** `RdfLiveWriteRecoveryIT`, `RdfBlueGreenRebuildIT`, `RdfLiveWriterTest`,
  `RdfLiveWriteTest`, `RdfRepositoryProjectionHealthTest`
- **Related:** `docs/plans/2026-10-06-database-projection-implementation.md` (steps 1 and 3),
  ADR:2026-10-11-rdf-freshness-watermarks-have-one-writer-per-table

## Context

A live RDF write that failed while Fuseki was down spent one of its ten delivery attempts each
time, so an outage of a few minutes dead-lettered the queue head, and a dead letter stayed lost
until the next full rebuild.

## Decision

- A write that fails while the store does not answer waits 10 seconds and tries again without
  spending an attempt (`RdfStoreUnavailableException`); the projection reports `DEGRADED` as soon
  as the oldest write has failed. A write that fails while the store answers still counts.
- Every live write is applied from the database's current state, as a replay is: an entity write
  reloads its row, and an edge change applies only if the database still agrees with it, so a write
  delivered late cannot put back older data. A relationship stored as one row for both directions
  agrees with both of its edges. Producers keep the enqueue lock that RDF freshness needs.
- While the live queue is idle, up to 50 dead letters are replayed every 5 minutes once the store
  answers. Health clears only when every failure since the last repair was a replayed dead letter;
  a replay records an untracked write so reasoning results read before it are no longer current.
- Entity translation and transport batching live in one place (`RdfEntityProjection`) for live,
  recovery and rebuild writes.

## Consequences

An outage delays live RDF writes instead of losing them. A failure outside the queue, which leaves
no dead letter, still needs a rebuild; the scheduled RDF repair covers that. The 2.2.0 migration
adds `rdf_live_write_dead_letter.replayedAt`.
