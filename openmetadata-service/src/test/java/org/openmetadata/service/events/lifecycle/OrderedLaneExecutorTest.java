/*
 *  Copyright 2024 Collate
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

package org.openmetadata.service.events.lifecycle;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.events.lifecycle.OrderedLaneExecutor.OrderedTask;

/**
 * Unit coverage for the ordered-lane async substrate: per-entity FIFO ordering (the lane-FIFO
 * regression guard), backpressure with no rejection/OOM under burst, durable failure routing, and
 * graceful shutdown draining. These need no running application.
 */
class OrderedLaneExecutorTest {

  private static List<Integer> sequence(int count) {
    List<Integer> expected = new ArrayList<>(count);
    for (int i = 0; i < count; i++) {
      expected.add(i);
    }
    return expected;
  }

  @Test
  void sameEntityTasksRunInSubmissionOrder() throws InterruptedException {
    try (OrderedLaneExecutor executor = new OrderedLaneExecutor((task, failure) -> {})) {
      UUID entityId = UUID.randomUUID();
      int taskCount = 500;
      List<Integer> executionOrder = new ArrayList<>();
      CountDownLatch done = new CountDownLatch(taskCount);

      for (int i = 0; i < taskCount; i++) {
        int seq = i;
        executor.submit(
            entityId,
            () -> {
              synchronized (executionOrder) {
                executionOrder.add(seq);
              }
              done.countDown();
            });
      }

      assertTrue(done.await(30, TimeUnit.SECONDS));
      assertEquals(
          sequence(taskCount), executionOrder, "Same-entity tasks must apply in submission order");
    }
  }

  @Test
  void distinctEntitiesUseDistinctLanes() {
    try (OrderedLaneExecutor executor = new OrderedLaneExecutor((task, failure) -> {})) {
      Set<Integer> lanes = new HashSet<>();
      for (int i = 0; i < executor.getLaneCount() * 4; i++) {
        lanes.add(executor.laneFor(UUID.randomUUID()));
      }
      assertTrue(lanes.size() > 1, "Distinct entities should spread across more than one lane");
    }
  }

  @Test
  void burstWithinLaneCapacityRunsAllInOrderWithNoRejection() throws InterruptedException {
    try (OrderedLaneExecutor executor = new OrderedLaneExecutor((task, failure) -> {})) {
      UUID entityId = UUID.randomUUID();
      int burst = 1500;
      ConcurrentLinkedQueue<Integer> order = new ConcurrentLinkedQueue<>();
      CountDownLatch done = new CountDownLatch(burst);
      AtomicInteger rejections = new AtomicInteger();

      for (int i = 0; i < burst; i++) {
        int seq = i;
        try {
          executor.submit(
              entityId,
              () -> {
                order.add(seq);
                done.countDown();
              });
        } catch (RuntimeException rejected) {
          rejections.incrementAndGet();
        }
      }

      assertTrue(done.await(60, TimeUnit.SECONDS));
      assertEquals(0, rejections.get(), "Submit must never throw onto the request thread");
      assertEquals(burst, order.size(), "Every task within capacity must run");
      assertEquals(
          sequence(burst),
          new ArrayList<>(order),
          "Same-entity ordering must hold within capacity");
    }
  }

  @Test
  void overflowShedsLocatorTasksToOutboxWithoutBlockingTheRequestThread()
      throws InterruptedException {
    ConcurrentLinkedQueue<String> shed = new ConcurrentLinkedQueue<>();
    int capacity = 4;
    try (OrderedLaneExecutor executor =
        new OrderedLaneExecutor(
            (task, failure) -> {
              if (task instanceof OrderedLaneTask locator) {
                shed.add(locator.operation());
              }
            },
            capacity,
            5L)) {
      UUID entityId = UUID.randomUUID();
      CountDownLatch release = new CountDownLatch(1);
      CountDownLatch firstStarted = new CountDownLatch(1);

      // Block the single lane consumer so nothing drains while we overflow the bounded queue.
      executor.submit(
          entityId,
          () -> {
            firstStarted.countDown();
            release.await();
          });
      assertTrue(firstStarted.await(10, TimeUnit.SECONDS));

      // The request thread must NEVER block here even though the queue saturates: overflow sheds.
      int overflow = capacity + 50;
      long startNanos = System.nanoTime();
      for (int i = 0; i < overflow; i++) {
        executor.submit(
            entityId,
            new OrderedLaneTask(() -> {}, "shed-" + i, entityId.toString(), "svc.db.t", "table"));
      }
      long elapsedMillis = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startNanos);

      assertTrue(
          elapsedMillis < 4000,
          "Submitting past lane capacity must not block the request thread (took "
              + elapsedMillis
              + "ms)");
      Awaitility.await()
          .atMost(Duration.ofSeconds(10))
          .untilAsserted(
              () -> assertTrue(shed.size() >= overflow - capacity, "Overflow must shed to outbox"));
      release.countDown();
    }
  }

  @Test
  void taskFailureRoutesToFailureHandlerAndLaneSurvives() throws InterruptedException {
    ConcurrentHashMap<String, Throwable> failures = new ConcurrentHashMap<>();
    try (OrderedLaneExecutor executor =
        new OrderedLaneExecutor(
            (task, failure) -> {
              if (task instanceof OrderedLaneTask locator) {
                failures.put(locator.operation(), failure);
              }
            })) {
      UUID entityId = UUID.randomUUID();
      CountDownLatch nextRan = new CountDownLatch(1);

      executor.submit(
          entityId,
          new OrderedLaneTask(
              () -> {
                throw new IllegalStateException("boom");
              },
              "failing-op",
              entityId.toString(),
              "svc.db.t",
              "table"));
      executor.submit(entityId, nextRan::countDown);

      assertTrue(nextRan.await(30, TimeUnit.SECONDS), "Lane must survive a failed task");
      Awaitility.await()
          .atMost(Duration.ofSeconds(10))
          .untilAsserted(() -> assertTrue(failures.containsKey("failing-op")));
    }
  }

  @Test
  void closeDrainsInflightAndQueuedWhenWithinTimeout() throws InterruptedException {
    AtomicInteger completed = new AtomicInteger();
    try (OrderedLaneExecutor executor = new OrderedLaneExecutor((task, failure) -> {})) {
      UUID entityId = UUID.randomUUID();
      CountDownLatch firstStarted = new CountDownLatch(1);
      CountDownLatch release = new CountDownLatch(1);

      executor.submit(
          entityId,
          () -> {
            firstStarted.countDown();
            release.await();
            completed.incrementAndGet();
          });
      for (int i = 0; i < 5; i++) {
        executor.submit(entityId, completed::incrementAndGet);
      }

      assertTrue(firstStarted.await(10, TimeUnit.SECONDS));
      release.countDown();
      executor.close();
    }
    assertEquals(6, completed.get(), "In-flight + queued work must drain on a clean close");
  }

  @Test
  void closeFlushesQueuedTasksToOutboxWhenDrainTimesOut() throws InterruptedException {
    ConcurrentLinkedQueue<String> flushed = new ConcurrentLinkedQueue<>();
    UUID entityId = UUID.randomUUID();
    CountDownLatch firstStarted = new CountDownLatch(1);
    CountDownLatch neverReleased = new CountDownLatch(1);

    OrderedLaneExecutor executor =
        new OrderedLaneExecutor(
            (task, failure) -> {
              if (task instanceof OrderedLaneTask locator) {
                flushed.add(locator.operation());
              }
            },
            2000,
            1L);
    try {
      // Pin the lane consumer past the (short) shutdown timeout so queued tasks cannot drain and
      // are forcibly dropped by shutdownNow(), exercising flushDroppedToOutbox.
      executor.submit(
          entityId,
          () -> {
            firstStarted.countDown();
            neverReleased.await(10, TimeUnit.SECONDS);
          });
      assertTrue(firstStarted.await(10, TimeUnit.SECONDS));
      for (int i = 0; i < 5; i++) {
        executor.submit(
            entityId,
            new OrderedLaneTask(
                () -> {}, "dropped-" + i, entityId.toString(), "svc.db.t", "table"));
      }
      executor.close();
    } finally {
      neverReleased.countDown();
    }
    assertEquals(5, flushed.size(), "Tasks dropped on hard-stop must be flushed to the outbox");
  }

  @Test
  void nullEntityKeyRunsInline() {
    AtomicInteger ran = new AtomicInteger();
    try (OrderedLaneExecutor executor = new OrderedLaneExecutor((task, failure) -> {})) {
      executor.submit(null, ran::incrementAndGet);
    }
    assertEquals(1, ran.get(), "A null lane key must run the task inline, never drop it");
  }

  @Test
  void failureHandlerExceptionDoesNotKillLane() throws InterruptedException {
    try (OrderedLaneExecutor executor =
        new OrderedLaneExecutor(
            (task, failure) -> {
              throw new RuntimeException("handler also throws");
            })) {
      UUID entityId = UUID.randomUUID();
      CountDownLatch nextRan = new CountDownLatch(1);
      OrderedTask throwing =
          () -> {
            throw new IllegalStateException("boom");
          };
      executor.submit(entityId, throwing);
      executor.submit(entityId, nextRan::countDown);
      assertTrue(
          nextRan.await(30, TimeUnit.SECONDS), "Lane must survive a throwing failure handler");
    }
  }
}
