package org.openmetadata.service.cache;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

public class NoopCacheProvider implements CacheProvider {
  public Optional<String> get(String key) {
    return Optional.empty();
  }

  public void set(String key, String value, Duration ttl) {}

  public boolean setIfAbsent(String key, String value, Duration ttl) {
    return false; // No-op cache always returns false
  }

  public void del(String... keys) {}

  public Optional<String> hget(String key, String field) {
    return Optional.empty();
  }

  public void hset(String key, Map<String, String> fields, Duration ttl) {}

  public void hdel(String key, String... fields) {}

  public boolean available() {
    return false;
  }

  public Map<String, Object> getStats() {
    Map<String, Object> stats = new HashMap<>();
    stats.put("type", "none");
    stats.put("available", false);
    stats.put("message", "Cache is disabled");
    return stats;
  }

  public void close() {}
}
