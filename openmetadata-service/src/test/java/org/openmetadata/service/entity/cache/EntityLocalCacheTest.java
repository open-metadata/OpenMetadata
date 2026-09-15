package org.openmetadata.service.entity.cache;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.google.common.base.Ticker;
import java.time.Duration;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.Entity;
import org.openmetadata.service.config.CacheConfiguration;

class EntityLocalCacheTest {
  @Test
  void preservesIndependentByteBudgetsForBothAliases() {
    final var config = new CacheConfiguration();
    config.setEntityCacheMaxSizeBytes(1_000);
    final var cache = new EntityLocalCache(key -> "loaded", key -> "loaded", config);
    for (int index = 0; index < 100; index++) {
      cache.byId().put(EntityCacheKeys.id(Entity.TABLE, UUID.randomUUID()), "x".repeat(50));
      cache.byName().put(EntityCacheKeys.name(Entity.TABLE, "table" + index), "x".repeat(50));
    }
    assertTrue(
        cache.byId().asMap().values().stream().mapToInt(value -> value.length() * 2 + 40).sum()
            <= 1_000);
    assertTrue(
        cache.byName().asMap().values().stream().mapToInt(value -> value.length() * 2 + 40).sum()
            <= 1_000);
    assertTrue(cache.byId().stats().evictionCount() > 0);
    assertTrue(cache.byName().stats().evictionCount() > 0);
  }

  @Test
  void expiryRemainsBasedOnWriteTimeAndRetainsHitStatistics() throws Exception {
    final var nanos = new AtomicLong();
    final var loads = new AtomicInteger();
    final Ticker ticker =
        new Ticker() {
          @Override
          public long read() {
            return nanos.get();
          }
        };
    final var cache =
        new EntityLocalCache(
            key -> "id" + loads.incrementAndGet(),
            key -> "name" + loads.incrementAndGet(),
            new CacheConfiguration(),
            ticker);
    final var id = EntityCacheKeys.id(Entity.TABLE, UUID.randomUUID());
    final var name = EntityCacheKeys.name(Entity.TABLE, "table");
    assertEquals("id1", cache.byId().get(id));
    assertEquals("name2", cache.byName().get(name));
    nanos.set(Duration.ofSeconds(15).toNanos());
    assertEquals("id1", cache.byId().get(id));
    assertEquals("name2", cache.byName().get(name));
    nanos.set(Duration.ofSeconds(31).toNanos());
    assertEquals("id3", cache.byId().get(id));
    assertEquals("name4", cache.byName().get(name));
    assertEquals(1, cache.byId().stats().hitCount());
    assertEquals(2, cache.byName().stats().loadSuccessCount());
  }

  @Test
  void configurationReloadReplacesBothCachesAndTheirExpiry() {
    final var nanos = new AtomicLong();
    final Ticker ticker =
        new Ticker() {
          @Override
          public long read() {
            return nanos.get();
          }
        };
    final var config = new CacheConfiguration();
    final var cache = new EntityLocalCache(key -> "loaded", key -> "loaded", config, ticker);
    final var id = EntityCacheKeys.id(Entity.TABLE, UUID.randomUUID());
    final var name = EntityCacheKeys.name(Entity.TABLE, "table");
    cache.byId().put(id, "old");
    cache.byName().put(name, "old");
    final var oldIds = cache.byId();
    final var oldNames = cache.byName();
    config.setEntityCacheTTLSeconds(1);
    cache.configure(config);
    assertNotSame(oldIds, cache.byId());
    assertNotSame(oldNames, cache.byName());
    assertNull(cache.byId().getIfPresent(id));
    assertNull(cache.byName().getIfPresent(name));
    cache.byId().put(id, "new");
    cache.byName().put(name, "new");
    nanos.set(Duration.ofSeconds(2).toNanos());
    assertNull(cache.byId().getIfPresent(id));
    assertNull(cache.byName().getIfPresent(name));
  }
}
