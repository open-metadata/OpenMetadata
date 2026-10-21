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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import com.google.common.cache.CacheLoader;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.FutureTask;
import java.util.concurrent.TimeUnit;
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

  private final UUID id = UUID.randomUUID();
  private final Pair<String, UUID> key = new ImmutablePair<>(Entity.PIPELINE, id);
  private final Pipeline softDeleted = pipeline(true);
  private final String softDeletedJson = JsonUtils.pojoToJson(softDeleted);
  private final Pair<String, String> nameKey =
      EntityRepository.cacheNameKey(Entity.PIPELINE, softDeleted.getFullyQualifiedName());
  private final ReadBeforeFirstDelete redis = new ReadBeforeFirstDelete();
  private final CachedEntityDao cachedEntityDao =
      new CachedEntityDao(redis, new CacheKeys("om-test"), new CacheConfig());
  private PipelineRepository repository;
  private MockedStatic<CacheBundle> cacheBundle;

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
    private Runnable read = () -> {};
    private boolean readDone;

    void beforeFirstDelete(Runnable read) {
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

  /**
   * A cache miss on its own thread, loading the way {@code find} does. It fetches the Redis copy as
   * soon as it starts, but puts it into L1 only once the racing write has returned.
   */
  private final class SlowMiss {
    private final CountDownLatch fetched = new CountDownLatch(1);
    private final CountDownLatch writeReturned = new CountDownLatch(1);
    private final FutureTask<String> load =
        new FutureTask<>(
            () ->
                EntityRepository.loadOutsideCacheLock(
                    EntityRepository.CACHE_WITH_ID,
                    key,
                    new CacheLoader<>() {
                      @Override
                      public String load(Pair<String, UUID> ignored) throws InterruptedException {
                        String json = cachedEntityDao.getBase(id, Entity.PIPELINE).orElseThrow();
                        fetched.countDown();
                        writeReturned.await(TIMEOUT_SECONDS, TimeUnit.SECONDS);
                        return json;
                      }
                    },
                    k -> EntityRepository.readEpochById(k.getLeft(), k.getRight())));

    void startAndAwaitFetch() {
      new Thread(load).start();
      try {
        assertTrue(fetched.await(TIMEOUT_SECONDS, TimeUnit.SECONDS));
      } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
        throw new IllegalStateException(e);
      }
    }

    /** Lets the miss put what it fetched, and returns why {@code loadOutsideCacheLock} failed. */
    Throwable finishAfterWrite() {
      writeReturned.countDown();
      ExecutionException taskFailure =
          assertThrows(ExecutionException.class, () -> load.get(TIMEOUT_SECONDS, TimeUnit.SECONDS));
      return taskFailure.getCause().getCause();
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
    cacheBundle = mockStatic(CacheBundle.class);
    cacheBundle.when(CacheBundle::getCachedEntityDao).thenReturn(cachedEntityDao);
    EntityRepository.clearCacheInvalidations();
    cachedEntityDao.putBase(Entity.PIPELINE, id, softDeletedJson);
    cachedEntityDao.putByName(Entity.PIPELINE, nameKey.getRight(), softDeletedJson);
  }

  @AfterEach
  void tearDown() {
    EntityRepository.clearCacheInvalidations();
    EntityRepository.CACHE_WITH_ID.invalidate(key);
    EntityRepository.CACHE_WITH_NAME.invalidate(nameKey);
    cacheBundle.close();
    Entity.setCollectionDAO(null);
  }

  @Test
  void postCommitRefreshDoesNotLetARacingReadRestoreThePreCommitCopy() {
    redis.beforeFirstDelete(
        () -> {
          assertEquals(softDeletedJson, EntityRepository.CACHE_WITH_ID.getUnchecked(key));
          assertEquals(softDeletedJson, EntityRepository.CACHE_WITH_NAME.getUnchecked(nameKey));
        });
    EntityRepository.CACHE_WITH_ID.put(key, softDeletedJson);
    EntityRepository.CACHE_WITH_NAME.put(nameKey, softDeletedJson);

    refreshAfterRestore();

    assertNull(
        EntityRepository.CACHE_WITH_ID.getIfPresent(key),
        "a read racing the refresh must not leave the soft-deleted copy in the cache");
    assertNull(EntityRepository.CACHE_WITH_NAME.getIfPresent(nameKey));
    assertTrue(cachedEntityDao.getBase(id, Entity.PIPELINE).isEmpty());
    assertTrue(cachedEntityDao.getByName(Entity.PIPELINE, nameKey.getRight()).isEmpty());
  }

  @Test
  void aMissThatFetchedThePreCommitCopyBeforeTheRefreshCannotCacheItAfterward() {
    SlowMiss miss = new SlowMiss();
    redis.beforeFirstDelete(miss::startAndAwaitFetch);

    refreshAfterRestore();

    assertInstanceOf(EntityRepository.LoaderRaceException.class, miss.finishAfterWrite());
    assertNull(
        EntityRepository.CACHE_WITH_ID.getIfPresent(key),
        "the miss must not leave the soft-deleted copy in L1 after the refresh returned");
  }

  @Test
  void aMissThatFetchedThePreCommitCopyBeforeTheDrainCannotCacheItAfterward() {
    SlowMiss miss = new SlowMiss();
    EntityRepository.beginCacheInvalidationDeferral();
    repository.invalidate(softDeleted);
    redis.beforeFirstDelete(miss::startAndAwaitFetch);

    EntityRepository.drainCacheInvalidations();

    assertInstanceOf(EntityRepository.LoaderRaceException.class, miss.finishAfterWrite());
    assertNull(
        EntityRepository.CACHE_WITH_ID.getIfPresent(key),
        "the miss must not leave the soft-deleted copy in L1 after the drain returned");
  }

  private void refreshAfterRestore() {
    repository.new EntityUpdater(softDeleted, pipeline(false), EntityRepository.Operation.PUT)
        .invalidateCachesAfterStore();
  }

  private Pipeline pipeline(boolean deleted) {
    return new Pipeline()
        .withId(id)
        .withName("pipeline")
        .withFullyQualifiedName("service.pipeline")
        .withUpdatedBy("admin")
        .withDeleted(deleted);
  }
}
