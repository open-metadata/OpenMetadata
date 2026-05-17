package org.openmetadata.service.cache;

import java.time.Duration;
import java.util.Map;
import java.util.Optional;

public interface CacheProvider extends AutoCloseable {
  Optional<String> get(String key);

  void set(String key, String value, Duration ttl);

  boolean setIfAbsent(String key, String value, Duration ttl);

  void del(String... keys);

  Optional<String> hget(String key, String field);

  void hset(String key, Map<String, String> fields, Duration ttl);

  /**
   * HSET without an EXPIRE. Use when the caller manages the key's TTL separately (e.g.,
   * setting it only on initial creation via {@link #expireIfAbsent}) to avoid extending a
   * stale key's lifetime on every field write.
   *
   * <p>Default emulates by calling {@link #hset(String, Map, Duration)} with a very long TTL,
   * but real implementations should override to issue a plain HSET so the key keeps any
   * previously-set EXPIRE.
   */
  default void hset(String key, Map<String, String> fields) {
    hset(key, fields, Duration.ofDays(365));
  }

  /**
   * Set a TTL on {@code key} only if the key currently has no TTL (Redis {@code EXPIRE … NX}).
   * Returns {@code true} when the TTL was applied (key existed and had no prior expiry),
   * {@code false} otherwise (key missing, or already has a TTL).
   *
   * <p>Default implementation is a no-op returning {@code false} — providers that can't
   * express the {@code NX} semantics cheaply just don't get the extension-avoidance benefit.
   */
  default boolean expireIfAbsent(String key, Duration ttl) {
    return false;
  }

  void hdel(String key, String... fields);

  /**
   * Pipeline a batch of SET commands. Issues all writes without awaiting, then awaits the batch
   * as a whole. For large-scale warmup where ~1000 writes per batch fit in a single TCP round-
   * trip. Implementations without a real pipeline may emulate with sequential writes.
   */
  default void pipelineSet(Map<String, String> keyValues, Duration ttl) {
    keyValues.forEach((k, v) -> set(k, v, ttl));
  }

  /**
   * Pipeline a batch of HSET commands (one field per hash-key) with a matching EXPIRE on each
   * key. Used by cache warmup where the entity cache stores entity JSON under the {@code base}
   * field of a Redis hash.
   */
  default void pipelineHset(Map<String, Map<String, String>> keyFields, Duration ttl) {
    keyFields.forEach((k, fields) -> hset(k, fields, ttl));
  }

  boolean available();

  Map<String, Object> getStats();

  /**
   * Count keys matching a glob-style pattern (e.g. {@code "om:prod:e:table:*"}). Implementations
   * use a server-side SCAN cursor to avoid blocking with KEYS. Default returns -1 for providers
   * without a scan implementation; callers must treat negative values as "unsupported".
   *
   * <p><b>Cost:</b> O(n) over the entire keyspace because Redis SCAN visits every key and applies
   * the pattern filter server-side. Wall time scales linearly with {@code DBSIZE}, not with the
   * number of matches. Use sparingly — call it on bounded events (post-warmup, periodic
   * health-check) rather than on the request path. For large keyspaces consider maintaining a
   * counter key alongside writes / deletes instead.
   */
  default long scanCount(String pattern) {
    return -1L;
  }

  /**
   * SCAN keys matching {@code pattern} and UNLINK them in batches. Returns the number of keys
   * deleted, or {@code 0} if the provider doesn't support pattern-based deletion (the default).
   *
   * <p>Like {@link #scanCount}, the wall time is O(n) over the keyspace, not over matches. Call
   * it on bounded events (entity edits, lineage edge changes) — never in a hot loop. Always use
   * a precise pattern (e.g. {@code "om:prod:lineage:graph:{abc}:*"}); avoid broad globs like
   * {@code "om:prod:*"} which would block the cluster on a large keyspace.
   */
  default long scanDelete(String pattern) {
    return 0L;
  }

  /**
   * Pipelined batch GET. Returns a list of {@code Optional<String>} aligned 1:1 with the input
   * keys — entry {@code i} is the value for {@code keys[i]}, or {@link Optional#empty()} if the
   * key was missing or read failed. One TCP round-trip on Redis Cluster-aware implementations
   * via {@code MGET} (when keys hash to the same slot) or pipelined GETs (when they don't).
   *
   * <p>Default implementation does sequential GETs — correct semantics, no batching benefit.
   * Override for true pipelined behavior. {@code null} keys in the input list yield empty
   * results in the corresponding output position.
   */
  default java.util.List<java.util.Optional<String>> mget(java.util.List<String> keys) {
    if (keys == null || keys.isEmpty()) {
      return java.util.Collections.emptyList();
    }
    java.util.List<java.util.Optional<String>> out = new java.util.ArrayList<>(keys.size());
    for (String k : keys) {
      out.add(k == null ? java.util.Optional.empty() : get(k));
    }
    return out;
  }

  @Override
  void close();
}
