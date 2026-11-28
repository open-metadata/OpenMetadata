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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.time.Duration;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/**
 * Verifies FQN-to-UUID indirection in {@link CachedEntityDao}: name keys store only the 36-char
 * UUID pointing to the single entity JSON stored under the ID hash key.
 */
class CachedEntityDaoIndirectionTest {

  private static final String TYPE = "table";
  private static final String FQN = "svc.db.schema.orders";
  private static final String ENTITY_JSON =
      "{\"id\":\"%s\",\"fullyQualifiedName\":\"svc.db.schema.orders\",\"columns\":[]}";

  @Test
  void putByNameStoresOnlyUuidPointerAndGetByNameResolvesFromBaseKey() {
    final InMemoryCacheProvider cache = new InMemoryCacheProvider();
    final CacheKeys keys = new CacheKeys("om");
    final CachedEntityDao dao = new CachedEntityDao(cache, keys, new CacheConfig());
    final UUID entityId = UUID.randomUUID();
    final String json = ENTITY_JSON.formatted(entityId);

    dao.putBase(TYPE, entityId, json);
    dao.putByName(TYPE, FQN, entityId);

    assertEquals(
        Optional.of(entityId.toString()),
        cache.get(keys.entityIdByName(TYPE, FQN)),
        "FQN key must store only the UUID string, not the full JSON");
    assertTrue(
        cache.get(keys.entityByName(TYPE, FQN)).isEmpty(),
        "legacy :en: key must not be populated by new writes");
    assertEquals(Optional.of(json), dao.getByName(TYPE, FQN));
  }

  @Test
  void getByNameReturnsEmptyWhenBaseEntryWasEvicted() {
    final InMemoryCacheProvider cache = new InMemoryCacheProvider();
    final CacheKeys keys = new CacheKeys("om");
    final CachedEntityDao dao = new CachedEntityDao(cache, keys, new CacheConfig());
    final UUID entityId = UUID.randomUUID();

    dao.putBase(TYPE, entityId, ENTITY_JSON.formatted(entityId));
    dao.putByName(TYPE, FQN, entityId);
    cache.del(keys.entity(TYPE, entityId));

    assertTrue(
        dao.getByName(TYPE, FQN).isEmpty(),
        "dangling pointer whose base JSON was evicted must behave as a cache miss");
  }

  @Test
  void getByNameEvictsCorruptedNonUuidPointerAndReturnsEmpty() {
    final InMemoryCacheProvider cache = new InMemoryCacheProvider();
    final CacheKeys keys = new CacheKeys("om");
    final CachedEntityDao dao = new CachedEntityDao(cache, keys, new CacheConfig());
    final String pointerKey = keys.entityIdByName(TYPE, FQN);
    cache.set(pointerKey, "{\"corrupted\":\"json\"}", Duration.ofMinutes(5));

    assertTrue(dao.getByName(TYPE, FQN).isEmpty());
    assertTrue(
        cache.get(pointerKey).isEmpty(), "corrupted non-UUID pointer must be evicted on read");
  }

  @Test
  void invalidateByNameAlsoEvictsLegacyFullJsonKeyForRollingUpgrades() {
    final InMemoryCacheProvider cache = new InMemoryCacheProvider();
    final CacheKeys keys = new CacheKeys("om");
    final CachedEntityDao dao = new CachedEntityDao(cache, keys, new CacheConfig());
    final UUID entityId = UUID.randomUUID();
    final String json = ENTITY_JSON.formatted(entityId);

    dao.putBase(TYPE, entityId, json);
    dao.putByName(TYPE, FQN, entityId);
    cache.set(keys.entityByName(TYPE, FQN), json, Duration.ofMinutes(5));
    dao.putReferenceByName(TYPE, FQN, "{\"id\":\"" + entityId + "\"}");

    dao.invalidateByName(TYPE, FQN);

    assertTrue(cache.get(keys.entityIdByName(TYPE, FQN)).isEmpty());
    assertTrue(cache.get(keys.entityByName(TYPE, FQN)).isEmpty());
    assertTrue(cache.get(keys.refByName(TYPE, FQN)).isEmpty());
  }

  @Test
  void putByNameIgnoresBlankFqnNullIdAndBypassScope() {
    final InMemoryCacheProvider cache = new InMemoryCacheProvider();
    final CacheKeys keys = new CacheKeys("om");
    final CachedEntityDao dao = new CachedEntityDao(cache, keys, new CacheConfig());
    final UUID entityId = UUID.randomUUID();

    dao.putByName(TYPE, null, entityId);
    dao.putByName(TYPE, "", entityId);
    dao.putByName(TYPE, FQN, null);
    try (EntityCacheBypass.Handle ignored = EntityCacheBypass.skip()) {
      dao.putBase(TYPE, entityId, ENTITY_JSON.formatted(entityId));
      dao.putByName(TYPE, FQN, entityId);
      assertTrue(dao.getByName(TYPE, FQN).isEmpty());
    }

    assertTrue(cache.get(keys.entityIdByName(TYPE, FQN)).isEmpty());
    assertTrue(cache.hget(keys.entity(TYPE, entityId), "base").isEmpty());
  }

  @Test
  void getByNameRecordsSingleMetricPerLogicalLookup() {
    CacheMetrics.initialize(new SimpleMeterRegistry());
    final InMemoryCacheProvider cache = new InMemoryCacheProvider();
    final CacheKeys keys = new CacheKeys("om");
    final CachedEntityDao dao = new CachedEntityDao(cache, keys, new CacheConfig());
    final UUID entityId = UUID.randomUUID();
    final String metricType = "tableIndirectionMetric";

    dao.getByName(metricType, FQN);
    dao.putBase(metricType, entityId, ENTITY_JSON.formatted(entityId));
    dao.putByName(metricType, FQN, entityId);
    dao.getByName(metricType, FQN);
    cache.del(keys.entity(metricType, entityId));
    dao.getByName(metricType, FQN);

    @SuppressWarnings("unchecked")
    final Map<String, Map<String, Object>> byType =
        (Map<String, Map<String, Object>>) CacheMetrics.getInstance().snapshot().get("byType");
    final Map<String, Object> stats = byType.get(metricType);
    assertEquals(1L, stats.get("hits"));
    assertEquals(2L, stats.get("misses"));
  }

  @Test
  void compressesLargeEntityJsonAndTransparentlyDecodesOnIdAndNameLookups() {
    final InMemoryCacheProvider cache = new InMemoryCacheProvider();
    final CacheKeys keys = new CacheKeys("om");
    final CacheConfig config = new CacheConfig();
    config.compressionThresholdBytes = 256;
    final CachedEntityDao dao = new CachedEntityDao(cache, keys, config);
    final UUID entityId = UUID.randomUUID();
    final String largeJson =
        "{\"id\":\""
            + entityId
            + "\",\"fullyQualifiedName\":\""
            + FQN
            + "\",\"description\":\""
            + "wide table column metadata ".repeat(60)
            + "\"}";

    assertTrue(dao.putBase(TYPE, entityId, largeJson));
    dao.putByName(TYPE, FQN, entityId);

    final String rawStored = cache.hget(keys.entity(TYPE, entityId), "base").orElseThrow();
    assertTrue(CacheValueCodec.isCompressed(rawStored));
    assertTrue(rawStored.length() < largeJson.length() / 2);
    assertEquals(Optional.of(largeJson), dao.getBase(entityId, TYPE));
    assertEquals(Optional.of(largeJson), dao.getByName(TYPE, FQN));
  }

  @Test
  void evictsCorruptedCompressedEntityValueOnRead() {
    final InMemoryCacheProvider cache = new InMemoryCacheProvider();
    final CacheKeys keys = new CacheKeys("om");
    final CachedEntityDao dao = new CachedEntityDao(cache, keys, new CacheConfig());
    final UUID entityId = UUID.randomUUID();
    final String baseKey = keys.entity(TYPE, entityId);
    cache.hset(
        baseKey, Map.of("base", CacheValueCodec.GZIP_PREFIX + "!!!bad!!!"), Duration.ofMinutes(5));
    dao.putByName(TYPE, FQN, entityId);

    assertTrue(dao.getByName(TYPE, FQN).isEmpty());
    assertTrue(cache.hget(baseKey, "base").isEmpty());
  }

  @Test
  void skipsOversizedEntityPastMaxEntrySizeBytes() {
    final InMemoryCacheProvider cache = new InMemoryCacheProvider();
    final CacheKeys keys = new CacheKeys("om");
    final CacheConfig config = new CacheConfig();
    config.compressionThresholdBytes = 0;
    config.maxEntrySizeBytes = 64;
    final CachedEntityDao dao = new CachedEntityDao(cache, keys, config);
    final UUID entityId = UUID.randomUUID();

    assertFalse(dao.putBase(TYPE, entityId, ENTITY_JSON.formatted(entityId)));
    assertTrue(cache.hget(keys.entity(TYPE, entityId), "base").isEmpty());
  }

  @Test
  void skipPopulateAllowsCacheReadsWhileSuppressingCacheWrites() {
    final InMemoryCacheProvider cache = new InMemoryCacheProvider();
    final CacheKeys keys = new CacheKeys("om");
    final CachedEntityDao dao = new CachedEntityDao(cache, keys, new CacheConfig());
    final UUID existingId = UUID.randomUUID();
    final UUID coldId = UUID.randomUUID();
    final String existingJson = ENTITY_JSON.formatted(existingId);

    assertTrue(dao.putBase(TYPE, existingId, existingJson));
    dao.putByName(TYPE, FQN, existingId);

    try (EntityCacheBypass.Handle ignored = EntityCacheBypass.skipPopulate()) {
      assertEquals(Optional.of(existingJson), dao.getBase(existingId, TYPE));
      assertEquals(Optional.of(existingJson), dao.getByName(TYPE, FQN));
      assertFalse(dao.putBase(TYPE, coldId, ENTITY_JSON.formatted(coldId)));
      dao.putByName(TYPE, "svc.db.schema.cold", coldId);
    }

    assertTrue(cache.hget(keys.entity(TYPE, coldId), "base").isEmpty());
    assertTrue(cache.get(keys.entityIdByName(TYPE, "svc.db.schema.cold")).isEmpty());
  }
}
