# Without Redis, a cached user authorization context expires after 2 minutes instead of 15

- **Status:** Accepted
- **Revisions:** v1 2026-10-13 (initial)
- **Deciders:** Sonika Shah
- **Guard:** `SubjectCacheTest.testUserContextExpiresSoonerUnlessRedisPubSubIsRunning`
- **Related:** #35033, #35228, #35229, #35213

## Context

`SubjectCache` keeps each user's authorization context (domains, `isAdmin`, roles, teams) for 15
minutes. A write evicts it only on the pod that served the write; peers hear of it through Redis
pub/sub. Without Redis, or when Redis was unreachable at start-up so pub/sub never started, nothing
evicts a peer's copy: on a 2-pod deployment a domain added to a user stayed denied on the other pod
for 15.2 minutes. Polling the database for peer writes was tried and dropped: it adds a background
thread and a fixed query load for changes that are rare admin actions.

## Decision

- When `CacheBundle.getCacheInvalidationPubSub()` is null or not running, user contexts expire after
  **2 minutes**, the TTL compiled policies already use. With working Redis pub/sub they keep 15.
- The choice is made once, in `SubjectCache.initCaches`, after the cache bundle has started.
- A domain rename drops every user context locally and publishes
  `CacheInvalidationPubSub.TYPE_USER_CONTEXTS`; peers without Redis converge through the 2-minute TTL.

## Consequences

Peers without Redis serve a stale authorization context for at most 2 minutes, with no background
work. Each active user's context is reloaded every 2 minutes on each pod, a cost that grows with the
number of active users. Revisit if that reload load shows up in database metrics, if a sub-minute
bound is needed (then Redis, or polling), or if Redis becomes mandatory for multi-pod deployments.
