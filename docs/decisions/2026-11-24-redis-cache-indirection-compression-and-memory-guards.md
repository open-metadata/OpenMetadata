# Redis entity cache uses FQN-to-UUID indirection, value compression, and memory guards

- **Status:** Accepted
- **Revisions:** v1 2026-11-24 (initial)
- **Deciders:** Sriharsha Chintalapani
- **Guard:** `CachedEntityDaoIndirectionTest`, `CacheValueCodecTest`, `CachedMemoryGuardsTest`, `EntityLoaderIndirectionTest`, `SessionStoreFactoryTest`, `RedisSessionStoreTest`
- **Related:** ADR:2026-10-15-redis-commands-keep-their-keys-in-one-hash-slot

## Context

Production deployments running large ingestion workloads against Redis filled an 80 GB instance to
100% memory utilization and kept it pinned for the full entity TTL. Four root causes compounded:

1. Every cached entity wrote its full uncompressed JSON twice — once under `om:<ns>:e:<type>:<uuid>`
   and again under `om:<ns>:en:<type>:<fqnHash>`. Wide tables with hundreds of columns doubled
   memory and network bandwidth.
2. Entity and read-bundle JSON values were stored uncompressed as plain UTF-8 text.
3. Ingestion `createOrUpdate` lookups missed Redis and populated cold entities that no UI user read,
   and operators had no config controls to exclude large entity types or cap single-entry size
   (`tagTtlSeconds` was also unused).
4. `SessionStoreFactory` unconditionally stored auth sessions in the same Redis instance as the
   entity cache, and `RedisSessionStore` per-user ZSET indexes had no TTL — making Redis
   `maxmemory` eviction policies risky for active user sessions.

## Decision

1. **FQN-to-UUID indirection (`:enid:`):** Name lookups store only the 36-char UUID under
   `om:<ns>:enid:<type>:<fqnHash>` and resolve the payload in two single-key commands (`GET :enid:`
   then `HGET :e:<type>:<uuid> base`), preserving single-hash-slot cluster compatibility
   (ADR:2026-10-15-redis-commands-keep-their-keys-in-one-hash-slot). Writers populate `:e:` before
   `:enid:`, and ID-based loads also populate `:enid:` when `:e:` succeeds. Name-key invalidations
   evict `:enid:`, legacy `:en:`, and `:rn:` in one `DEL` for rolling-upgrade coherence.
   `EntityLoaderWithName` verifies FQN hash equality on cache hits to reject stale aliases after
   renames.
2. **Transparent GZIP+Base64 compression (`om:gz1:`):** `CacheValueCodec` compresses entity and
   read-bundle JSON at or above `compressionThresholdBytes` (default `2048`, `0` disables) when
   the encoded value is strictly smaller than the raw string. Readers decode both plain JSON and
   `om:gz1:` payloads and evict corrupted entries.
3. **Configurable cache guards:** `CacheConfig` adds `excludedEntityTypes` (YAML list or
   comma-separated env var, extending `UNCACHED_ENTITY_TYPES` and skipped by `CacheWarmupApp`),
   `maxEntrySizeBytes` (post-compression cap; default `0` unlimited; skipped entries do not write
   `:enid:` pointers), and wires `tagTtlSeconds` in `CachedTagUsageDao` (`<= 0` disables).
4. **Read-only cache on upsert lookups:** `EntityCacheBypass.skipPopulate()` allows reads to hit
   warm Redis entries while suppressing miss write-backs. `createOrUpdate`,
   `createOrUpdateForImport`, and `createOrUpdateBatchForImport` wrap their original lookup with
   `skipPopulate()` unless `cache.populateOnUpsert` is `true` (default `false`).
5. **Session store isolation and bounded ZSET TTL:** `cache.sessionStore` supports `auto`
   (default), `jdbc` (keep sessions in SQL even with Redis cache enabled), and `redis`.
   `RedisSessionStore` updates per-user ZSET indexes via a single-key Lua script that sets or
   extends the ZSET TTL monotonically without shortening an existing longer TTL.

## Consequences

Entity cache memory drops by roughly 50% from deduplication alone and an additional 4–7× for wide
table JSON via compression, while ingestion sweeps stop populating Redis with cold entities. FQN
cache misses on L1 Guava pay one extra single-key 36-byte Redis `GET`. Operators can safely enable
Redis `maxmemory-policy allkeys-lfu` by setting `cache.sessionStore: jdbc` so eviction cannot log
users out. During rolling upgrades from versions without `om:gz1:` decode support, operators who
need zero-noise rollouts can temporarily set `CACHE_COMPRESSION_THRESHOLD_BYTES=0` until all nodes
are upgraded.
