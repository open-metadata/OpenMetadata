# Context Center processing writes use current snapshots

- **Status:** Accepted
- **Revisions:** v1 2026-10-30 (initial)
- **Deciders:** Pere Miquel Brull
- **Guard:** `ContextProcessingRepositoryTest`, `ContextProcessingConditionalWriteSqlTest`,
  `ContextFileProcessingServiceTest`, `ContextProcessingUpdatesTest`,
  `PageContextProcessingEngineTest`, `ContextFileIT`, `ContextMemoryExtractionIT`
- **Related:** [#36668](https://github.com/open-metadata/OpenMetadata/pull/36668)

## Context

Text extraction and document derivation can outlive foreground metadata edits. An entity version
alone does not identify the state a worker read: edits by the same user can consolidate into one
version. A job's request cache can also retain a snapshot throughout extraction.

The timestamp predicate and the updater's timestamp floor are complementary. Removing either
would let a processing result replace metadata from a consolidated edit.

## Decision

- Processing writes to `ContextFile` and `Page` rows compare both the snapshot's `version` and
  `updatedAt` in the database update. A conflict applies the processing change to a fresh snapshot.
- The file and page updaters choose the greater of the supplied timestamp and
  `original.updatedAt + 1` when both timestamps are present. Consolidated edits therefore advance
  the audit timestamp even when the clock has not advanced by a millisecond.
- Each conditional processing attempt has its own `FreshReadScope`, including file and content
  status updates. The scope excludes snapshots retained in the job's request cache and bypasses
  entity L1 reads. The existing `fromCache=false` reads already bypass L1; the scope also isolates
  request-cache entries and any related reads within the attempt.
- Retain the existing budget of ten conditional attempts. Retrying a statistics stamp reuses the
  computed result rather than repeating derivation. Exhausted text-processing updates resubmit
  through the text executor; exhausted file or page derivation updates enqueue replacement work
  in the persistent job queue. If recording a page failure exhausts its retries, enqueue another
  job and propagate the original extraction failure.

## Consequences

Processing records its own result against current metadata. Retries require fresh database reads,
and audit timestamps can move slightly ahead of the wall clock after same-millisecond writes.
Exhausted contention can repeat extraction in a later job. The stored entity shape and job arguments
are unchanged, so no schema migration is required.
