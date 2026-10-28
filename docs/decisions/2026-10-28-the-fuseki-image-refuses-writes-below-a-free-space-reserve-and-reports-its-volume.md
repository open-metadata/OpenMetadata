# The Fuseki image refuses writes below a free-space reserve and reports its volume

- **Status:** Accepted
- **Revisions:** v1 2026-10-28 (initial)
- **Deciders:** Platform
- **Guard:** `StorageGuardTest`, `CompactionGuardTest` (docker/rdf-store), `StorageGuardRefusalTest`,
  `StorageFactsTest`, `RdfStorageMaintenanceServiceTest`
- **Related:** #36437, ADR:2026-10-28-rdf-storage-maintenance-pauses-serving-writes-and-compacts-on-a-schedule

## Context

TDB2 memory-maps its files. A write that needs a page on a full volume does not fail with an error
the server can report: the JVM takes SIGBUS and exits, and does so again on every restart, so the
store stays down until someone frees space by hand. Compaction is the only way TDB2 gives space
back, and it needs free space about the size of the live data to copy it into. A scheduled
compaction once a day cannot protect a volume that a burst of ingestion fills within hours. Only
Fuseki can see its volume, and only Fuseki can refuse a write before TDB2 runs out of space
mid-commit; only OpenMetadata knows when compacting is safe.

## Decision

- OpenMetadata's Fuseki images (`docker/rdf-store` and the `openmetadata/fuseki` image built from
  `open-metadata/jena`) carry the same storage extension.
- **The write guard.** While the data volume has less usable space than
  `OPENMETADATA_STORAGE_MIN_FREE` (default `10%`; a percentage of the volume, or a size such as
  `20g`), every SPARQL update and Graph Store write gets HTTP 507 Insufficient Storage, the status
  RFC 4918 defines for this, and nothing is applied. Reads and compaction are never refused. This
  is the same idea as Elasticsearch's flood-stage disk watermark.
- **The storage report.** `GET /$/openmetadata/storage` returns JSON with `totalBytes`,
  `usableBytes`, `reserveBytes` and `lowOnSpace`.
- OpenMetadata maps a 507 to `RdfStorageLowDiskException`, a kind of
  `RdfStorageMaintenanceException`, so a refused write is deferred like a write held back by the
  maintenance pause: it uses no delivery attempt and trips no circuit breaker. Unlike the pause, the
  queue's lag still marks the projection degraded, because a full volume needs attention.
- **The compaction guard.** `POST /$/compact/<dataset>` gets 507 unless the volume has at least as
  much free space as the dataset's generation in service. TDB2 copies the live data into a new
  generation, and a volume that fills during the copy crashes the JVM with SIGBUS; the copy is never
  larger than the generation, so the check is conservative. Every caller is protected, including an
  operator compacting by hand.
- **Urgent compaction.** When a maintenance check finds the store reporting `lowOnSpace`, or free
  space below `storageMaintenance.urgentFreeSpacePercent` (50), it compacts without waiting for the
  interval, under the same locks and write pause. An urgent compaction that brings the store back
  above the threshold frees its slot at once. One that does not shows that data compaction cannot
  remove fills the volume, such as the live graph or other datasets on it, so urgent compactions
  wait for the next scheduled compaction and the server logs, at ERROR, that the volume needs
  expanding.
- The images start the JVM with `-XX:-CreateCoredumpOnCrash`: a crash core dump is as large as the
  heap and, in production, filled the node's disk and got the pod evicted.

## Consequences

- A full volume no longer crashes Fuseki: writes wait in OpenMetadata's durable queue until a
  compaction frees space, and resume on their own.
- The 507 contract and the report's JSON shape are shared by both images and the server. Changing
  either needs all three changed together.
- A store without the extension reports nothing: OpenMetadata falls back to the scheduled
  compaction alone, and a full volume still crashes it.
- The reserve only keeps the JVM alive. A compaction needs free space about the size of the live
  data, which is why urgent compaction starts at 50% free, long before the guard engages. Revisit
  both values if the live graph grows past half of its volume.
