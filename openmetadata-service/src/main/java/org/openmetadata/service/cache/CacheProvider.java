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

  boolean available();

  Map<String, Object> getStats();

  @Override
  void close();
}
