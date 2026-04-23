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

  @Override
  void close();
}
