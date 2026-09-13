package org.openmetadata.service.cache;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.cache.CachedEntityDao.Entry;

class CachedEntityBatchTest {
  private final RecordingProvider provider = new RecordingProvider();
  private final CacheKeys keys = new CacheKeys("om:batch-test");
  private final CacheConfig config = new CacheConfig();
  private final CachedEntityDao cache = new CachedEntityDao(provider, keys, config);

  @Test
  void publishesBothAliasesWithConfiguredExpiryInBoundedBatches() {
    final List<Entry> entries = IntStream.range(0, 201).mapToObj(this::entry).toList();
    config.entityTtlSeconds = 123;

    cache.putMany("table", entries);

    assertEquals(402, provider.writes.size());
    for (final Entry entry : entries) {
      assertTrue(
          provider.writes.contains(
              new Write(
                  keys.entity("table", entry.id()),
                  Map.of("base", entry.json()),
                  null,
                  Duration.ofSeconds(123))));
      assertTrue(
          provider.writes.contains(
              new Write(
                  keys.entityByName("table", entry.fullyQualifiedName()),
                  Map.of(),
                  entry.json(),
                  Duration.ofSeconds(123))));
    }
    assertEquals(List.of(100, 100, 100, 100, 1, 1), provider.batchSizes);
  }

  @Test
  void bypassSkipsBothAliases() {
    try (var ignored = EntityCacheBypass.skip()) {
      cache.putMany("table", List.of(entry(0)));
    }
    assertTrue(provider.writes.isEmpty());
    assertTrue(provider.batchSizes.isEmpty());
  }

  @Test
  void emptyAndInvalidJsonDoNotCreateKeys() {
    cache.putMany("table", List.of());
    cache.putMany(
        "table",
        List.of(
            new Entry(UUID.randomUUID(), "empty", ""),
            new Entry(UUID.randomUUID(), "object", "{}"),
            new Entry(UUID.randomUUID(), "null", null)));

    assertTrue(provider.writes.isEmpty());
    assertTrue(provider.batchSizes.isEmpty());
  }

  private Entry entry(final int index) {
    return new Entry(
        UUID.randomUUID(), "service.schema.table" + index, "{\"name\":\"table" + index + "\"}");
  }

  private record Write(String key, Map<String, String> fields, String value, Duration ttl) {}

  private static final class RecordingProvider extends NoopCacheProvider {
    private final List<Write> writes = new ArrayList<>();
    private final List<Integer> batchSizes = new ArrayList<>();

    @Override
    public void set(final String key, final String value, final Duration ttl) {
      writes.add(new Write(key, Map.of(), value, ttl));
    }

    @Override
    public void hset(final String key, final Map<String, String> fields, final Duration ttl) {
      writes.add(new Write(key, Map.copyOf(fields), null, ttl));
    }

    @Override
    public void pipelineSet(final Map<String, String> values, final Duration ttl) {
      batchSizes.add(values.size());
      values.forEach((key, value) -> set(key, value, ttl));
    }

    @Override
    public void pipelineHset(final Map<String, Map<String, String>> fields, final Duration ttl) {
      batchSizes.add(fields.size());
      fields.forEach((key, value) -> hset(key, value, ttl));
    }
  }
}
