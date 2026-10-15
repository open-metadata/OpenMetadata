# Search writes are ordered by when their content was read (sourceReadAt), not by when they arrive

- **Status:** Accepted
- **Revisions:** v1 2026-10-10 (initial)
- **Deciders:** Sriharsha Chintalapani
- **Guard:** `SearchVersionGuardTest`, `SearchDocumentUpdatesTest`, `SearchRepositoryBehaviorTest`
  (`createEntityIndexWritesTheDocumentGuardedByWhenItWasRead`,
  `createEntitiesIndexWritesDocumentsGuardedByWhenTheyWereRead`, the time-series write tests),
  `SearchDocumentUpdatesTest.aRelationshipReplacementIsOrderedByItsRevisionAlone`,
  `BulkWriteOptionsTest`, `SearchIndexSettingsTest`
- **Related:** `docs/plans/2026-10-06-database-search-indexing-design.md`,
  `docs/plans/2026-10-06-database-projection-implementation.md` (in-place reindex, step 1)

## Context

Live writes, reindex batches, retries and repairs all write the same documents, from different
servers and at different delays. Ordering them by arrival lets a write that read the database
earlier replace a document written from a later read: a reindex batch read before an edit, or a
retry that waited out an outage, puts back older content and nothing corrects it.

## Decision

- Every guarded write carries `sourceReadAt`, the epoch millis at which the content it writes was
  read from the database, and stamps it on the document. The engine applies the write unless the
  stored document carries a later `sourceReadAt`; a document without one (written before this
  change) always takes the write.
- Creates (single and bulk), updates, soft delete and restore, time-series records and reindex
  bulk upserts are guarded (`SearchVersionGuard`, `BulkWriteOptions`, `SoftDeleteScript`). A write
  queued to run later is stamped with the time it was queued (`SearchVersionGuard.readAt`).
- A fenced relationship replacement (a test case's `testSuites`, a logical suite's `tests`) is
  ordered by its relationship revision alone, and is neither checked against nor stamped with
  `sourceReadAt` (`SearchDocumentUpdates.isRelationshipReplacement`): concurrent membership changes
  can be prepared in any order, and the one carrying the newest revision must land. The rest of such
  an entity's document is still guarded by read time.
- Every index built from now on declares `sourceReadAt` as a `long`
  (`SearchIndexSettings.forIndexCreation`), so its type does not depend on the first write.
  Readers that deserialize documents strictly drop it, as time-series listings do.
- Entity, column, time-series and pipeline-execution documents are built in one place
  (`SearchDocumentBuilder`), and `SearchDocumentUpdates` decides partial versus full updates, for
  live writes, reindex, retries and repair alike.

## Consequences

The last write by read time wins; a stale read never overwrites a fresher one, whichever arrives
last. Server clocks order the writes, so servers whose clocks disagree by more than the gap between
two writes of one entity can drop the later one until the next write or repair. A new write path
must go through the guard, or it reintroduces arrival order for the documents it touches.
