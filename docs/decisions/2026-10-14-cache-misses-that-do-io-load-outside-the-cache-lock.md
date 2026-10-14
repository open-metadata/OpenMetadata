# Cache misses that do I/O load outside the cache's lock

- **Status:** Accepted
- **Revisions:** v1 2026-10-14 (initial)
- **Deciders:** Ram Narayan Balaji
- **Guard:** `EntityCacheVirtualThreadTest`, `SingleFlightTest`; reviewer for new cache loaders
- **Related:** #35428; #35374 and ADR:2026-10-13-jdbi-never-pins-virtual-threads-and-collate-runs-the-same-version; open-metadata/openmetadata-collate `ChatLockService`

## Context

The server runs on JDK 21. A virtual thread that blocks while it holds a Java monitor stays pinned
to its carrier, and the scheduler has only one carrier per CPU. In six merge-queue stalls of the
Postgres + OpenSearch IT lane, every carrier on a four-CPU runner was pinned, and the server stopped.
After the Jdbi fix (#35374), the pinning left in those dumps came from the entity cache's Guava load,
which reads Redis and the database while Guava holds a `synchronized` on the entry.

Guava's `LoadingCache.get` and `Cache.get(key, Callable)`, Caffeine's `LoadingCache.get` and
`Cache.get(key, Function)`, and `ConcurrentHashMap.compute` / `computeIfAbsent` all run their
loader inside `synchronized`; on JDK 21 the `ConcurrentHashMap` methods contain `monitorenter`.
Switching cache library does not avoid it.

## Decision

Code that can run on a virtual thread does not do blocking I/O (database, Redis, HTTP, Flowable)
inside a cache loader, a `compute` function, or a `synchronized` block. A cache miss that has to
read:

- uses `SingleFlight` (`org.openmetadata.service.util`) when concurrent misses for one key must
  share a single read. `EntityRepository` `loadById` / `loadByName` and `EntityStatusWorkflows` do;
- otherwise checks `getIfPresent`, reads, then calls `put`, accepting that racing misses may both read;
- if a writer can invalidate the entry while a read is in flight, re-checks a counter the writer
  bumps before evicting (the entity write epoch, `EntityStatusWorkflows` invalidations) after the
  `put`, and evicts if it moved.

A lock that must be held across I/O is a `ReentrantLock`, not `synchronized`.

## Consequences

A slow database or Redis now makes requests wait without stopping the virtual-thread scheduler.
A cache library can no longer guarantee "an eviction discards an in-flight load", because that
guarantee needs the load to run under the cache's lock. The epoch or counter re-check after the
`put` provides it instead. A change that moves the entity caches back to a loading `get`, as an
open Caffeine migration would, re-introduces the pin unless it keeps this shape.

Request-path caches that only run on virtual threads with `SERVER_ENABLE_VIRTUAL_THREAD=true`
(`SubjectCache`, `SettingsCache`, the JWKS fetch) still load under their own lock and are left for
a follow-up. Revisit this record once the server runs on JDK 24 or later, where JEP 491 stops
monitors from pinning virtual threads.
