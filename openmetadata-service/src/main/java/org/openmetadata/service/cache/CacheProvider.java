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

  @Override
  void close();
}
