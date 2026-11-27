# RDF freshness inputs have one writer each: retire for queue rows, RdfRebuildStore for the active dataset

- **Status:** Accepted
- **Revisions:** v1 2026-10-11 (initial)
- **Deciders:** Sriharsha Chintalapani
- **Guard:** `RdfLiveWriteRecoveryIT#aDeliveredWriteFromAnOlderServerStaysInTheEnqueuedWatermark`,
  `RdfLiveWriteRecoveryIT#aDeadLetteredWriteFromAnOlderServerStaysInTheEnqueuedWatermark`,
  `RdfSourceRevisionIT`, and `RdfBlueGreenRebuildIT`
- **Related:** [#35198](https://github.com/open-metadata/OpenMetadata/issues/35198),
  [#35199](https://github.com/open-metadata/OpenMetadata/pull/35199),
  [#34975](https://github.com/open-metadata/OpenMetadata/pull/34975),
  `docs/plans/2026-10-07-fuseki-native-reasoning.md` (mutations, generations, and freshness)

## Context

A reasoning result is `CURRENT` only while the serving generation in `rdf_active_dataset` is
unchanged and its live-write watermark covers the highest enqueued queue ID
(`ReasoningFreshness`). `enqueuedWatermark()` is the greater of
`rdf_projection_health.enqueuedWatermark` and the highest ID still in `rdf_live_write_queue`.
Servers that predate the column enqueue without raising it, so their queue row is the only trace
of a write until it is removed; removing it without raising the column lets an older result be
reported `CURRENT`. Likewise, a promotion that changes the dataset without a new generation
leaves results from the old dataset `CURRENT`.

## Decision

- **Queue rows leave only through `RdfLiveWriteStore.retire`**, which deletes the row and raises
  `enqueuedWatermark` to its ID in the same transaction. Delivery, dead-lettering and
  `recordUntrackedWrite` all use it; no other code deletes from `rdf_live_write_queue`.
- **`RdfRebuildStore` is the only writer of `rdf_active_dataset`.** It assigns a new generation
  UUID at every promotion, including back to a reused physical dataset name, and assigns one to
  a pointer written before the column existed. The unused DAO writers that could change the
  dataset without a generation were removed.

## Consequences

Freshness stays exact for writes from servers on the previous version once they are drained, and
every dataset change is visible as a generation change. A new path that removes queue rows (a
purge, a retention job) or moves the active dataset must go through these two owners, or it
silently makes stale results look current. Two gaps remain during a rolling upgrade and are
documented in `docs/rdf-production-setup.md`: an older server draining its own write, and an
older server promoting a blue/green build with the previous `UPDATE`, which keeps the generation.
