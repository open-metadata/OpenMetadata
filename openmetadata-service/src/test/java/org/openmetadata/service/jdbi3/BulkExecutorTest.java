/*
 *  Copyright 2021 Collate
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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Future;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import lombok.extern.slf4j.Slf4j;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.config.BulkOperationConfiguration;

@Slf4j
class BulkExecutorTest {

  @BeforeEach
  void setUp() {
    BulkExecutor.reset();
  }

  @AfterEach
  void tearDown() {
    BulkExecutor.reset();
  }

  @Test
  void testDefaultInitialization() {
    BulkExecutor executor = BulkExecutor.getInstance();
    assertNotNull(executor);
    assertEquals(10, executor.getMaxThreads());
    assertEquals(1000, executor.getQueueSize());
    assertEquals(300, executor.getTimeoutSeconds());
  }

  @Test
  void testCustomInitialization() {
    BulkOperationConfiguration config = new BulkOperationConfiguration();
    config.setMaxThreads(5);
    config.setQueueSize(500);
    config.setTimeoutSeconds(120);

    BulkExecutor.initialize(config);
    BulkExecutor executor = BulkExecutor.getInstance();

    assertEquals(5, executor.getMaxThreads());
    assertEquals(500, executor.getQueueSize());
    assertEquals(120, executor.getTimeoutSeconds());
  }

  @Test
  void testConcurrencyLimit() throws InterruptedException {
    BulkOperationConfiguration config = new BulkOperationConfiguration();
    config.setMaxThreads(3);
    config.setQueueSize(100);

    BulkExecutor.initialize(config);
    BulkExecutor executor = BulkExecutor.getInstance();

    AtomicInteger maxConcurrent = new AtomicInteger(0);
    AtomicInteger currentConcurrent = new AtomicInteger(0);
    AtomicInteger completed = new AtomicInteger(0);
    CountDownLatch allDone = new CountDownLatch(10);

    for (int i = 0; i < 10; i++) {
      executor.submit(
          () -> {
            try {
              int current = currentConcurrent.incrementAndGet();
              maxConcurrent.updateAndGet(max -> Math.max(max, current));
              Thread.sleep(50); // Simulate work
              currentConcurrent.decrementAndGet();
              completed.incrementAndGet();
            } catch (InterruptedException e) {
              Thread.currentThread().interrupt();
            } finally {
              allDone.countDown();
            }
          });
    }

    assertTrue(allDone.await(10, TimeUnit.SECONDS), "All tasks should complete");
    assertEquals(10, completed.get(), "All 10 tasks should complete");
    assertTrue(
        maxConcurrent.get() <= 3,
        "Max concurrent should not exceed 3, got: " + maxConcurrent.get());

    LOG.info(
        "Concurrency test: maxConcurrent={}, completed={}", maxConcurrent.get(), completed.get());
  }

  @Test
  void testQueueCapacity() throws InterruptedException {
    BulkOperationConfiguration config = new BulkOperationConfiguration();
    config.setMaxThreads(1);
    config.setQueueSize(5);

    BulkExecutor.initialize(config);
    BulkExecutor executor = BulkExecutor.getInstance();

    CountDownLatch blocker = new CountDownLatch(1);

    // Submit a blocking task
    executor.submit(
        () -> {
          try {
            blocker.await();
          } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
          }
        });

    // Fill the queue (5 tasks)
    for (int i = 0; i < 5; i++) {
      executor.submit(() -> {});
    }

    // Next submission should be rejected (queue full)
    assertThrows(
        RejectedExecutionException.class,
        () -> executor.submit(() -> {}),
        "Should reject when queue is full");

    // Release blocker
    blocker.countDown();

    LOG.info("Queue capacity test passed");
  }

  @Test
  void testHasCapacity() throws InterruptedException {
    BulkOperationConfiguration config = new BulkOperationConfiguration();
    config.setMaxThreads(1);
    config.setQueueSize(2);

    BulkExecutor.initialize(config);
    BulkExecutor executor = BulkExecutor.getInstance();

    assertTrue(executor.hasCapacity(), "Should have capacity initially");

    CountDownLatch blocker = new CountDownLatch(1);

    // Block the single thread
    executor.submit(
        () -> {
          try {
            blocker.await();
          } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
          }
        });

    // Fill queue
    executor.submit(() -> {});
    executor.submit(() -> {});

    assertFalse(executor.hasCapacity(), "Should not have capacity when queue is full");

    blocker.countDown();

    // Wait for queue to drain
    Awaitility.await().atMost(5, TimeUnit.SECONDS).until(executor::hasCapacity);

    assertTrue(executor.hasCapacity(), "Should have capacity after tasks complete");
  }

  @Test
  void testHasCapacityForBatch() {
    BulkOperationConfiguration config = new BulkOperationConfiguration();
    config.setMaxThreads(2);
    config.setQueueSize(10);

    BulkExecutor.initialize(config);
    BulkExecutor executor = BulkExecutor.getInstance();

    assertTrue(executor.hasCapacityForBatch(5), "Should have capacity for batch of 5");
    assertTrue(executor.hasCapacityForBatch(10), "Should have capacity for batch of 10");
    assertFalse(executor.hasCapacityForBatch(11), "Should not have capacity for batch of 11");
  }

  @Test
  void testActiveCountAndQueueDepth() throws InterruptedException {
    BulkOperationConfiguration config = new BulkOperationConfiguration();
    config.setMaxThreads(2);
    config.setQueueSize(100);

    BulkExecutor.initialize(config);
    BulkExecutor executor = BulkExecutor.getInstance();

    assertEquals(0, executor.getActiveCount(), "Initially no active threads");
    assertEquals(0, executor.getQueueDepth(), "Initially empty queue");

    CountDownLatch blocker = new CountDownLatch(1);
    CountDownLatch tasksStarted = new CountDownLatch(2);

    // Submit blocking tasks
    for (int i = 0; i < 2; i++) {
      executor.submit(
          () -> {
            tasksStarted.countDown();
            try {
              blocker.await();
            } catch (InterruptedException e) {
              Thread.currentThread().interrupt();
            }
          });
    }

    // Wait for tasks to start
    tasksStarted.await(5, TimeUnit.SECONDS);

    // Wait for threads to fully activate
    Awaitility.await().atMost(5, TimeUnit.SECONDS).until(() -> executor.getActiveCount() == 2);

    assertEquals(2, executor.getActiveCount(), "Should have 2 active threads");

    // Submit more tasks to queue
    executor.submit(() -> {});
    executor.submit(() -> {});
    executor.submit(() -> {});

    assertEquals(3, executor.getQueueDepth(), "Should have 3 queued tasks");

    blocker.countDown();

    // Wait for completion
    Awaitility.await()
        .atMost(5, TimeUnit.SECONDS)
        .until(() -> executor.getActiveCount() == 0 && executor.getQueueDepth() == 0);

    assertEquals(0, executor.getActiveCount(), "Should have no active threads after completion");
    assertEquals(0, executor.getQueueDepth(), "Should have empty queue after completion");
  }

  @Test
  void testSingletonBehavior() {
    BulkOperationConfiguration config = new BulkOperationConfiguration();
    config.setMaxThreads(5);

    BulkExecutor.initialize(config);

    BulkExecutor instance1 = BulkExecutor.getInstance();
    BulkExecutor instance2 = BulkExecutor.getInstance();

    assertSame(instance1, instance2, "Should return same singleton instance");
  }

  @Test
  void testIsShutdown() {
    BulkOperationConfiguration config = new BulkOperationConfiguration();
    config.setMaxThreads(2);
    config.setTimeoutSeconds(5);

    BulkExecutor.initialize(config);
    BulkExecutor executor = BulkExecutor.getInstance();

    assertFalse(executor.isShutdown(), "Should not be shutdown initially");

    executor.shutdown();

    assertTrue(executor.isShutdown(), "Should be shutdown after shutdown() called");
  }

  @Test
  void testSubmitRejectsAfterShutdown() {
    BulkOperationConfiguration config = new BulkOperationConfiguration();
    config.setMaxThreads(2);
    config.setTimeoutSeconds(5);

    BulkExecutor.initialize(config);
    BulkExecutor executor = BulkExecutor.getInstance();

    executor.shutdown();

    assertThrows(
        RejectedExecutionException.class,
        () -> executor.submit(() -> {}),
        "Should reject submit after shutdown");
  }

  @Test
  void testSubmitWithFuture() throws Exception {
    BulkOperationConfiguration config = new BulkOperationConfiguration();
    config.setMaxThreads(2);

    BulkExecutor.initialize(config);
    BulkExecutor executor = BulkExecutor.getInstance();

    AtomicBoolean taskExecuted = new AtomicBoolean(false);

    Future<?> future =
        executor.submitWithFuture(
            () -> {
              taskExecuted.set(true);
            });

    assertNotNull(future, "Should return a Future");
    future.get(5, TimeUnit.SECONDS);

    assertTrue(taskExecuted.get(), "Task should have executed");
    assertTrue(future.isDone(), "Future should be done");
  }

  @Test
  void testGetStats() {
    BulkOperationConfiguration config = new BulkOperationConfiguration();
    config.setMaxThreads(5);

    BulkExecutor.initialize(config);
    BulkExecutor executor = BulkExecutor.getInstance();

    String stats = executor.getStats();
    assertNotNull(stats);
    assertTrue(stats.contains("threads=5"));
  }
}
