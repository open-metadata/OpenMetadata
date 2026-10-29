# Authorization caches retire generations after commit and load from fresh entity reads

- **Status:** Accepted
- **Revisions:** v1 2026-10-13 (initial)
- **Deciders:** Felipe Cardoso
- **Guard:** `RevocableLoadingCacheTest`, `SubjectCacheTest`, `CacheBundleTest`,
  `McpServerRequestContextTest`, `PolicyRevocationConcurrencyIT`, `RdfPolicyRevocationIT`
- **Related:** [#34826](https://github.com/open-metadata/OpenMetadata/issues/34826),
  [#34940](https://github.com/open-metadata/OpenMetadata/pull/34940)

## Context

A policy edit invalidated authorization before committing and skipped the post-commit invalidator
when the entity-cache provider was `none`. MCP workers retained a thread-local entity cache across
calls. Guava also lets an in-flight load finish after invalidation, repopulating the cache with
pre-edit rules and a fresh expiration time. Clearing an entry or shortening its TTL cannot make
revocation reliable.

## Decision

- Register `SubjectCache` invalidation independently of the entity-cache provider. After a local
  mutation commits, evict entity caches before retiring derived authorization generations, and
  complete that work before returning the mutation response. Rollbacks do not revoke grants.
- Partition both authorization caches into 32 bounded shards. A user invalidation retires its
  entire shard; policy, role, and team changes retire the relevant whole caches. Case-insensitive
  shard selection covers spelling variants; entries inside a shard remain case-sensitive.
- A reader uses only an active generation. If a load overlaps retirement, retry against the active
  generation up to three times, then read uncached. A reader beginning after retirement cannot
  join a pre-retirement load. Discarded loads cannot publish into the active generation.
- Policy and user-context loaders use `FreshReadScope`, including retries and uncached fallback.
  Its empty request cache excludes state retained on a worker. Its entity L1 bypass excludes old
  rows reloaded during a transaction or published after post-commit eviction. Base entities come
  from the database; this does not replace the separate team-hierarchy and relationship caches.
- MCP tool and prompt callbacks clear request state on entry and exit on the executing worker.
  Set the current call's identity and impersonator after entry cleanup and retain them through
  execution and audit recording.
- Keep cumulative hit, miss, load, timing, and eviction counters independently of shard generations,
  including loads that finish after retirement. Do not retain old caches merely for their statistics.

## Consequences

At a configured capacity of 10,000 entries, one user write can discard about 312 cached entries
in each affected cache, depending on occupancy and name distribution. Subsequent authorization
misses reload base entities from the database and reconstruct policy inputs. This trades increased
read work under frequent writes for a simple revocation guarantee and bounded memory. Split the
configured capacity exactly across shards; small capacities may leave some shards unable to retain
entries. Policy and user-context TTLs remain two and fifteen minutes, respectively.

Per-key epoch checks were rejected because a later reader can still join an earlier Guava load.
A single cache with striped generation tags must reject both stored and joined obsolete loads;
a value tag alone cannot prevent joining an old Guava load. Generation-keyed loads avoid that join,
but still invalidate neighboring users sharing the stripe and leave obsolete entries occupying the
bounded cache until eviction. Per-user generation tracking could reduce collateral reloads, with
additional lifecycle and memory-bound requirements. Revisit only with measured database pressure
and equivalent deterministic race coverage.

The guarantee is local: a new authorization decision after a successful response uses the committed
policy on that server. Redis propagation to peers remains asynchronous; already authorized calls
are not cancelled. A global synchronous revocation barrier is a separate decision.
