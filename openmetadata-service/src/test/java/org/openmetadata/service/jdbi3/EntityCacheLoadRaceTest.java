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

import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import com.github.benmanes.caffeine.cache.LoadingCache;
import java.time.Duration;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.FutureTask;
import java.util.concurrent.TimeUnit;
import org.apache.commons.lang3.tuple.ImmutablePair;
import org.awaitility.Awaitility;
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
import org.openmetadata.service.cache.CachedEntityDao;
import org.openmetadata.service.cache.InMemoryCacheProvider;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

/**
 * Once a write returns, a read that raced it must not have left the pre-write entity in the in-JVM
 * entity cache. Restore-then-read in the Redis IT lane failed this way: a reader cached the
 * soft-deleted row and the next GET 404'd until the deferred cache repair ran.
 */
class EntityCacheLoadRaceTest {
  private static final long TIMEOUT_SECONDS = 10;
  private static final long MAX_WEIGHT_BYTES = 1_000_000L;
  private static final int TTL_SECONDS = 60;
  private static final Set<Thread.State> STOPPED_STATES =
      Set.of(Thread.State.BLOCKED, Thread.State.WAITING, Thread.State.TERMINATED);

  private PipelineRepository repository;

  private static class PipelineRepository extends EntityRepository<Pipeline> {
    PipelineRepository(CollectionDAO.PipelineDAO dao) {
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

  /** Stands in for a read that reaches Redis just before the refresh deletes the old copy. */
  private static final class ReadBeforeFirstDelete extends InMemoryCacheProvider {
    private final Runnable read;
    private boolean readDone;

    ReadBeforeFirstDelete(Runnable read) {
      this.read = read;
    }

    @Override
    public void del(String... keys) {
      if (!readDone) {
        readDone = true;
        read.run();
      }
      super.del(keys);
    }
  }

  @BeforeEach
  void setUp() {
    // The database is the only boundary mocked; no test here reaches it.
    CollectionDAO daoCollection = mock(CollectionDAO.class);
    when(daoCollection.relationshipDAO())
        .thenReturn(mock(CollectionDAO.EntityRelationshipDAO.class));
    Entity.setCollectionDAO(daoCollection);
    repository = new PipelineRepository(mock(CollectionDAO.PipelineDAO.class));
  }

  @AfterEach
  void tearDown() {
    Entity.setCollectionDAO(null);
  }

  @Test
  void evictionDuringAnInFlightLoadDiscardsWhatTheLoadRead() throws Exception {
    CountDownLatch loadReadTheRow = new CountDownLatch(1);
    CountDownLatch finishLoad = new CountDownLatch(1);
    LoadingCache<String, String> cache =
        EntityRepository.entityCacheBuilder(MAX_WEIGHT_BYTES, TTL_SECONDS)
            .build(
                key -> {
                  loadReadTheRow.countDown();
                  finishLoad.await();
                  return "pre-commit row";
                });

    FutureTask<String> reader = new FutureTask<>(() -> cache.get("entity"));
    new Thread(reader).start();
    assertTrue(loadReadTheRow.await(TIMEOUT_SECONDS, TimeUnit.SECONDS));
    Thread writer = new Thread(() -> cache.invalidate("entity"));
    writer.start();
    Awaitility.await()
        .atMost(Duration.ofSeconds(TIMEOUT_SECONDS))
        .until(() -> STOPPED_STATES.contains(writer.getState()));
    finishLoad.countDown();
    reader.get(TIMEOUT_SECONDS, TimeUnit.SECONDS);
    writer.join(TimeUnit.SECONDS.toMillis(TIMEOUT_SECONDS));

    assertNull(
        cache.getIfPresent("entity"),
        "the eviction must win over the load that was in flight when it was issued");
  }

  @Test
  void postCommitRefreshDoesNotLetARacingReadRestoreThePreCommitCopy() {
    UUID id = UUID.randomUUID();
    ImmutablePair<String, UUID> key = new ImmutablePair<>(Entity.PIPELINE, id);
    Pipeline softDeleted = pipeline(id, true);
    String softDeletedJson = JsonUtils.pojoToJson(softDeleted);
    CachedEntityDao cachedEntityDao =
        new CachedEntityDao(
            new ReadBeforeFirstDelete(() -> EntityRepository.CACHE_WITH_ID.get(key)),
            new CacheKeys("om-test"),
            new CacheConfig());
    cachedEntityDao.putBase(Entity.PIPELINE, id, softDeletedJson);
    EntityRepository.CACHE_WITH_ID.put(key, softDeletedJson);

    try (MockedStatic<CacheBundle> cacheBundle = mockStatic(CacheBundle.class)) {
      cacheBundle.when(CacheBundle::getCachedEntityDao).thenReturn(cachedEntityDao);
      repository.new EntityUpdater(softDeleted, pipeline(id, false), EntityRepository.Operation.PUT)
          .invalidateCachesAfterStore();
    }

    assertNull(
        EntityRepository.CACHE_WITH_ID.getIfPresent(key),
        "a read racing the refresh must not leave the soft-deleted copy in the cache");
  }

  private static Pipeline pipeline(UUID id, boolean deleted) {
    return new Pipeline()
        .withId(id)
        .withName("pipeline")
        .withFullyQualifiedName("service.pipeline")
        .withUpdatedBy("admin")
        .withDeleted(deleted);
  }
}
