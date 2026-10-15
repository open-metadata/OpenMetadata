# Cache misses that do I/O load outside the cache's lock

- **Status:** Accepted
- **Revisions:** v1 2026-10-14 (initial)
- **Deciders:** Ram Narayan Balaji
- **Guard:** `EntityCacheVirtualThreadTest`
- **Related:** #35428; #35374 and ADR:2026-10-13-jdbi-never-pins-virtual-threads-and-collate-runs-the-same-version

## Context

The server runs on JDK 21. A virtual thread that blocks while holding a Java monitor stays pinned
to its carrier, and there is one carrier per CPU. In six merge-queue stalls of the Postgres +
OpenSearch IT lane, all four carriers were pinned and the server stopped. Apart from Jdbi (fixed
in #35374), the pins were in the entity cache's Guava load, which reads Redis and the database
inside a `synchronized` on the entry. Caffeine's `get` and `ConcurrentHashMap.compute` also run
their loader inside `synchronized`, so changing cache library does not avoid it.

## Decision

Code that can run on a virtual thread does not do blocking I/O inside a cache loader, a `compute`
function, or a `synchronized` block. An entity-cache miss (`EntityRepository.loadOutsideCacheLock`)
reads the write epoch, runs the loader, `put`s the result, then re-checks the epoch and evicts
(throwing `LoaderRaceException`) if it moved.

## Consequences

Concurrent misses for one key may each run the loader once; Redis L2 absorbs most of the duplicate
reads. Switching `find` / `findByName` back to `CACHE_WITH_*.get`, or to a Caffeine loading `get`,
brings the pinning back. Revisit once the server runs on JDK 24 or later (JEP 491), where monitors
no longer pin virtual threads.
