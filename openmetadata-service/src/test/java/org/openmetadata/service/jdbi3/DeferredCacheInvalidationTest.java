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
package org.openmetadata.service.jdbi3;

import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Stream;
import org.apache.commons.lang3.tuple.ImmutablePair;
import org.apache.commons.lang3.tuple.Pair;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.cache.CacheBundle;
import org.openmetadata.service.cache.CacheConfig;
import org.openmetadata.service.cache.CacheKeys;
import org.openmetadata.service.cache.CacheProvider;
import org.openmetadata.service.cache.CachedEntityDao;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

/**
 * A cascade write (the bulk restore, relationship rewrites) evicts its entities from Redis only
 * after its transaction commits. These tests pin what readers see across that commit.
 * RestoreHierarchyIT#asyncRestore_returns202AndRestoresFullHierarchy 404'd on a schema whose
 * restore had already committed: the parent database read fresh while the schema was still served
 * from its pre-restore copy.
 */
class DeferredCacheInvalidationTest {

  private static final Duration REPAIR_WAIT = Duration.ofSeconds(5);

  private final InMemoryCacheProvider redis = new InMemoryCacheProvider();
  private final CacheKeys keys = new CacheKeys("test");
  private final CachedEntityDao cachedEntityDao =
      new CachedEntityDao(redis, keys, new CacheConfig());
  private CollectionDAO.PipelineDAO pipelineDAO;
  private StubPipelineRepository repository;
  private MockedStatic<CacheBundle> cacheBundle;

  @BeforeEach
  void setUp() {
    pipelineDAO = mock(CollectionDAO.PipelineDAO.class);
    Entity.setCollectionDAO(mock(CollectionDAO.class));
    repository = new StubPipelineRepository(pipelineDAO);
    cacheBundle = mockStatic(CacheBundle.class);
    cacheBundle.when(CacheBundle::getCachedEntityDao).thenReturn(cachedEntityDao);
    EntityCacheRepair.start();
    EntityRepository.clearCacheInvalidations();
  }

  @AfterEach
  void tearDown() {
    EntityRepository.clearCacheInvalidations();
    cacheBundle.close();
    Entity.setCollectionDAO(null);
  }

  @Test
  void readerThatCachedThePreCommitCopyInsideTheTransactionSeesTheCommitAfterTheDrain() {
    final Pipeline restored = pipeline("orders");
    cachedEntityDao.putBase(Entity.PIPELINE, restored.getId(), jsonOf(restored, true));
    storeCommittedRow(restored);

    EntityRepository.beginCacheInvalidationDeferral();
    repository.invalidate(restored);
    final String readInsideTransaction = readThroughL1(restored);
    EntityRepository.drainCacheInvalidations();

    assertTrue(
        isDeleted(readInsideTransaction),
        "until the commit the soft-deleted copy is still the committed state");
    assertFalse(
        isDeleted(readThroughL1(restored)),
        "after the commit L1 must not keep serving the copy it loaded from the stale Redis entry");
  }

  @Test
  void drainEvictsTheWholeCommittedBatchFromRedisAtOnce() {
    final List<Pipeline> children =
        List.of(pipeline("schema_a"), pipeline("schema_b"), pipeline("schema_c"));
    children.forEach(
        child -> cachedEntityDao.putBase(Entity.PIPELINE, child.getId(), jsonOf(child, true)));
    EntityRepository.beginCacheInvalidationDeferral();
    children.forEach(repository::invalidate);
    redis.watch(
        children.stream().map(child -> keys.entity(Entity.PIPELINE, child.getId())).toList());

    EntityRepository.drainCacheInvalidations();

    final List<Integer> leftAfterEachWrite = redis.watchedKeysLeftAfterEachWrite();
    assertFalse(leftAfterEachWrite.isEmpty(), "the drain must evict the committed batch");
    assertTrue(
        leftAfterEachWrite.stream().allMatch(left -> left == 0),
        "a reader must never find one committed child evicted while a sibling still serves its "
            + "pre-commit copy; watched keys left after each Redis write: "
            + leftAfterEachWrite);
  }

  @Test
  void repairArmedAtCommitEvictsAStaleL1CopyThatLandsAfterTheDrain() {
    final Pipeline restored = pipeline("orders");
    EntityRepository.beginCacheInvalidationDeferral();
    repository.invalidate(restored);
    awaitRepairArmedInsideTheTransaction(restored);
    EntityRepository.drainCacheInvalidations();

    EntityRepository.CACHE_WITH_ID.put(idKey(restored), jsonOf(restored, true));

    await("repair armed at commit")
        .atMost(REPAIR_WAIT)
        .until(() -> EntityRepository.CACHE_WITH_ID.getIfPresent(idKey(restored)) == null);
  }

  @Test
  void insideADeferralScopeRedisKeepsTheEntryUntilTheDrain() {
    final Pipeline pipeline = pipeline("orders");
    cacheInRedis(pipeline);

    EntityRepository.beginCacheInvalidationDeferral();
    repository.invalidateCache(pipeline);
    final long variantsInsideTransaction = redisVariantsOf(pipeline);
    EntityRepository.drainCacheInvalidations();

    assertEquals(
        2,
        variantsInsideTransaction,
        "a DEL sent before the commit is undone by any concurrent reader of the old row");
    assertEquals(0, redisVariantsOf(pipeline), "the drain evicts both variants after the commit");
  }

  @Test
  void withoutADeferralScopeRedisIsEvictedImmediately() {
    final Pipeline pipeline = pipeline("orders");
    cacheInRedis(pipeline);

    repository.invalidateCache(pipeline);

    assertEquals(0, redisVariantsOf(pipeline));
  }

  /** Stands in for a transaction that outlives the repair its own eviction armed. */
  private static void awaitRepairArmedInsideTheTransaction(final Pipeline pipeline) {
    EntityRepository.CACHE_WITH_ID.put(idKey(pipeline), jsonOf(pipeline, true));
    await("repair armed inside the transaction")
        .atMost(REPAIR_WAIT)
        .until(() -> EntityRepository.CACHE_WITH_ID.getIfPresent(idKey(pipeline)) == null);
  }

  private void storeCommittedRow(final Pipeline pipeline) {
    when(pipelineDAO.findById(any(), eq(pipeline.getId()), any()))
        .thenReturn(jsonOf(pipeline, false));
  }

  private void cacheInRedis(final Pipeline pipeline) {
    final String json = jsonOf(pipeline, false);
    cachedEntityDao.putBase(Entity.PIPELINE, pipeline.getId(), json);
    cachedEntityDao.putByName(Entity.PIPELINE, pipeline.getFullyQualifiedName(), json);
  }

  private long redisVariantsOf(final Pipeline pipeline) {
    return Stream.of(
            cachedEntityDao.getBase(pipeline.getId(), Entity.PIPELINE),
            cachedEntityDao.getByName(Entity.PIPELINE, pipeline.getFullyQualifiedName()))
        .filter(Optional::isPresent)
        .count();
  }

  private static String readThroughL1(final Pipeline pipeline) {
    return EntityRepository.CACHE_WITH_ID.getUnchecked(idKey(pipeline));
  }

  private static Pair<String, UUID> idKey(final Pipeline pipeline) {
    return new ImmutablePair<>(Entity.PIPELINE, pipeline.getId());
  }

  private static Pipeline pipeline(final String name) {
    return new Pipeline()
        .withId(UUID.randomUUID())
        .withName(name)
        .withFullyQualifiedName("service." + name)
        .withDeleted(false);
  }

  private static String jsonOf(final Pipeline pipeline, final boolean deleted) {
    return JsonUtils.pojoToJson(JsonUtils.deepCopy(pipeline, Pipeline.class).withDeleted(deleted));
  }

  private static boolean isDeleted(final String json) {
    return Boolean.TRUE.equals(JsonUtils.readValue(json, Pipeline.class).getDeleted());
  }

  private static final class StubPipelineRepository extends EntityRepository<Pipeline> {
    StubPipelineRepository(final CollectionDAO.PipelineDAO dao) {
      super("pipelines", Entity.PIPELINE, Pipeline.class, dao, "", "");
    }

    @Override
    protected void setFields(Pipeline entity, Fields fields, RelationIncludes relationIncludes) {}

    @Override
    protected void clearFields(Pipeline entity, Fields fields) {}

    @Override
    protected void prepare(Pipeline entity, boolean update) {}

    @Override
    protected void storeEntity(Pipeline entity, boolean update) {}

    @Override
    protected void storeRelationships(Pipeline entity) {}
  }

  /** Redis stand-in that records, after every write, how many of the watched keys are left. */
  private static final class InMemoryCacheProvider implements CacheProvider {
    private final Map<String, String> strings = new HashMap<>();
    private final Map<String, Map<String, String>> hashes = new HashMap<>();
    private final List<Integer> watchedKeysLeftAfterEachWrite = new ArrayList<>();
    private List<String> watchedKeys = List.of();

    void watch(final List<String> keysToWatch) {
      watchedKeys = List.copyOf(keysToWatch);
    }

    List<Integer> watchedKeysLeftAfterEachWrite() {
      return List.copyOf(watchedKeysLeftAfterEachWrite);
    }

    @Override
    public Optional<String> get(final String key) {
      return Optional.ofNullable(strings.get(key));
    }

    @Override
    public void set(final String key, final String value, final Duration ttl) {
      strings.put(key, value);
      recordWrite();
    }

    @Override
    public boolean setIfAbsent(final String key, final String value, final Duration ttl) {
      final boolean absent = strings.putIfAbsent(key, value) == null;
      recordWrite();
      return absent;
    }

    @Override
    public void del(final String... keysToDelete) {
      for (final String key : keysToDelete) {
        strings.remove(key);
        hashes.remove(key);
      }
      recordWrite();
    }

    @Override
    public Optional<String> hget(final String key, final String field) {
      return Optional.ofNullable(hashes.getOrDefault(key, Map.of()).get(field));
    }

    @Override
    public void hset(final String key, final Map<String, String> fields, final Duration ttl) {
      hashes.computeIfAbsent(key, ignored -> new HashMap<>()).putAll(fields);
      recordWrite();
    }

    @Override
    public void hdel(final String key, final String... fields) {
      final Map<String, String> hash = hashes.getOrDefault(key, new HashMap<>());
      for (final String field : fields) {
        hash.remove(field);
      }
      if (hash.isEmpty()) {
        hashes.remove(key);
      }
      recordWrite();
    }

    @Override
    public boolean available() {
      return true;
    }

    @Override
    public Map<String, Object> getStats() {
      return Map.of();
    }

    @Override
    public void close() {}

    private void recordWrite() {
      if (!watchedKeys.isEmpty()) {
        watchedKeysLeftAfterEachWrite.add(
            (int) watchedKeys.stream().filter(hashes::containsKey).count());
      }
    }
  }
}
