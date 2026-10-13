# Only when Redis is off, each pod applies other pods' auth writes by polling entity tables every 5 s with a 60 s overlap; with Redis, pub/sub alone does it

- **Status:** Accepted
- **Revisions:** v1 2026-10-12 (initial)
- **Deciders:** Sonika Shah
- **Guard:** `SubjectCachePeerSyncTest`; `DomainIsolationIT.test_peerPodUserDomainChange_reachesAuthorizationWithoutRedis`, `DomainIsolationIT.test_domainRename_keepsMemberAccess`; reviewer for writes that bump `updatedAt`
- **Related:** #35033, #35228, #35229, #35213, #34940; `PollingJobNotifier` (the same pattern for distributed reindex)

## Context

`SubjectCache` keeps each user's authorization context (domains, `isAdmin`, roles, teams) for 15
minutes and compiled policies for 2. A write evicts the entry only on the pod that served it; peers
learn of it through Redis pub/sub, and a deployment without Redis has no such channel. On a 2-pod
deployment with `cacheProvider: none`, a domain added to a user stayed denied on both pods for 15.2
minutes. A domain rename had the same effect even with Redis, because it rewrites the FQN
`hasDomain()` matches on without writing any user, and users are never published (they are not
L2-cached).

## Decision

- Only when Redis is off (`CacheBundle.getCacheInvalidationPubSub()` is null, or Redis was unreachable
  so pub/sub never started) does `SubjectCachePeerSync` run, on every pod; with working Redis it never
  starts and pub/sub stays the only channel.
  Every **5 s** it lists rows of `user_entity`, `team_entity`, `role_entity`, `policy_entity` and
  `domain_entity` whose `updatedAt` is later than the previous poll minus **60 s**, and evicts them
  through `EntityRepository.onRemoteCacheInvalidate` and `SubjectCache.invalidator()`, the same pair
  the Redis handler calls. The overlap absorbs late commits and writer clock skew; an eviction seen
  twice is harmless. A falling row count of team, role or policy catches hard deletes. A changed
  domain name drops every user context.
- Per-row bookkeeping is bounded at **10,000** entries; an entry evicted early only risks one
  repeated eviction or one missed rename, which the cache TTL still covers.
- A domain rename drops every user context locally and publishes
  `CacheInvalidationPubSub.TYPE_USER_CONTEXTS`, which peers with Redis map to the same drop.
- **A write that must not evict caches must not bump `updatedAt`.** Per-request activity tracking
  writes only `lastActivityTime` for this reason.

## Consequences

Without Redis, peer pods converge within about 5 s instead of the 15-minute TTL, at the cost of
about five small indexed queries per pod every 5 s. Convergence is not instant; that still needs
Redis. Revisit if Redis becomes mandatory for multi-pod deployments, if the poll load shows up in
database metrics, or if a new auth-relevant table must be watched.
