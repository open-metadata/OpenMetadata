# The API never waits for search: writes are queued after the commit and failures are retried from the database

- **Status:** Accepted
- **Revisions:** v1 2026-10-10 (initial)
- **Deciders:** Sriharsha Chintalapani
- **Guard:** `AsyncSearchIndexConsistencyIT`, `SearchIndexRetryQueueIT`, `LiveSearchWritesTest`,
  `DeferredSearchWritesTest`, `OrderedLaneExecutorTest`, `SearchIndexRetryWorkerTest`,
  `ByQueryPolicyTest`, `SearchScopeRepairTest`
- **Related:** `docs/plans/2026-10-06-database-search-indexing-design.md`,
  `docs/plans/2026-10-06-database-projection-implementation.md` (steps 1 to 3),
  ADR:2026-10-07-repository-writes-commit-once-and-publish-effects-after-the-commit,
  ADR:2026-10-10-search-writes-are-ordered-by-when-their-content-was-read

## Context

Search writes ran on the request thread after the commit, and forced a refresh, so an API call's
latency included the search round trips of everything it changed. A failed write was retried three
times in 30 seconds and then dropped, and writes by query neither waited for their background task
nor recorded what they missed.

## Decision

- A request returns after its database commit. Its search writes are queued and applied on
  per-entity lanes (`LiveSearchWrites` over `OrderedLaneExecutor`: 8 to 32 lanes, 2,000 writes each);
  there is no read-your-write wait and no flag to restore one. Writes to other entities' documents
  (fan-outs) run once the writes queued before them are applied.
- A queued write is stamped with its queue time, and a write that rebuilds from the database with
  the time it reads, so a backlogged lane cannot overwrite a newer write.
- A failed or shed write becomes a row in `search_index_retry_queue` naming its entity, retried from
  the current database state with a doubling wait from 10 seconds up to an hour, for 32 attempts
  (about a day), before it is marked `FAILED`; an abandoned claim is reclaimed after 10 minutes.
- Writes do not force a refresh. Writes by query refresh their targets first, wait for their task
  and retry version conflicts up to three attempts; what is still undone is recorded as a repair
  scope that the retry worker rebuilds from the database.

## Consequences

Search is eventually consistent, typically by the time of one write; tests and server code read
the database, or wait for the queue (`POST /v1/test-support/search/queued-writes/await`), instead
of reading search right after a write. A crash between commit and the queued write loses the write
until the scheduled repair rebuilds the document. Search-side filters, including RBAC filters on
indexed owners, domains and tags, follow the same lag.
