# Redis entity cache uses FQN-to-UUID indirection, value compression, and memory guards

- **Status:** Accepted
- **Revisions:** v1 2026-11-24 (initial), v2 2026-11-25 (rollout notes, full relationship-cache exclusion, legacy ZSET TTL guard)
- **Deciders:** Sriharsha Chintalapani
- **Guard:** `CachedEntityDaoIndirectionTest`, `CacheValueCodecTest`, `CachedMemoryGuardsTest`, `EntityLoaderIndirectionTest`, `SessionStoreFactoryTest`, `RedisSessionStoreIT`
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
   `EntityLoaderWithName` verifies FQN hash equality on cache hits and evicts stale aliases at
   `DEBUG` level (keeping `ERROR` for missing id/FQN).
2. **Transparent GZIP+Base64 compression (`om:gz1:`):** `CacheValueCodec` compresses entity and
   read-bundle JSON at or above `compressionThresholdBytes` (measured in UTF-8 bytes; default `2048`
   on `main`, `0` opt-in on `2.0`/`2.1` patch backports) when the encoded value is strictly smaller
   than the raw UTF-8 byte length. Readers decode both plain JSON and `om:gz1:` payloads and evict
   corrupted entries.
3. **Configurable cache guards:** `CacheConfig` adds `excludedEntityTypes` (YAML list or
   comma-separated env var, extending `UNCACHED_ENTITY_TYPES` across entity JSON, container
   references, read bundles, tags, owners, domains, CONTAINS parent lookups, and `CacheWarmupApp`),
   `maxEntrySizeBytes` (post-compression UTF-8 byte cap; default `0` unlimited; skipped entries do
   not write `:enid:` pointers), and wires `tagTtlSeconds` across `CachedTagUsageDao`,
   `CachedReadBundle`, and `BundleWarmupBatcher` (`<= 0` disables tag caching; shorter positive
   values cap tag-bearing read-bundle TTLs).
4. **Read-only cache on upsert paths:** `EntityCacheBypass.skipPopulate()` allows reads to hit
   warm Redis entries while suppressing miss write-backs. `EntityResource.createOrUpdate`,
   `EntityRepository.createOrUpdate`, `createOrUpdateForImport`, `createOrUpdateBatchForImport`,
   and `GlossaryTermRepository.createOrUpdateForImport` scope `skipPopulate()` across both pre-write
   lookups and update field hydration unless `cache.populateOnUpsert` is `true` (default `false`).
5. **Session store isolation and bounded ZSET TTL:** `cache.sessionStore` supports `auto`
   (default), `jdbc` (keep sessions in SQL even with Redis cache enabled), and `redis`.
   `RedisSessionStore` updates per-user ZSET indexes via a single-key Lua script that checks `TTL`
   before `ZADD` so newly created keys (`-2`) receive a bounded TTL and finite TTLs extend
   monotonically without shortening pre-upgrade persistent indexes (`-1`); on full
   `findByUserIdAndStatus` scans, a second single-key Lua script transitions pre-upgrade `-1`
   indexes to the maximum remaining TTL of all surviving live sessions.

## Consequences

Entity cache memory drops by roughly 50% from deduplication alone and an additional 4–7× for wide
table JSON via compression, while ingestion sweeps stop populating Redis with cold entities. FQN
cache misses on L1 Guava pay one extra single-key 36-byte Redis `GET`. Operators can safely enable
Redis `maxmemory-policy allkeys-lfu` by setting `cache.sessionStore: jdbc` so eviction cannot log
users out.

### Rollout & operational notes

- **Reclaiming existing `:en:` keys immediately:** Upgrading does not proactively delete pre-existing
  `:en:` full-JSON copies; each entry clears only on the next write to that entity or when
  `entityTtlSeconds` expires (48 hours in shipped `openmetadata.yaml`). To reclaim memory right away
  once every pod is running this version (nothing reads `:en:` anymore), scan `<keyspace>:en:*`
  (default keyspace `om:prod`) and delete with non-blocking `UNLINK`, e.g.:
  `redis-cli --scan --pattern 'om:prod:en:*' | xargs -r -n 1000 redis-cli UNLINK`.
- **Rolling upgrades and compression (`CACHE_COMPRESSION_THRESHOLD_BYTES`):** Old pods without
  `om:gz1:` decode support treat compressed entries as malformed JSON, log a `WARN` with stack
  trace, evict the key, and reload from the database. On `main` (`compressionThresholdBytes: 2048`),
  operators who want zero-noise rolling upgrades can temporarily set
  `CACHE_COMPRESSION_THRESHOLD_BYTES=0` until all pods are upgraded, then re-enable it. Patch
  backports (`2.0` / `2.1`) default `compressionThresholdBytes` to `0` so rolling patch upgrades and
  rollbacks are silent by default; operators opt in by setting
  `CACHE_COMPRESSION_THRESHOLD_BYTES=2048` once all pods are upgraded.
- **Switching `cache.sessionStore`:** Changing `sessionStore` (for example `auto` to `jdbc` on a
  Redis deployment) switches to an empty session store. `JwtFilter` rejects missing sessions with
  `"Invalid session"`, and mixed values across pods fail requests that hit a pod pointing at the
  other store. Change `sessionStore` on all pods together and expect one forced sign-in for active
  users.
