package org.openmetadata.service.entity.cache;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.google.common.cache.Cache;
import com.google.common.cache.CacheBuilder;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.cache.CacheConfig;
import org.openmetadata.service.cache.CacheKeys;
import org.openmetadata.service.cache.CachedEntityDao;
import org.openmetadata.service.cache.CachedLineage;
import org.openmetadata.service.cache.CachedReadBundle;
import org.openmetadata.service.cache.CachedRelationshipDao;
import org.openmetadata.service.cache.CachedTagUsageDao;
import org.openmetadata.service.cache.EntityCacheBypass;
import org.openmetadata.service.cache.NoopCacheProvider;

class EntitySharedCacheInvalidationTest {
  @Test
  void metadataChangesEvictTagsWithTheirCachedBundleBeforePublishing() {
    final Fixture fixture = new Fixture();
    fixture.service.metadataChanged(Entity.TABLE, fixture.id, fixture.fqn);
    assertTrue(fixture.provider.values.asMap().isEmpty());
    assertEquals(List.of(new Notice(fixture.fqn, "update")), fixture.notices);
  }

  @Test
  void indirectChangesEvictAliasesAndDerivedViewsWhilePreservingTags() {
    final Fixture fixture = new Fixture();
    fixture.service.referencesChanged(Entity.TABLE, fixture.id, fixture.fqn);
    fixture.assertOnlyTagsRemain();
    assertEquals(List.of(new Notice(fixture.fqn, "ref-change")), fixture.notices);
  }

  @Test
  void deletionAlsoEvictsTagsBeforePublishing() {
    final Fixture fixture = new Fixture();
    fixture.service.entityDeleted(Entity.TABLE, fixture.id, fixture.fqn);
    assertTrue(fixture.provider.values.asMap().isEmpty());
    assertEquals(List.of(new Notice(fixture.fqn, "invalidate")), fixture.notices);
  }

  @Test
  void renameEvictsBothNamesBeforeWriteThroughAndPublishesAfterwards() {
    final Fixture fixture = new Fixture();
    final String previous = "service.previous";
    fixture.primeName(previous);
    fixture.service.beforeWriteThrough(Entity.TABLE, fixture.id, fixture.fqn, previous);
    fixture.assertOnlyTagsRemain();
    assertTrue(fixture.notices.isEmpty());
    fixture.service.afterWriteThrough(Entity.TABLE, fixture.id, fixture.fqn, previous);
    assertEquals(
        List.of(new Notice(fixture.fqn, "update"), new Notice(previous, "rename-old")),
        fixture.notices);
  }

  @Test
  void unchangedAndAbsentPreviousNamesPublishOneUpdate() {
    final Fixture fixture = new Fixture();
    fixture.service.beforeWriteThrough(Entity.TABLE, fixture.id, fixture.fqn, fixture.fqn);
    fixture.service.afterWriteThrough(Entity.TABLE, fixture.id, fixture.fqn, fixture.fqn);
    fixture.service.beforeWriteThrough(Entity.TABLE, fixture.id, fixture.fqn, null);
    fixture.service.afterWriteThrough(Entity.TABLE, fixture.id, fixture.fqn, null);
    assertEquals(
        List.of(new Notice(fixture.fqn, "update"), new Notice(fixture.fqn, "update")),
        fixture.notices);
  }

  @Test
  void missingNamesKeepUnrelatedNameEntries() {
    final Fixture fixture = new Fixture();
    fixture.service.referencesChanged(Entity.TABLE, fixture.id, null);
    assertTrue(
        fixture
            .provider
            .values
            .asMap()
            .containsKey(fixture.keys.entityByName(Entity.TABLE, fixture.fqn)));
    assertFalse(
        fixture.provider.values.asMap().containsKey(fixture.keys.entity(Entity.TABLE, fixture.id)));
    fixture.service.beforeWriteThrough(Entity.TABLE, fixture.id, null, null);
    assertEquals(List.of(new Notice(null, "ref-change")), fixture.notices);
  }

  @Test
  void disabledLayersDoNotAccessTheProvider() {
    final Fixture fixture = new Fixture();
    fixture.enabled = false;
    final long originalSize = fixture.provider.values.size();
    fixture.service.referencesChanged(Entity.TABLE, fixture.id, fixture.fqn);
    fixture.service.entityDeleted(Entity.TABLE, fixture.id, fixture.fqn);
    fixture.service.beforeWriteThrough(Entity.TABLE, fixture.id, fixture.fqn, "old");
    fixture.service.metadataChanged(Entity.TABLE, fixture.id, fixture.fqn);
    assertEquals(originalSize, fixture.provider.values.size());
  }

  @Test
  void entityCacheBypassRetainsExistingLayerSpecificCoverage() {
    final Fixture fixture = new Fixture();
    try (var ignored = EntityCacheBypass.skip()) {
      fixture.service.entityDeleted(Entity.TABLE, fixture.id, fixture.fqn);
    }
    assertTrue(
        fixture.provider.values.asMap().containsKey(fixture.keys.entity(Entity.TABLE, fixture.id)));
    assertTrue(
        fixture.provider.values.asMap().containsKey(fixture.keys.tags(Entity.TABLE, fixture.id)));
    assertTrue(
        fixture.provider.values.asMap().containsKey(fixture.keys.bundle(Entity.TABLE, fixture.id)));
    assertEquals(List.of(new Notice(fixture.fqn, "invalidate")), fixture.notices);
  }

  @Test
  void providerFailuresRemainVisibleToTheCallingInvalidationPolicy() {
    final Fixture fixture = new Fixture();
    fixture.provider.failed = true;
    assertThrows(
        IllegalStateException.class,
        () -> fixture.service.referencesChanged(Entity.TABLE, fixture.id, fixture.fqn));
    assertTrue(fixture.notices.isEmpty());
    assertTrue(
        fixture.provider.values.asMap().containsKey(fixture.keys.bundle(Entity.TABLE, fixture.id)));
  }

  private record Notice(String name, String operation) {}

  private static final class Fixture implements EntityCacheLayers {
    private final UUID id = UUID.randomUUID();
    private final String fqn = "service.table";
    private final Provider provider = new Provider();
    private final CacheKeys keys = new CacheKeys("om:invalidation-test");
    private final CacheConfig config = new CacheConfig();
    private final CachedEntityDao entities = new CachedEntityDao(provider, keys, config);
    private final CachedRelationshipDao relationships =
        new CachedRelationshipDao(null, provider, keys, config);
    private final CachedReadBundle bundles = new CachedReadBundle(provider, keys, config);
    private final CachedLineage lineage = new CachedLineage(provider, keys, config);
    private final CachedTagUsageDao tags = new CachedTagUsageDao(null, provider, keys, config);
    private final List<Notice> notices = new ArrayList<>();
    private final EntitySharedCacheInvalidation service = new EntitySharedCacheInvalidation(this);
    private boolean enabled = true;

    private Fixture() {
      provider.values.put(keys.entity(Entity.TABLE, id), "base/ref/owners/domains");
      provider.values.put(keys.bundle(Entity.TABLE, id), "bundle");
      provider.values.put(keys.tags(Entity.TABLE, id), "tags");
      provider.values.put(keys.lineageGraphHash(id), "lineage");
      provider.values.put(
          keys.containerRef(Entity.TABLE, id, Relationship.CONTAINS.ordinal()), "parent");
      primeName(fqn);
    }

    private void primeName(String name) {
      provider.values.put(keys.entityByName(Entity.TABLE, name), "row");
      provider.values.put(keys.refByName(Entity.TABLE, name), "reference");
    }

    private void assertOnlyTagsRemain() {
      assertEquals(
          List.of(keys.tags(Entity.TABLE, id)), new ArrayList<>(provider.values.asMap().keySet()));
    }

    @Override
    public CachedEntityDao entities() {
      return enabled ? entities : null;
    }

    @Override
    public CachedRelationshipDao relationships() {
      return enabled ? relationships : null;
    }

    @Override
    public CachedReadBundle bundles() {
      return enabled ? bundles : null;
    }

    @Override
    public CachedLineage lineage() {
      return enabled ? lineage : null;
    }

    @Override
    public CachedTagUsageDao tags() {
      return enabled ? tags : null;
    }

    @Override
    public void publish(String type, UUID id, String name, String operation) {
      notices.add(new Notice(name, operation));
    }
  }

  private static final class Provider extends NoopCacheProvider {
    private final Cache<String, String> values = CacheBuilder.newBuilder().maximumSize(100).build();
    private boolean failed;

    @Override
    public boolean available() {
      return true;
    }

    @Override
    public void del(String... keys) {
      if (failed) {
        throw new IllegalStateException("Redis unavailable");
      }
      for (final String key : keys) {
        values.invalidate(key);
      }
    }
  }
}
