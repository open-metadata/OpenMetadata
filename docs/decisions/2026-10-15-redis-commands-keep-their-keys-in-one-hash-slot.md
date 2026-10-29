# Redis commands keep their keys in one hash slot

- **Status:** Accepted
- **Revisions:** v1 2026-10-15 (initial)
- **Deciders:** Sriharsha Chintalapani
- **Guard:** `RedisSessionStoreTest` and `RedisCacheProviderClusterTest`, which run against a
  cluster-mode Redis that rejects a cross-slot command with CROSSSLOT
- **Related:** #35587; #33540 (one DEL per eviction)

## Context

Operators run the Redis cache provider against Redis in cluster mode: a Redis Cluster, or a
cluster proxy endpoint such as ElastiCache Serverless. Redis in cluster mode rejects any command,
script or transaction whose keys hash to different slots. The session compare-and-set script
carried the session key and the user's index keys, so token refresh failed after sign-in. Cache
evictions sent several keys in one DEL, so they failed too. Those failures marked the provider
unavailable, and a server that started in that state refused to boot.

## Decision

A Redis command, script or transaction that OpenMetadata sends carries keys from one hash slot.
Code that needs several keys either shares a `{hashtag}` between them or sends one command per
slot.

- The session store's compare-and-set script touches only the session key. The per-user ZSET
  indexes are updated with separate commands. Each index may hold entries for sessions no longer
  in its status, but it must never miss a live session. So an update adds the session to its
  target index before the script runs, and only a move to REVOKED or EXPIRED removes it. REFRESHING
  sessions share the ACTIVE index.
- This relies on one rule in `SessionService`: a REVOKED or EXPIRED session never becomes live
  again. Every update is a compare-and-set against a version just read, so no stale writer can
  bring it back.
- `RedisCacheProvider` evicts with one DEL or UNLINK, as #33540 requires on standalone Redis.
  When Redis rejects that command with CROSSSLOT, the provider sends one pipelined command per
  slot from then on.

## Consequences

The code works on standalone Redis, a Redis Cluster proxy, and a single-shard cluster without
configuration. A cluster cannot evict keys from different slots atomically, so the turnover #33540
protects holds only on standalone Redis. A new multi-key Redis call must state how its keys share
a slot. A `SessionService` change that moves a terminal session back to a live status breaks the
session index. OpenMetadata connects with a standalone client, so a native multi-shard cluster
that answers MOVED is not supported until the provider uses a cluster client.
