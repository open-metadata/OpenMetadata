# RDF storage maintenance pauses serving writes and compacts the serving dataset on a schedule

- **Status:** Accepted
- **Revisions:** v1 2026-10-28 (initial)
- **Deciders:** Platform
- **Guard:** `RdfStorageMaintenanceIT`, `RdfStorageMaintenanceServiceTest`, `FusekiCompactionTest`,
  `CompactionBlockedWriteTest`, `RdfIndexAppTest`, `RdfLiveWriteTest`
- **Related:** #36437

## Context

TDB2 copies every index page a write transaction touches and keeps the old pages until the dataset
is compacted. Rewriting one entity costs several hundred kilobytes of disk, so a store that only
receives live writes grows by tens of gigabytes a night under ingestion. Until this decision only the
RDF reindex app compacted, and it compacted only after its `CLEAR ALL`, which ran under the 60-second
request timeout. On a large store the clear timed out, the run failed, and nothing was compacted
again, until the volume filled and Fuseki crashed on every restart.

Fuseki also blocks every writer of a dataset for the whole compaction. A live write that reached
Fuseki meanwhile timed out, used one of its ten delivery attempts, and after enough of them was
dead-lettered, marking the projection degraded until a full rebuild.

## Decision

- One server compacts the serving dataset every `storageMaintenance.compactionIntervalHours` (24).
  The slot is a lease, `RDF_STORAGE_NEXT_COMPACTION`, in `rdf_reindex_lock`, taken for one interval.
  A compaction Fuseki never started releases it, so the next check (every 15 minutes) retries.
  One Fuseki started and that did not succeed keeps it: it failed or restarted Fuseki because the
  volume cannot hold the copy, or it is still copying, and retrying would only repeat that. A
  failed copy also stays allocated until Fuseki restarts, so the error asks for a bigger volume and
  a restart.
- One rule makes a stopped schedule visible, whatever stopped it (failures, a reindex or inference
  run holding its lock, a store that cannot be reached): each successful maintenance compaction is
  recorded in `rdf_projection_health.lastCompactedAt`, and once none has succeeded for two intervals
  every check logs an error and the RDF projection status reads `DEGRADED` until one does.
- Maintenance holds the RDF reindex and inference locks while it runs, so it never overlaps an
  indexing or inference run. The first check runs five minutes after a server starts. Nothing
  waits for a rolling upgrade: a compaction copies only the live data, so it is short, and a server
  too old to know the pause just waits out a compaction shorter than its request timeout.
- Before anything blocks Fuseki's writer, maintenance takes the write pause, a lease named
  `RDF_LIVE_WRITES_PAUSED` in the same table, and waits for in-flight serving writes to finish.
  `RdfDatasetManager.writeActive` then holds back every other writer. A live-write queue entry is
  deferred at once, using no delivery attempt and not tripping the circuit breaker. Any other
  writer, which nothing retries, first waits for the pause to end up to the RDF request timeout,
  as long as Fuseki's own writer lock would have kept it waiting, and only then gets
  `RdfStorageMaintenanceException`, which the REST API answers with 503 and `Retry-After`. The pause
  expires unless renewed, so a server that stops mid-maintenance holds writes for at most five
  minutes.
- How a write meets the pause, and who owns its failure, travels with the storage handle a writer
  is given (`RdfWriteDelivery`), not with the thread it runs on. The live-write queue's handle is
  held back at once and its failures stay the queue's; every other handle waits and marks the
  projection degraded on failure; the maintenance job writes through its own pause with the
  handle the pause hands it, checked against the lease's job id.
- The pause ends only on Fuseki's answer: a status poll that fails counts as still running. A write
  that times out while Fuseki reports a running compaction, whoever started it, is held back like a
  paused write instead of counting as failed.
- Pipeline run triples go through the live-write queue, so a maintenance window does not lose them.
- After a blue/green promotion, the run empties and compacts the dataset it retired, which
  nothing reads again, so between runs only the serving dataset holds a full copy. A build that
  fails or is stopped is kept for inspection, and the next build clears it.
- Compaction and the clear that starts an in-place rebuild run under
  `storageMaintenance.maxDurationMinutes` (240), not the per-request timeout, and do not consult or
  feed the circuit breaker. A `CLEAR` cannot be cancelled in Fuseki, so a shorter budget only
  abandons a clear that still completes.
- An in-place rebuild clears, then always compacts, then reloads the ontologies. A clear that fails
  is still followed by the compaction, and then fails the run.
- A compaction counts as succeeded only when Fuseki's task reports `success: true`. A task Fuseki no
  longer reports, or that is not a compaction, is `UNKNOWN`, never success.

## Consequences

- Disk use tracks the live graph plus at most one interval of growth, without operator action.
- Maintenance delays live writes by the compaction's duration; it no longer loses them.
- Any new code path that writes the serving dataset must go through `writeActive`, or it bypasses
  the pause and may block on Fuseki during a compaction.
- Revisit the interval if a deployment grows faster than its volume allows within one interval.
