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
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;

/**
 * Verifies memory-control guards across {@link CachedReadBundle}, {@link CachedTagUsageDao}, {@link
 * CachedRelationshipDao}, and {@link EntityCacheBypass#skipPopulate()}.
 */
class CachedMemoryGuardsTest {

  private static final String TYPE = "table";

  @Test
  void readBundleCompressesLargePayloadsAndRespectsMaxEntrySizeAndSkipPopulate() {
    final InMemoryCacheProvider cache = new InMemoryCacheProvider();
    final CacheKeys keys = new CacheKeys("om");
    final CacheConfig config = new CacheConfig();
    config.compressionThresholdBytes = 256;
    final CachedReadBundle bundleCache = new CachedReadBundle(cache, keys, config);

    final UUID compressedId = UUID.randomUUID();
    final CachedReadBundle.Dto largeDto = largeBundleDto(25);
    bundleCache.put(TYPE, compressedId, largeDto);

    final String stored = cache.get(keys.bundle(TYPE, compressedId)).orElseThrow();
    assertTrue(CacheValueCodec.isCompressed(stored));
    final CachedReadBundle.Dto roundTripped = bundleCache.get(TYPE, compressedId);
    assertNotNull(roundTripped);
    assertEquals(25, roundTripped.tags.size());
    assertEquals(25, bundleCache.getBatch(TYPE, List.of(compressedId)).getFirst().tags.size());

    final UUID skippedPopulateId = UUID.randomUUID();
    try (EntityCacheBypass.Handle ignored = EntityCacheBypass.skipPopulate()) {
      assertNotNull(bundleCache.get(TYPE, compressedId));
      bundleCache.put(TYPE, skippedPopulateId, largeDto);
    }
    assertTrue(cache.get(keys.bundle(TYPE, skippedPopulateId)).isEmpty());

    config.maxEntrySizeBytes = 32;
    final UUID oversizedId = UUID.randomUUID();
    bundleCache.put(TYPE, oversizedId, largeDto);
    assertTrue(cache.get(keys.bundle(TYPE, oversizedId)).isEmpty());
  }

  @Test
  void readBundleHonorsTagTtlSecondsWhenShorterAndWhenDisabled() {
    final RecordingTtlCacheProvider cache = new RecordingTtlCacheProvider();
    final CacheKeys keys = new CacheKeys("om");
    final CacheConfig config = new CacheConfig();
    config.entityTtlSeconds = 7200;
    config.tagTtlSeconds = 120;
    final CachedReadBundle bundleCache = new CachedReadBundle(cache, keys, config);

    // Shorter tagTtlSeconds caps tag-bearing bundles while leaving relation-only bundles at
    // entityTtlSeconds.
    final UUID tagBundleId = UUID.randomUUID();
    bundleCache.put(TYPE, tagBundleId, largeBundleDto(2));
    assertEquals(Duration.ofSeconds(120), cache.lastSetTtl);

    final UUID relOnlyId = UUID.randomUUID();
    final CachedReadBundle.Dto relOnlyDto = new CachedReadBundle.Dto();
    relOnlyDto.relations =
        Map.of("owners", List.of(new EntityReference().withId(UUID.randomUUID()).withType("user")));
    bundleCache.put(TYPE, relOnlyId, relOnlyDto);
    assertEquals(Duration.ofSeconds(7200), cache.lastSetTtl);

    // Disabling tag caching (tagTtlSeconds <= 0) strips tags from pre-existing bundles on read,
    // skips writing tag-only bundles, and writes relation+tag bundles without tags.
    config.tagTtlSeconds = 0;
    final CachedReadBundle.Dto readExisting = bundleCache.get(TYPE, tagBundleId);
    assertNotNull(readExisting);
    assertFalse(readExisting.tagsLoaded);
    assertNull(readExisting.tags);
    final CachedReadBundle.Dto batchExisting =
        bundleCache.getBatch(TYPE, List.of(tagBundleId)).getFirst();
    assertNotNull(batchExisting);
    assertFalse(batchExisting.tagsLoaded);
    assertNull(batchExisting.tags);

    final UUID tagOnlyDisabledId = UUID.randomUUID();
    bundleCache.put(TYPE, tagOnlyDisabledId, largeBundleDto(2));
    assertTrue(cache.get(keys.bundle(TYPE, tagOnlyDisabledId)).isEmpty());

    final UUID mixedDisabledId = UUID.randomUUID();
    final CachedReadBundle.Dto mixedDto = largeBundleDto(2);
    mixedDto.relations = relOnlyDto.relations;
    bundleCache.put(TYPE, mixedDisabledId, mixedDto);
    assertEquals(Duration.ofSeconds(7200), cache.lastSetTtl);
    // Re-enable tagTtlSeconds to verify tags were not persisted into Redis when disabled.
    config.tagTtlSeconds = 120;
    final CachedReadBundle.Dto persistedMixed = bundleCache.get(TYPE, mixedDisabledId);
    assertNotNull(persistedMixed);
    assertFalse(persistedMixed.tagsLoaded);
    assertNull(persistedMixed.tags);
    assertEquals(1, persistedMixed.relations.get("owners").size());
  }

  @Test
  void tagUsageDaoUsesTagTtlSecondsAndHonorsDisabledTtlAndSkipPopulate() {
    final RecordingTtlCacheProvider cache = new RecordingTtlCacheProvider();
    final CacheKeys keys = new CacheKeys("om");
    final CacheConfig config = new CacheConfig();
    config.entityTtlSeconds = 7200;
    config.tagTtlSeconds = 180;
    final CachedTagUsageDao dao = new CachedTagUsageDao(null, cache, keys, config);
    final UUID entityId = UUID.randomUUID();
    final String tagsJson = "[{\"tagFQN\":\"PII.Sensitive\"}]";

    dao.putTags(TYPE, entityId, tagsJson, true);
    assertEquals(Duration.ofSeconds(180), cache.lastSetTtl);
    assertEquals(1, dao.getTags(TYPE, entityId, true).size());

    final UUID skippedId = UUID.randomUUID();
    try (EntityCacheBypass.Handle ignored = EntityCacheBypass.skipPopulate()) {
      assertEquals(1, dao.getTags(TYPE, entityId, true).size());
      dao.putTags(TYPE, skippedId, tagsJson, true);
    }
    assertNull(dao.getTags(TYPE, skippedId, true));

    config.tagTtlSeconds = 0;
    final UUID disabledId = UUID.randomUUID();
    dao.putTags(TYPE, disabledId, tagsJson, true);
    assertNull(dao.getTags(TYPE, disabledId, true));
    assertNull(dao.getTags(TYPE, entityId, true));
  }

  @Test
  void relationshipDaoHonorsSkipPopulateWhileAllowingReads() {
    final InMemoryCacheProvider cache = new InMemoryCacheProvider();
    final CacheKeys keys = new CacheKeys("om");
    final CachedRelationshipDao dao =
        new CachedRelationshipDao(null, cache, keys, new CacheConfig());
    final UUID warmId = UUID.randomUUID();
    final UUID coldId = UUID.randomUUID();

    dao.putOwners(TYPE, warmId, "[]");
    try (EntityCacheBypass.Handle ignored = EntityCacheBypass.skipPopulate()) {
      assertNotNull(dao.getOwners(TYPE, warmId));
      dao.putOwners(TYPE, coldId, "[]");
      dao.putDomains(TYPE, coldId, "[]");
    }

    assertNull(dao.getOwners(TYPE, coldId));
    assertNull(dao.getDomains(TYPE, coldId));
  }

  @Test
  void skipPopulateRestoresNestedStateCleanly() {
    assertFalse(EntityCacheBypass.isPopulateSkipped());
    try (EntityCacheBypass.Handle outer = EntityCacheBypass.skipPopulate()) {
      assertTrue(EntityCacheBypass.isPopulateSkipped());
      assertFalse(EntityCacheBypass.isSkipped());
      try (EntityCacheBypass.Handle inner = EntityCacheBypass.skipPopulate()) {
        assertTrue(EntityCacheBypass.isPopulateSkipped());
      }
      assertTrue(EntityCacheBypass.isPopulateSkipped());
    }
    assertFalse(EntityCacheBypass.isPopulateSkipped());
  }

  private static CachedReadBundle.Dto largeBundleDto(final int tagCount) {
    final CachedReadBundle.Dto dto = new CachedReadBundle.Dto();
    dto.tagsLoaded = true;
    dto.tags = new ArrayList<>(tagCount);
    for (int i = 0; i < tagCount; i++) {
      dto.tags.add(
          new TagLabel()
              .withTagFQN("Classification.Tag_" + i)
              .withDescription("Repeated governance classification description"));
    }
    return dto;
  }

  private static final class RecordingTtlCacheProvider extends InMemoryCacheProvider {
    private Duration lastSetTtl;

    @Override
    public void set(final String key, final String value, final Duration ttl) {
      this.lastSetTtl = ttl;
      super.set(key, value, ttl);
    }
  }
}
