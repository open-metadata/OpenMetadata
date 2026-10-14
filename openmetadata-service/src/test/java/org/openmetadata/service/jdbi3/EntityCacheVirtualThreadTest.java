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
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.locks.LockSupport;
import org.apache.commons.lang3.tuple.ImmutablePair;
import org.apache.commons.lang3.tuple.Pair;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.cache.CacheBundle;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.VirtualThreadPinning;
import org.openmetadata.service.util.VirtualThreadPinning.Outcome;

/**
 * An entity-cache miss reads Redis and the database. Read from a virtual thread, that read must not
 * pin the thread to its carrier: four pinned misses on a four-CPU CI runner stopped the server's
 * virtual-thread scheduler and hung the integration-test lane.
 */
class EntityCacheVirtualThreadTest {

  private static final Duration WAIT = Duration.ofSeconds(10);
  private static final Duration DATABASE_LATENCY = Duration.ofMillis(50);
  private static final int CALLERS = 8;

  private final Pipeline pipeline =
      new Pipeline()
          .withId(UUID.randomUUID())
          .withName("orders")
          .withFullyQualifiedName("service.orders")
          .withDeleted(false);
  private final Pair<String, UUID> idKey = new ImmutablePair<>(Entity.PIPELINE, pipeline.getId());

  private CollectionDAO.PipelineDAO pipelineDAO;
  private MockedStatic<CacheBundle> cacheBundle;

  @BeforeEach
  void setUp() {
    pipelineDAO = mock(CollectionDAO.PipelineDAO.class);
    Entity.setCollectionDAO(mock(CollectionDAO.class));
    new StubPipelineRepository(pipelineDAO);
    cacheBundle = mockStatic(CacheBundle.class);
    EntityRepository.CACHE_WITH_ID.invalidate(idKey);
  }

  @AfterEach
  void tearDown() {
    EntityRepository.CACHE_WITH_ID.invalidate(idKey);
    cacheBundle.close();
    Entity.setCollectionDAO(null);
  }

  @Test
  void aMissReadOnAVirtualThreadDoesNotPinIt(@TempDir Path recordingDir) throws Exception {
    databaseAnswersSlowly();

    Outcome<String> outcome =
        VirtualThreadPinning.runRecordingPins(
            recordingDir, "entity-cache-miss", () -> EntityRepository.loadById(idKey));

    assertNull(outcome.failure(), "the miss should load the entity");
    assertEquals(pipeline.getId(), JsonUtils.readValue(outcome.result(), Pipeline.class).getId());
    assertTrue(
        outcome.pinnedStacks().isEmpty(),
        "the cache miss pinned the virtual thread:%n%s"
            .formatted(String.join("\n\n", outcome.pinnedStacks())));
    assertEquals(outcome.result(), EntityRepository.CACHE_WITH_ID.getIfPresent(idKey));
  }

  // Guards the test above against passing vacuously: the Guava load it replaced does pin.
  @Test
  void theGuavaLoadingCacheGetItReplacesPinsTheVirtualThread(@TempDir Path recordingDir)
      throws Exception {
    databaseAnswersSlowly();

    Outcome<String> outcome =
        VirtualThreadPinning.runRecordingPins(
            recordingDir, "guava-cache-miss", () -> EntityRepository.CACHE_WITH_ID.get(idKey));

    assertNull(outcome.failure());
    assertFalse(outcome.pinnedStacks().isEmpty(), "JFR should report the Guava load pinning");
  }

  @Test
  void concurrentMissesReadTheDatabaseOnce() throws Exception {
    CountDownLatch release = new CountDownLatch(1);
    when(pipelineDAO.findById(any(), eq(pipeline.getId()), any()))
        .thenAnswer(
            invocation -> {
              release.await();
              return committedJson();
            });

    List<Thread> callers = new ArrayList<>();
    for (int i = 0; i < CALLERS; i++) {
      callers.add(Thread.ofVirtual().start(this::loadQuietly));
    }
    await()
        .atMost(WAIT)
        .until(
            () -> callers.stream().allMatch(caller -> caller.getState() == Thread.State.WAITING));
    release.countDown();
    for (Thread caller : callers) {
      caller.join(WAIT);
    }

    verify(pipelineDAO, times(1)).findById(any(), eq(pipeline.getId()), any());
  }

  @Test
  void aWriteDuringTheLoadSendsTheCallerToTheBypassReadAndCachesNothing() {
    when(pipelineDAO.findById(any(), eq(pipeline.getId()), any()))
        .thenAnswer(
            invocation -> {
              EntityRepository.invalidateCacheForEntity(
                  Entity.PIPELINE, pipeline.getId(), pipeline.getFullyQualifiedName());
              return committedJson();
            });

    ExecutionException thrown =
        assertThrows(ExecutionException.class, () -> EntityRepository.loadById(idKey));

    assertInstanceOf(EntityRepository.LoaderRaceException.class, thrown.getCause());
    assertNull(EntityRepository.CACHE_WITH_ID.getIfPresent(idKey));
  }

  @Test
  void aWriteBetweenTheLoadAndTheStoreEvictsWhatWasStored() {
    assertThrows(
        EntityRepository.LoaderRaceException.class,
        () ->
            EntityRepository.storeUnlessWritten(
                EntityRepository.CACHE_WITH_ID, idKey, committedJson(), () -> true));

    assertNull(EntityRepository.CACHE_WITH_ID.getIfPresent(idKey));
  }

  @Test
  void withNoWriteTheStoreKeepsTheLoadedEntity() {
    String json = committedJson();

    String stored =
        EntityRepository.storeUnlessWritten(
            EntityRepository.CACHE_WITH_ID, idKey, json, () -> false);

    assertEquals(json, stored);
    assertEquals(json, EntityRepository.CACHE_WITH_ID.getIfPresent(idKey));
  }

  @Test
  void aFailedLoadDoesNotStopTheNextMissFromLoading() throws Exception {
    when(pipelineDAO.findById(any(), eq(pipeline.getId()), any()))
        .thenThrow(new IllegalStateException("db down"))
        .thenReturn(committedJson());

    assertThrows(ExecutionException.class, () -> EntityRepository.loadById(idKey));

    assertEquals(committedJson(), EntityRepository.loadById(idKey));
  }

  private void databaseAnswersSlowly() {
    when(pipelineDAO.findById(any(), eq(pipeline.getId()), any()))
        .thenAnswer(
            invocation -> {
              LockSupport.parkNanos(DATABASE_LATENCY.toNanos());
              return committedJson();
            });
  }

  private void loadQuietly() {
    try {
      EntityRepository.loadById(idKey);
    } catch (ExecutionException e) {
      throw new IllegalStateException(e);
    }
  }

  private String committedJson() {
    return JsonUtils.pojoToJson(pipeline);
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
}
