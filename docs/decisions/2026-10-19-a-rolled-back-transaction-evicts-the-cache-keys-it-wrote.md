# A rolled-back transaction evicts the cache keys it wrote

- **Status:** Accepted
- **Revisions:** v1 2026-10-19 (initial)
- **Deciders:** Pere Miquel Brull
- **Guard:** `DeferredCacheInvalidationTest`; `OntologyConceptResourceIT` and
  `OntologyPropertyResourceIT` `nativeDefinitionIriSurvivesUpdatesAndRestoration` in the
  PostgreSQL + Elasticsearch + Redis lane (`-Pcache-tests`)
- **Related:** #35672;
  ADR:2026-10-13-a-memory-conflict-opens-a-review-task-and-approving-it-supersedes-the-disputed-memory

## Context

A write inside `executeInTransaction` or `flushInOneTransaction` evicts the entity from the
in-JVM cache at once and defers the Redis eviction to the commit. A later step of the same unit of
work can read the entity back. That read misses, loads the uncommitted row and caches it in L1 and
Redis. When a still later step refuses the unit, the database rolls back, but the deferral scope
discarded its keys, so both caches served the row the rollback undid until the 500 ms repair or
the TTL.

A PUT that restores a soft-deleted ontology definition and then rejects its changed IRI left the
definition cached as restored, so `GET ?include=deleted` answered 404. Only the Redis IT lane,
which is not a required check, caught it. ContextMemory conflict decisions had already patched the
same failure for themselves by evicting on their own failure path.

## Decision

A transaction that does not commit evicts every key its writes recorded the same way a commit does.
Those are the keys `invalidate` and `invalidateCacheForEntity` record for updates, restores and
deletes of an entity type Redis caches. The write epochs move, the Redis keys go in one DEL, L1 and
the Redis caches derived from the entity are evicted, and the repair is re-armed. A deadlock replay
keeps the keys of the attempt it abandons, so the final commit or rollback evicts them too.

## Consequences

Eviction is always safe: the next read loads the committed row. A failed write now costs the same
Redis round trips as a committed one, and failures after a write are rare. Code whose failed writes
are updates of a Redis-cached type needs no eviction of its own, so the ContextMemory decision's
eviction was removed.

The rule does not cover everything. Code that writes one of the following, reads it back and can
still fail afterwards evicts what it wrote itself:

- **Inserts.** An insert records at most a by-id key, through its relationships, so its by-name
  entries survive a rollback. `OntologyChangeApplicationService` evicts what it created.
- **Types Redis never caches** (`UNCACHED_ENTITY_TYPES`: user, task, the workflow types,
  testCaseResolutionStatus, bot, domain, dataProduct). Their writes record no key, so a rollback
  leaves an L1 copy cached by such a read until the repair or the TTL.
- **Repositories whose update bypasses `store()`.** `TaskRepository` and
  `TaskFormSchemaRepository` update through the DAO without `invalidate`.

Two further limits apply:

- The post-commit actions still run only on commit. On the writing server they also evict the
  authorization and not-found caches (`CacheBundle.invalidateEntity`), as
  ADR:2026-10-13-authorization-caches-retire-generations-after-commit decides.
- Readers on other threads can still see the uncommitted copy between the in-transaction read and
  the rollback, and a replayed attempt can read the row its abandoned attempt cached. Closing that
  window would mean not caching reads of keys the open transaction wrote.
