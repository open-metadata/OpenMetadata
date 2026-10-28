# The Fuseki image refuses writes below a free-space reserve and reports its volume

- **Status:** Accepted
- **Revisions:** v1 2026-10-28 (initial)
- **Deciders:** Platform
- **Guard:** `StorageGuardTest`, `StorageReportTest` (docker/rdf-store), `StorageGuardRefusalTest`,
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
  `20g`), every SPARQL update and Graph Store write gets HTTP 503 with
  `X-OpenMetadata-Storage: low-disk`, `Retry-After: 30`, and a body that starts with
  `OpenMetadata storage guard`. Nothing is applied. Reads and compaction are never refused. The
  free space is rechecked at most once a second.
- **The storage report.** `GET /$/openmetadata/storage` returns JSON with `totalBytes`,
  `usableBytes`, `reserveBytes`, `lowOnSpace`, and per dataset `name`, `generation`,
  `generationBytes` and `orphanedGenerations`.
- OpenMetadata recognises a refusal by status 503 plus the body marker, because some clients
  surface only the body. It raises `RdfStorageLowDiskException`, a kind of
  `RdfStorageMaintenanceException`, so a refused write is deferred like a write held back by the
  maintenance pause: it uses no delivery attempt and trips no circuit breaker. Unlike the pause, the
  queue's lag still marks the projection degraded, because a full volume needs attention.
- **Urgent compaction.** The maintenance check runs every 5 minutes. When the store reports
  `lowOnSpace`, or free space below `storageMaintenance.urgentFreeSpacePercent` (50), it compacts
  without waiting for the interval, under the same reindex lock and write pause. An urgent
  compaction that brings the store back above the threshold frees its slot at once. One that does
  not shows the live graph itself fills the volume, so urgent compactions then wait one hour and the
  server logs, at ERROR, that the volume needs expanding.
- At startup the images delete TDB2 generations older than the serving one, left behind when the
  server stopped between switching to a compacted copy and deleting the old one. They also disable
  JVM core dumps, which in production filled the node's disk and evicted the pod.

## Consequences

- A full volume no longer crashes Fuseki: writes pause in OpenMetadata's durable queue until a
  compaction frees space, and resume on their own.
- The 503 contract, the header, the body marker and the report's JSON shape are shared by both
  images and the server. Changing any of them needs all three changed together.
- A store without the extension reports nothing: OpenMetadata falls back to the scheduled
  compaction alone, and a full volume still crashes it.
- The reserve only keeps the JVM alive. A compaction needs free space about the size of the live
  data, which is why urgent compaction starts at 50% free, long before the guard engages. Revisit
  both values if the live graph grows past half of its volume.
