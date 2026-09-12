package org.openmetadata.service.entity.cache;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.google.common.cache.Cache;
import com.google.common.cache.CacheBuilder;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.service.Entity;
import org.openmetadata.service.cache.CacheConfig;
import org.openmetadata.service.cache.CacheKeys;
import org.openmetadata.service.cache.CachedEntityDao;
import org.openmetadata.service.cache.CachedLineage;
import org.openmetadata.service.cache.CachedReadBundle;
import org.openmetadata.service.cache.CachedRelationshipDao;
import org.openmetadata.service.cache.CachedTagUsageDao;
import org.openmetadata.service.cache.NoopCacheProvider;
import org.openmetadata.service.config.CacheConfiguration;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipRecord;
import org.openmetadata.service.util.PostCommitActionQueue;

class EntityCacheInvalidationTest {
  @Test
  void committedMetadataChangesDiscardEveryProjectionAndAdvanceTheEpoch() {
    final Fixture fixture = new Fixture();
    fixture.service.metadataChanged(Entity.TABLE, fixture.id, fixture.fqn);
    fixture.assertLocalMissing(fixture.fqn);
    assertNull(fixture.request.getIfPresent(fixture.id));
    assertNull(fixture.registered.getIfPresent(fixture.id));
    assertTrue(fixture.provider.values.asMap().isEmpty());
    assertEquals(1, fixture.epochs.byId(EntityCacheKeys.id(Entity.TABLE, fixture.id)));
    assertEquals(List.of(fixture.fqn), fixture.notices);
    assertEquals(List.of(new Repair(Entity.TABLE, fixture.fqn, null)), fixture.repairs);
  }

  @AfterEach
  void clearPostCommitScope() {
    PostCommitActionQueue.clear();
  }

  @Test
  void indirectChangesEvictLocalStateImmediatelyAndSharedStateAfterTheFlush() {
    final Fixture fixture = new Fixture();
    assertTrue(fixture.service.deferred().begin());
    fixture.service.referencesChanged(Entity.TABLE, fixture.id, null);
    fixture.service.referencesChanged(Entity.TABLE, fixture.id, fixture.fqn);
    fixture.assertLocalMissing(fixture.fqn);
    assertNotNull(
        fixture.provider.values.getIfPresent(fixture.keys.entity(Entity.TABLE, fixture.id)));
    assertTrue(fixture.notices.isEmpty());
    assertEquals(2, fixture.epochs.byId(EntityCacheKeys.id(Entity.TABLE, fixture.id)));
    fixture.service.deferred().drain();
    assertTrue(fixture.provider.values.asMap().isEmpty());
    assertEquals(List.of(fixture.fqn), fixture.notices);
  }

  @ParameterizedTest
  @ValueSource(strings = {Entity.TABLE, Entity.USER})
  void readsBetweenInvalidationAndCommitCannotRetainThePreviousRow(String type) {
    final Fixture fixture = new Fixture();
    fixture.service.deferred().begin();
    fixture.service.referencesChanged(type, fixture.id, fixture.fqn);
    CompletableFuture.runAsync(() -> fixture.assertLoaded(type, "before commit")).join();
    fixture.committedJson = "after commit";
    fixture.service.deferred().drain();
    fixture.assertLoaded(type, "after commit");
    assertEquals(
        EntityCachePolicy.isCacheable(type) ? List.of(fixture.fqn) : List.of(), fixture.notices);
  }

  @Test
  void sharedEvictionFinishesBeforeDiscardingLocalRefills() {
    final Fixture fixture = new Fixture();
    fixture.service.deferred().begin();
    fixture.service.referencesChanged(Entity.TABLE, fixture.id, fixture.fqn);
    fixture.provider.beforeDelete =
        () -> {
          final String stale =
              fixture.provider.values.getIfPresent(
                  fixture.keys.entityByName(Entity.TABLE, fixture.fqn));
          if (stale != null) {
            fixture.local.byName().put(EntityCacheKeys.name(Entity.TABLE, fixture.fqn), stale);
          }
        };
    fixture.committedJson = "after commit";
    fixture.service.deferred().drain();
    fixture.assertLoaded(Entity.TABLE, "after commit");
  }

  @Test
  void sharedFailureStillDiscardsLocalRefillsAfterCommit() {
    final Fixture fixture = new Fixture();
    fixture.service.deferred().begin();
    fixture.service.referencesChanged(Entity.TABLE, fixture.id, fixture.fqn);
    fixture.assertLoaded(Entity.TABLE, "before commit");
    fixture.committedJson = "after commit";
    fixture.provider.failed = true;
    assertThrows(IllegalStateException.class, fixture.service.deferred()::drain);
    fixture.assertLoaded(Entity.TABLE, "after commit");
  }

  @Test
  void sharedFailureCannotLeaveLaterCommittedEntitiesInTheLocalCache() {
    final Fixture fixture = new Fixture();
    final UUID secondId = UUID.randomUUID();
    fixture.service.deferred().begin();
    fixture.service.referencesChanged(Entity.TABLE, fixture.id, fixture.fqn);
    fixture.service.referencesChanged(Entity.TABLE, secondId, null);
    fixture.local.byId().put(EntityCacheKeys.id(Entity.TABLE, secondId), "before commit");
    fixture.provider.failed = true;
    assertThrows(IllegalStateException.class, fixture.service.deferred()::drain);
    assertNull(fixture.local.byId().getIfPresent(EntityCacheKeys.id(Entity.TABLE, secondId)));
  }

  @Test
  void rollbackDropsSharedInvalidationAndTheNextOperationRunsNormally() {
    final Fixture fixture = new Fixture();
    fixture.service.deferred().begin();
    fixture.service.referencesChanged(Entity.TABLE, fixture.id, fixture.fqn);
    fixture.service.deferred().clear();
    fixture.service.deferred().drain();
    assertFalse(fixture.provider.values.asMap().isEmpty());
    fixture.service.referencesChanged(Entity.TABLE, fixture.id, fixture.fqn);
    assertTrue(fixture.provider.values.asMap().isEmpty());
    assertEquals(List.of(fixture.fqn), fixture.notices);
  }

  @Test
  void excludedTypesKeepLocalInvalidationAndSkipAllSharedWork() {
    final Fixture fixture = new Fixture();
    fixture.prime(Entity.USER, fixture.fqn);
    fixture.service.referencesChanged(Entity.USER, fixture.id, fixture.fqn);
    assertNull(fixture.local.byId().getIfPresent(EntityCacheKeys.id(Entity.USER, fixture.id)));
    assertNull(fixture.local.byName().getIfPresent(EntityCacheKeys.name(Entity.USER, fixture.fqn)));
    assertTrue(fixture.notices.isEmpty());
    assertEquals(List.of(new Repair(Entity.USER, fixture.fqn, null)), fixture.repairs);
  }

  @Test
  void absentIdentityDoesNotTouchCachesOrScheduleRepairs() {
    final Fixture fixture = new Fixture();
    fixture.service.referencesChanged(null, fixture.id, fixture.fqn);
    fixture.service.referencesChanged(Entity.TABLE, null, fixture.fqn);
    fixture.service.remotelyChanged(null, fixture.id, fixture.fqn);
    assertNotNull(fixture.local.byId().getIfPresent(EntityCacheKeys.id(Entity.TABLE, fixture.id)));
    assertTrue(fixture.repairs.isEmpty());
    assertTrue(fixture.notices.isEmpty());
  }

  @Test
  void remoteSignalsAdvanceEpochsWithoutWritingSharedState() {
    final Fixture fixture = new Fixture();
    fixture.service.remotelyChanged(Entity.TABLE, fixture.id, null);
    fixture.service.remotelyChanged(Entity.TABLE, null, fixture.fqn);
    fixture.assertLocalMissing(fixture.fqn);
    assertEquals(1, fixture.epochs.byId(EntityCacheKeys.id(Entity.TABLE, fixture.id)));
    assertEquals(1, fixture.epochs.byName(EntityCacheKeys.name(Entity.TABLE, fixture.fqn)));
    assertFalse(fixture.provider.values.asMap().isEmpty());
    assertTrue(fixture.repairs.isEmpty());
    assertTrue(fixture.notices.isEmpty());
  }

  @Test
  void mutationPreparationPreservesTheSeparateEntitySpecificInvalidationHook() {
    final Fixture fixture = new Fixture();
    fixture.service.beforeEntityInvalidation(Entity.TABLE, fixture.id, fixture.fqn);
    fixture.assertLocalMissing(fixture.fqn);
    assertNull(fixture.request.getIfPresent(fixture.id));
    assertFalse(fixture.provider.values.asMap().isEmpty());
    assertEquals(List.of(new Repair(Entity.TABLE, fixture.fqn, null)), fixture.repairs);
    fixture.service.entityDeleted(Entity.TABLE, fixture.id, fixture.fqn);
    assertTrue(fixture.provider.values.asMap().isEmpty());
  }

  @Test
  void deletionRetainsBestEffortRedisFailureBehavior() {
    final Fixture fixture = new Fixture();
    fixture.provider.failed = true;
    fixture.service.entityDeleted(Entity.TABLE, fixture.id, fixture.fqn);
    fixture.assertLocalMissing(fixture.fqn);
    assertFalse(fixture.provider.values.asMap().isEmpty());
    assertTrue(fixture.notices.isEmpty());
  }

  @Test
  void renameEvictsOldAliasesBeforeWriteThroughAndDefersRegisteredLayers() {
    final Fixture fixture = new Fixture();
    final String previous = "service.previous";
    fixture.prime(Entity.TABLE, previous);
    fixture.service.prepareStored(Entity.TABLE, fixture.id, fixture.fqn, previous);
    fixture.assertLocalMissing(fixture.fqn);
    fixture.assertLocalMissing(previous);
    assertEquals(1, fixture.epochs.byName(EntityCacheKeys.name(Entity.TABLE, previous)));
    assertTrue(fixture.provider.values.asMap().isEmpty());
    assertTrue(fixture.notices.isEmpty());
    fixture.prime(Entity.TABLE, fixture.fqn);
    PostCommitActionQueue.begin();
    fixture.service.finishStored(Entity.TABLE, fixture.id, fixture.fqn, previous);
    assertNull(fixture.request.getIfPresent(fixture.id));
    assertNotNull(fixture.registered.getIfPresent(fixture.id));
    assertEquals(List.of(fixture.fqn, previous), fixture.notices);
    assertEquals(List.of(new Repair(Entity.TABLE, fixture.fqn, previous)), fixture.repairs);
    PostCommitActionQueue.run(PostCommitActionQueue.drain());
    assertNull(fixture.registered.getIfPresent(fixture.id));
    assertNotNull(
        fixture.provider.values.getIfPresent(fixture.keys.entity(Entity.TABLE, fixture.id)));
  }

  @Test
  void unchangedNamesAdvanceTheirEpochOnlyOnce() {
    final Fixture fixture = new Fixture();
    fixture.service.prepareStored(Entity.TABLE, fixture.id, fixture.fqn, fixture.fqn);
    fixture.service.finishStored(Entity.TABLE, fixture.id, fixture.fqn, fixture.fqn);
    assertEquals(1, fixture.epochs.byName(EntityCacheKeys.name(Entity.TABLE, fixture.fqn)));
    assertNull(fixture.registered.getIfPresent(fixture.id));
    assertEquals(List.of(fixture.fqn), fixture.notices);
  }

  @ParameterizedTest
  @ValueSource(strings = {"", "invalid-json", "{}", "{\"fullyQualifiedName\":null}"})
  void relationshipRecordsWithoutUsableNamesStillEvictById(String json) {
    final Fixture fixture = new Fixture();
    fixture.service.referenced(
        EntityRelationshipRecord.builder().id(fixture.id).type(Entity.TABLE).json(json).build());
    assertNull(fixture.local.byId().getIfPresent(EntityCacheKeys.id(Entity.TABLE, fixture.id)));
    assertNotNull(
        fixture.local.byName().getIfPresent(EntityCacheKeys.name(Entity.TABLE, fixture.fqn)));
  }

  @Test
  void relationshipRecordNamesInvalidateBothAliases() {
    final Fixture fixture = new Fixture();
    fixture.service.referenced(null);
    fixture.service.referenced(
        EntityRelationshipRecord.builder()
            .id(fixture.id)
            .type(Entity.TABLE)
            .json("{\"fullyQualifiedName\":\"service.table\"}")
            .build());
    fixture.assertLocalMissing(fixture.fqn);
    assertTrue(fixture.provider.values.asMap().isEmpty());
  }

  private record Repair(String type, String name, String previous) {}

  private static final class Fixture implements EntityCacheLayers {
    private final UUID id = UUID.randomUUID();
    private final String fqn = "service.table";
    private volatile String committedJson = "before commit";
    private final EntityLocalCache local =
        new EntityLocalCache(key -> committedJson, key -> committedJson, new CacheConfiguration());
    private final EntityCacheEpochs epochs = new EntityCacheEpochs();
    private final Provider provider = new Provider();
    private final CacheKeys keys = new CacheKeys("om:invalidation-policy-test");
    private final Cache<UUID, String> request = CacheBuilder.newBuilder().maximumSize(100).build();
    private final Cache<UUID, String> registered =
        CacheBuilder.newBuilder().maximumSize(100).build();
    private final CachedEntityDao entities = new CachedEntityDao(provider, keys, new CacheConfig());
    private final List<Repair> repairs = new ArrayList<>();
    private final List<String> notices = new ArrayList<>();
    private final EntityCacheInvalidation service =
        new EntityCacheInvalidation(
            local,
            epochs,
            new EntitySharedCacheInvalidation(this),
            new EntityCacheInvalidation.Effects(
                (type, id, name, previous) -> repairs.add(new Repair(type, name, previous)),
                (type, id, name) -> request.invalidate(id),
                (type, id, name) -> registered.invalidate(id)));

    private Fixture() {
      prime(Entity.TABLE, fqn);
      request.put(id, "projection");
      registered.put(id, "negative marker");
    }

    private void prime(String type, String name) {
      local.byId().put(EntityCacheKeys.id(type, id), "json");
      local.byName().put(EntityCacheKeys.name(type, name), "json");
      provider.values.put(keys.entity(type, id), "entity");
      provider.values.put(keys.entityByName(type, name), "entity");
      provider.values.put(keys.refByName(type, name), "reference");
    }

    private void assertLocalMissing(String name) {
      assertNull(local.byId().getIfPresent(EntityCacheKeys.id(Entity.TABLE, id)));
      assertNull(local.byName().getIfPresent(EntityCacheKeys.name(Entity.TABLE, name)));
    }

    private void assertLoaded(String type, String json) {
      assertEquals(json, local.byId().getUnchecked(EntityCacheKeys.id(type, id)));
      assertEquals(json, local.byName().getUnchecked(EntityCacheKeys.name(type, fqn)));
    }

    @Override
    public CachedEntityDao entities() {
      return entities;
    }

    @Override
    public CachedRelationshipDao relationships() {
      return null;
    }

    @Override
    public CachedReadBundle bundles() {
      return null;
    }

    @Override
    public CachedLineage lineage() {
      return null;
    }

    @Override
    public CachedTagUsageDao tags() {
      return null;
    }

    @Override
    public void publish(String type, UUID id, String fqn, String operation) {
      notices.add(fqn);
    }
  }

  private static final class Provider extends NoopCacheProvider {
    private final Cache<String, String> values = CacheBuilder.newBuilder().maximumSize(100).build();
    private boolean failed;
    private Runnable beforeDelete = () -> {};

    @Override
    public void del(String... keys) {
      beforeDelete.run();
      if (failed) {
        throw new IllegalStateException("Redis unavailable");
      }
      for (final String key : keys) {
        values.invalidate(key);
      }
    }
  }
}
