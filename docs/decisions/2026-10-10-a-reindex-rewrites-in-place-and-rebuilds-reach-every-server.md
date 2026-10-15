# A reindex rewrites unchanged indexes in place, and a new-index rebuild receives every server's live writes

- **Status:** Accepted
- **Revisions:** v1 2026-10-10 (initial)
- **Deciders:** Sriharsha Chintalapani
- **Guard:** `SearchReindexInPlaceIT`, `SearchReindexInPlaceRunIT`, `SearchWriteRoutesIT`,
  `SearchIndexPartitionStartIT`, `SearchIndexPromotionIT`, `ReindexModePlannerTest`,
  `StagedIndexRoutesTest`, `RebuildAwareEntityManagementTest`, `StagedIndexCompletenessTest`,
  `DefaultRecreateHandlerTest`, `BulkOutageRetryTest`
- **Related:** `docs/plans/2026-10-06-database-search-indexing-design.md`,
  `docs/plans/2026-10-06-database-projection-implementation.md` (in-place reindex, steps 1 and 3),
  ADR:2026-10-10-search-writes-are-ordered-by-when-their-content-was-read

## Context

A full reindex promoted an empty index for every type it could not refill, which erased pipeline
execution history. On several servers, a rebuild promoted an index that missed the live writes the
other servers handled, because only the server running the rebuild knew the staged index. A failed
or stopped run could still replace a complete serving index with a partial one.

## Decision

- Each type is rewritten in place with guarded upserts plus a sweep of documents whose rows are
  gone, rebuilt into a new index when its mapping hash changed or `force` is set, or skipped.
- A new-index run publishes its staged indexes in `search_index_write_route`; every server
  refreshes the routes every second under a 30 second lease, and the run waits for them to
  propagate before reading rows. While a route exists, live writes go to the serving index and
  the staged one (`RebuildAwareEntityManagement`), so neither falls behind.
- A failed run never replaces a serving index that holds documents, and discards what it staged
  after unregistering its routes. Before a new index is promoted, rows the partitions did not reach
  are written to it.
- Each partition records the key it starts after when the job is created, instead of finding it
  with `OFFSET`.
- A reindex bulk batch rides out a search outage for about ten minutes (up to 60 attempts, the
  delay capped at 100 times the first wait) and retries documents rejected with 429; bulk writes
  use a connection pool of their own.

## Consequences

A routine reindex keeps the serving index and its history; only a mapping change or `force` builds
new indexes. Rebuilding into a new index costs every server a second write per document for the
rebuild's duration. A new live write path must go through the search client so it reaches staged
indexes; one that names an index directly (a raw request) is lost at promotion.
