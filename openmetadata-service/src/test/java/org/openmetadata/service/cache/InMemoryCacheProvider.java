/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
package org.openmetadata.service.cache;

import com.github.benmanes.caffeine.cache.Caffeine;
import java.time.Duration;
import java.util.Map;
import java.util.Optional;

/** A bounded in-memory {@link CacheProvider} for tests that need the real cache classes. */
public class InMemoryCacheProvider implements CacheProvider {
  private static final int MAX_ENTRIES = 1_000;

  private final Map<String, String> values = boundedMap();
  private final Map<String, Map<String, String>> hashes = boundedMap();

  private static <V> Map<String, V> boundedMap() {
    return Caffeine.newBuilder().maximumSize(MAX_ENTRIES).<String, V>build().asMap();
  }

  @Override
  public Optional<String> get(String key) {
    return Optional.ofNullable(values.get(key));
  }

  @Override
  public void set(String key, String value, Duration ttl) {
    values.put(key, value);
  }

  @Override
  public boolean setIfAbsent(String key, String value, Duration ttl) {
    return values.putIfAbsent(key, value) == null;
  }

  @Override
  public void del(String... keys) {
    for (String key : keys) {
      values.remove(key);
      hashes.remove(key);
    }
  }

  @Override
  public Optional<String> hget(String key, String field) {
    return Optional.ofNullable(hashes.getOrDefault(key, Map.of()).get(field));
  }

  @Override
  public void hset(String key, Map<String, String> fields, Duration ttl) {
    hashes.computeIfAbsent(key, ignored -> boundedMap()).putAll(fields);
  }

  @Override
  public void hdel(String key, String... fields) {
    hashes.computeIfPresent(
        key,
        (ignored, hash) -> {
          for (String field : fields) {
            hash.remove(field);
          }
          return hash;
        });
  }

  @Override
  public boolean available() {
    return true;
  }

  @Override
  public Map<String, Object> getStats() {
    return Map.of("type", "in-memory");
  }

  @Override
  public void close() {}
}
