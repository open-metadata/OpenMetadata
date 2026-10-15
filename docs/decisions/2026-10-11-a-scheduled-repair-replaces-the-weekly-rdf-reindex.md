# A scheduled repair on one server at a time replaces the weekly RDF reindex

- **Status:** Accepted
- **Revisions:** v1 2026-10-11 (initial)
- **Deciders:** Sriharsha Chintalapani
- **Guard:** `RdfRepairIT`, `RdfRepairJobTest`, `ChangedEntitiesRdfRepairTest`, `RdfOrphanSweepTest`,
  `RdfProjectionCheckTest`, `RdfProjectedEntitiesTest`, `ReindexScheduleMigrationTest`
- **Related:** `docs/plans/2026-10-06-database-projection-implementation.md` (step 4),
  ADR:2026-10-11-a-scheduled-repair-replaces-the-weekly-search-reindex,
  ADR:2026-10-10-live-rdf-writes-wait-out-store-outages-and-replay-dead-letters

## Context

The RDF projection was kept current only by live writes and a weekly full rebuild, so a write lost
outside the queue, a hard delete whose removal failed, or a projection that was never built stayed
wrong for up to a week.

## Decision

- The RDF repair runs on the same schedule as the search repair (`ScheduledRepairJob`: every 15
  minutes, one server at a time), holding `RDF_REPAIR_LOCK` in `rdf_reindex_lock`, with its window
  in `projection_repair_state`. It waits while RDF is off or unreachable, while an RDF rebuild runs,
  and while the oldest queued live write has waited more than a minute (`SETTLE`): entities still
  queued would look stale and be queued twice.
- A pass refreshes, through the live-write queue, every entity whose row changed after its
  projection's `dct:modified`, or that has no projection. Once a day it removes projected entities
  whose rows are gone, listing a type only when the store holds more of its entities than the table
  has rows.
- A full rebuild is started when the projection was never built, the ontology graph is missing, or
  the last rebuild failed at least a day ago; a stopped rebuild stays stopped.
- The RDF reindex app ships with no schedule; the 2.2.0 migration moves installs on the shipped
  Saturday 00:00 schedule to on-demand runs and keeps any other.

## Consequences

The RDF projection heals within about 15 minutes, and a fresh install builds it on its own. Entity
types without an `updatedAt` column are covered only by the daily sweep and full rebuilds, and lost
relationship or lineage edge writes wait for a rebuild.
