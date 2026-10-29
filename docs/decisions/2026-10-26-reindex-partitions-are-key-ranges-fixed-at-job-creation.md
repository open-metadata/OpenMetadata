# Reindex partitions are key ranges fixed when the job is created, and every server reads them from the partition row

- **Status:** Accepted
- **Revisions:** v1 2026-10-26 (initial); v2 2026-10-26 (boundary re-checked after each page read); v3 2026-10-27 (unsettled boundary fails the read)
- **Deciders:** Sonika Shah
- **Guard:** `DistributedReindexConcurrentWritesIT`, `PartitionWorkerTest`
  (`keyRangePartitionReadsFromItsStartKeyUntilTheReaderReportsNoMoreRows`,
  `keyRangePartitionIsRetriedFromItsStartKeyWhenARowReadFails`,
  `keyRangePartitionContinuesAfterABatchItCouldNotWrite`), `EntityRepositoryKeysetEndTest`
- **Related:** #36203

## Context

A distributed reindex counts each entity type when the job starts and splits it into partitions
of fixed offsets. Each partition read exactly `rangeEnd - rangeStart` rows from its start cursor,
and only the server that created the job knew those start cursors (an in-memory map); any other
server found its start with SQL `OFFSET` when it claimed the partition.

Rows created or deleted while the job ran therefore moved rows across partition boundaries. A row
created inside an unread partition pushed that partition's last row past its count; a row created
or deleted before an `OFFSET`-started partition shifted its whole window. Pushed rows were read by
no partition and disappeared from search when the new index was promoted, while the run reported
`failedRecords: 0`. Five creates during a run lost 5 existing tables on one server and 15–25 on two.

## Decision

- When the job is created, one keyset walk per entity type records the cursor at every partition
  boundary, and each partition row stores its `startKey` and `endKey`
  (`search_index_partition.startKey/endKey`). The first partition's start key is
  `SearchIndexPartition.FIRST_ROW` (empty); the last partition has no end key.
- A partition with a start key reads after it until the first row the DAO lists after its end key,
  whatever server claims it. The boundary comes from the DAO's own `listAfter`, so it follows that
  DAO's order and collation; no comparison happens in Java. The boundary is looked up again after
  each page read, and the page re-read if it changed, so a boundary row deleted between the two
  queries cannot carry the cursor past the end key. A boundary still changing after
  `MAX_BOUNDARY_CHECKS` (3) checks fails the read, so the partition is retried from its start key
  rather than continuing from a cursor that may be past its end.
- A partition without a start key (time series, a type whose walk failed, a partition created
  before this change) keeps the offset range.
- In a key range, a batch that was read but not written is counted failed and reading continues
  after it; a failed read fails the partition, which is retried from its start key.

## Consequences

- A row created during the run is read once by the partition whose range it falls in, or twice
  when it lands right at a boundary (both partitions upsert the same document); no existing row is
  skipped. Rows created after their range was read rely on the live write path, which is unchanged.
- A partition no longer stops at its count, so its success count can exceed `estimatedCount`.
- Each batch costs two extra single-row keyset queries to find and confirm the boundary.
- Time-series types still page by offset and are not covered.
