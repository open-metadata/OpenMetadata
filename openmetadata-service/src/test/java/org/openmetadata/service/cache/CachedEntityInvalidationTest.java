package org.openmetadata.service.cache;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.google.common.cache.Cache;
import com.google.common.cache.CacheBuilder;
import java.util.Map;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.service.Entity;

class CachedEntityInvalidationTest {
  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void nameEvictionClearsBothAliasesInOneRedisCommand(boolean corruptedEntry) {
    final Provider provider = new Provider();
    final CacheKeys keys = new CacheKeys("om:alias-eviction-test");
    final var cache = new CachedEntityDao(provider, keys, new CacheConfig());
    final String fqn = "service.\"name.with.dots\"";
    provider.values.put(keys.entityByName(Entity.TABLE, fqn), "entity");
    provider.values.put(keys.refByName(Entity.TABLE, fqn), "reference");
    provider.values.put(keys.refByName(Entity.TABLE, "unrelated"), "untouched");

    evict(cache, fqn, corruptedEntry);

    assertEquals(
        Map.of(keys.refByName(Entity.TABLE, "unrelated"), "untouched"), provider.values.asMap());
    assertEquals(1, provider.commands);
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void cacheBypassSkipsAliasEviction(boolean corruptedEntry) {
    final Provider provider = new Provider();
    final CacheKeys keys = new CacheKeys("om:alias-eviction-test");
    final var cache = new CachedEntityDao(provider, keys, new CacheConfig());
    final String fqn = "service.table";
    provider.values.put(keys.entityByName(Entity.TABLE, fqn), "entity");
    try (var ignored = EntityCacheBypass.skip()) {
      evict(cache, fqn, corruptedEntry);
    }
    assertEquals("entity", provider.values.getIfPresent(keys.entityByName(Entity.TABLE, fqn)));
    assertEquals(0, provider.commands);
  }

  private void evict(CachedEntityDao cache, String fqn, boolean corruptedEntry) {
    if (corruptedEntry) {
      cache.deleteByName(Entity.TABLE, fqn);
    } else {
      cache.invalidateByName(Entity.TABLE, fqn);
    }
  }

  private static final class Provider extends NoopCacheProvider {
    private final Cache<String, String> values = CacheBuilder.newBuilder().maximumSize(100).build();
    private int commands;

    @Override
    public void del(String... keys) {
      commands++;
      for (final String key : keys) {
        values.invalidate(key);
      }
    }
  }
}
