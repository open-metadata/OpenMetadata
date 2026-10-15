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
package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Answers.CALLS_REAL_METHODS;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;

import java.time.Duration;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.events.lifecycle.OrderedLaneTask;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.RequestEntityCache;

class LiveSearchWritesTest {
  private static final Duration WAIT = Duration.ofSeconds(10);
  private static final String HOLD = "holds the lane";

  private final SearchRepository repository = mock(SearchRepository.class);
  private final AtomicLong clock = new AtomicLong(1_000L);
  private final LiveSearchWrites liveWrites = new LiveSearchWrites(repository, clock::get);

  @AfterEach
  void close() {
    SearchRepository.clearSearchWriteDeferred();
    liveWrites.close();
  }

  @Test
  void aWriteIndexesTheEntityAsItWasWhenQueued() throws Exception {
    final AtomicReference<String> indexed = new AtomicReference<>();
    doAnswer(call -> indexDescription(call.getArgument(0), indexed))
        .when(repository)
        .updateEntityIndex(any(EntityInterface.class));
    final Table table = table().withDescription("committed");

    liveWrites.updateEntityIndex(table);
    table.setDescription("masked by the response");

    assertTrue(liveWrites.awaitQueuedWrites(WAIT));
    assertEquals("committed", indexed.get());
  }

  @Test
  void aWriteIsGuardedByWhenItWasQueuedNotWhenItRuns() throws Exception {
    final AtomicReference<Object> readAt = new AtomicReference<>();
    doAnswer(call -> guardedReadAt(call.getArgument(0), readAt))
        .when(repository)
        .updateEntityIndex(any(EntityInterface.class));

    liveWrites.updateEntityIndex(table());
    clock.set(9_000L);

    assertTrue(liveWrites.awaitQueuedWrites(WAIT));
    assertEquals(1_000L, readAt.get());
  }

  @Test
  void writesToOneEntityApplyInTheOrderTheyWereQueued() throws Exception {
    final List<String> applied = Collections.synchronizedList(new ArrayList<>());
    doAnswer(call -> applied.add(((Table) call.getArgument(0)).getDescription()))
        .when(repository)
        .updateEntityIndex(any(EntityInterface.class));
    final Table table = table();
    final List<String> queued = new ArrayList<>();

    for (int write = 0; write < 50; write++) {
      queued.add("write-" + write);
      liveWrites.updateEntityIndex(table.withDescription("write-" + write));
    }

    assertTrue(liveWrites.awaitQueuedWrites(WAIT));
    assertEquals(queued, applied);
  }

  @Test
  void aWriteQueuedInsideATransactionIsQueuedOnlyAfterTheCommit() throws Exception {
    final List<EntityInterface<?>> applied = Collections.synchronizedList(new ArrayList<>());
    doAnswer(call -> applied.add(call.getArgument(0)))
        .when(repository)
        .updateEntityIndex(any(EntityInterface.class));

    assertTrue(SearchRepository.beginSearchWriteDeferral());
    liveWrites.updateEntityIndex(table());
    assertTrue(liveWrites.awaitQueuedWrites(WAIT));
    assertTrue(applied.isEmpty(), "nothing may reach search before the transaction commits");

    SearchRepository.drainSearchWriteDeferred().forEach(SearchRepository.DeferredSearchWrite::run);
    assertTrue(liveWrites.awaitQueuedWrites(WAIT));
    assertEquals(1, applied.size());
  }

  @Test
  void aWriteCommittedInATransactionStaysAheadOfOneQueuedAfterTheCommit() throws Exception {
    final CountDownLatch running = new CountDownLatch(1);
    final CountDownLatch release = new CountDownLatch(1);
    final List<String> applied = Collections.synchronizedList(new ArrayList<>());
    doAnswer(call -> recordAfterHold(call.getArgument(0), running, release, applied))
        .when(repository)
        .updateEntityIndex(any(EntityInterface.class));
    final Table table = table();

    liveWrites.updateEntityIndex(table.withDescription(HOLD));
    assertTrue(running.await(WAIT.toSeconds(), TimeUnit.SECONDS));
    assertTrue(SearchRepository.beginSearchWriteDeferral());
    liveWrites.updateEntityIndex(table.withDescription("committed"));
    DeferredSearchWrites.run(SearchRepository.drainSearchWriteDeferred());
    liveWrites.updateEntityIndex(table.withDescription("after the commit"));
    release.countDown();

    assertTrue(liveWrites.awaitQueuedWrites(WAIT));
    assertEquals(List.of(HOLD, "committed", "after the commit"), applied);
  }

  @Test
  void theBarrierWaitsForEveryWriteQueuedBeforeIt() throws Exception {
    final CountDownLatch running = new CountDownLatch(1);
    final CountDownLatch release = new CountDownLatch(1);
    doAnswer(call -> holdUntil(running, release))
        .when(repository)
        .updateEntityIndex(any(EntityInterface.class));

    liveWrites.updateEntityIndex(table());
    assertTrue(running.await(WAIT.toSeconds(), TimeUnit.SECONDS));
    assertFalse(liveWrites.awaitQueuedWrites(Duration.ofMillis(200)));

    release.countDown();
    assertTrue(liveWrites.awaitQueuedWrites(WAIT));
  }

  @Test
  void aFanOutWaitsForTheWritesQueuedBeforeIt() throws Exception {
    final CountDownLatch running = new CountDownLatch(1);
    final CountDownLatch release = new CountDownLatch(1);
    final List<String> applied = Collections.synchronizedList(new ArrayList<>());
    doAnswer(
            call -> {
              holdUntil(running, release);
              return applied.add("child document");
            })
        .when(repository)
        .updateEntityIndex(any(EntityInterface.class));

    liveWrites.updateEntityIndex(table());
    assertTrue(running.await(WAIT.toSeconds(), TimeUnit.SECONDS));
    liveWrites.applyAfterEarlierWrites(
        UUID.randomUUID(),
        new OrderedLaneTask(() -> applied.add("parent fan-out"), "propagate", null, null, null));

    assertFalse(liveWrites.awaitQueuedWrites(Duration.ofMillis(200)));
    assertTrue(applied.isEmpty(), "the fan-out must wait for the child's earlier write");
    release.countDown();
    assertTrue(liveWrites.awaitQueuedWrites(WAIT));
    assertEquals(List.of("child document", "parent fan-out"), applied);
  }

  @Test
  void aWriteThatReadsTheDatabaseIsStampedWhenItStarts() throws Exception {
    final CountDownLatch running = new CountDownLatch(1);
    final CountDownLatch release = new CountDownLatch(1);
    final AtomicReference<Object> readAt = new AtomicReference<>();
    final Table table = table();
    doAnswer(call -> holdUntil(running, release))
        .when(repository)
        .updateEntityIndex(any(EntityInterface.class));
    doAnswer(call -> guardedReadAt(table, readAt))
        .when(repository)
        .updateEntity(any(EntityReference.class));

    liveWrites.updateEntityIndex(table);
    assertTrue(running.await(WAIT.toSeconds(), TimeUnit.SECONDS));
    liveWrites.updateEntity(referenceTo(table));
    clock.set(9_000L);
    release.countDown();

    assertTrue(liveWrites.awaitQueuedWrites(WAIT));
    assertEquals(
        9_000L, readAt.get(), "a write queued at 1000 that read at 9000 is as new as 9000");
  }

  @Test
  void aFanOutInsideATransactionIsQueuedOnlyAfterTheCommit() throws Exception {
    final List<String> applied = Collections.synchronizedList(new ArrayList<>());

    assertTrue(SearchRepository.beginSearchWriteDeferral());
    liveWrites.fanOut(
        new OrderedLaneTask(() -> applied.add("children"), "propagate", null, null, null));
    assertTrue(liveWrites.awaitQueuedWrites(WAIT));
    assertTrue(applied.isEmpty(), "nothing may reach search before the transaction commits");

    SearchRepository.drainSearchWriteDeferred().forEach(SearchRepository.DeferredSearchWrite::run);
    assertTrue(liveWrites.awaitQueuedWrites(WAIT));
    assertEquals(List.of("children"), applied);
  }

  @Test
  void aFanOutRunsWithTheFanOutFlagSet() throws Exception {
    final List<Boolean> applyingFanOut = Collections.synchronizedList(new ArrayList<>());

    liveWrites.fanOut(
        new OrderedLaneTask(
            () -> applyingFanOut.add(liveWrites.isApplyingFanOut()),
            "propagate",
            null,
            null,
            null));

    assertTrue(liveWrites.awaitQueuedWrites(WAIT));
    assertEquals(List.of(true), applyingFanOut);
    assertFalse(liveWrites.isApplyingFanOut());
  }

  @Test
  void aQueuedWriteDoesNotReadWhatAnEarlierOneCachedOnItsThread() throws Exception {
    final Table table = table();
    final Fields fields = new Fields(Set.of("description"));
    final RelationIncludes includes = RelationIncludes.fromInclude(Include.NON_DELETED);
    final AtomicReference<Table> cached = new AtomicReference<>();

    liveWrites.queueWrite(
        table,
        "readsAndCaches",
        snapshot ->
            RequestEntityCache.putById(
                "table", table.getId(), fields, includes, true, (Table) snapshot, Table.class));
    liveWrites.queueWrite(
        table,
        "readsAgain",
        snapshot ->
            cached.set(
                RequestEntityCache.getById(
                    "table", table.getId(), fields, includes, true, Table.class)));

    assertTrue(liveWrites.awaitQueuedWrites(WAIT));
    assertNull(cached.get(), "each queued write must read the database, not a cached entity");
  }

  @Test
  void aFailedWriteIsRetriedFromTheDatabaseByItsEntity() {
    final UUID id = UUID.randomUUID();
    final OrderedLaneTask write =
        new OrderedLaneTask(() -> {}, "updateEntityIndex", id.toString(), "svc.db.s.t", "table");
    final IllegalStateException failure = new IllegalStateException("search unavailable");

    try (MockedStatic<SearchIndexRetryQueue> retries =
        mockStatic(SearchIndexRetryQueue.class, CALLS_REAL_METHODS)) {
      retries
          .when(() -> SearchIndexRetryQueue.enqueue(anyString(), anyString(), anyString(), any()))
          .thenAnswer(call -> null);

      LiveSearchWrites.retryLater(write, failure);

      retries.verify(
          () ->
              SearchIndexRetryQueue.enqueue(
                  eq(id.toString()), eq("svc.db.s.t"), eq("table"), anyString()));
    }
  }

  private static EntityReference referenceTo(final Table table) {
    return new EntityReference()
        .withId(table.getId())
        .withType("table")
        .withFullyQualifiedName(table.getFullyQualifiedName());
  }

  private static Table table() {
    return new Table()
        .withId(UUID.randomUUID())
        .withName("orders")
        .withFullyQualifiedName("svc.db.sales.orders");
  }

  private static Object indexDescription(
      final EntityInterface<?> entity, final AtomicReference<String> indexed) {
    indexed.set(entity.getDescription());
    return null;
  }

  private static Object guardedReadAt(
      final EntityInterface<?> entity, final AtomicReference<Object> readAt) {
    final SearchDocumentUpdate guarded =
        SearchVersionGuard.apply(new SearchDocumentUpdate("ctx._source.x = 1", Map.of()), entity);
    readAt.set(guarded.parameters().get(SearchVersionGuard.SOURCE_READ_AT));
    return null;
  }

  private static Object recordAfterHold(
      final Table written,
      final CountDownLatch running,
      final CountDownLatch release,
      final List<String> applied)
      throws InterruptedException {
    if (HOLD.equals(written.getDescription())) {
      holdUntil(running, release);
    }
    applied.add(written.getDescription());
    return null;
  }

  private static Object holdUntil(final CountDownLatch running, final CountDownLatch release)
      throws InterruptedException {
    running.countDown();
    release.await();
    return null;
  }
}
