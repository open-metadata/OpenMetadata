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

import static org.junit.jupiter.api.Assertions.*;

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
    // Default pool size 20, 20% = 4 connections, threads capped at min(10, 4) = 4
    assertEquals(4, executor.getMaxThreads());
    assertEquals(4, executor.getConnectionLimit());
    assertEquals(1000, executor.getQueueSize());
    assertEquals(300, executor.getTimeoutSeconds());
  }

  @Test
  void testCustomInitialization() {
    BulkOperationConfiguration config = new BulkOperationConfiguration();
    config.setMaxThreads(5);
    config.setQueueSize(500);
    config.setTimeoutSeconds(120);

    BulkExecutor.initialize(config, 50); // 50 pool, 20% = 10, threads = min(5, 10) = 5
    BulkExecutor executor = BulkExecutor.getInstance();

    assertEquals(5, executor.getMaxThreads());
    assertEquals(10, executor.getConnectionLimit());
    assertEquals(500, executor.getQueueSize());
    assertEquals(120, executor.getTimeoutSeconds());
  }

  @Test
  void testConnectionLimitCalculation_PoolPercentWins() {
    BulkOperationConfiguration config = new BulkOperationConfiguration();
    // Defaults: poolPercent=20, minConnections=2, maxConnectionsLimit=20

    // Normal cases: poolPercent calculation wins
    assertEquals(3, config.calculateConnectionLimit(15)); // 15 * 20% = 3
    assertEquals(10, config.calculateConnectionLimit(50)); // 50 * 20% = 10
    assertEquals(20, config.calculateConnectionLimit(100)); // 100 * 20% = 20 (at ceiling)
  }

  @Test
  void testConnectionLimitCalculation_CeilingWins() {
    BulkOperationConfiguration config = new BulkOperationConfiguration();
    // Defaults: poolPercent=20, maxConnectionsLimit=20

    // Large pools: ceiling wins (prevents DB contention)
    assertEquals(20, config.calculateConnectionLimit(150)); // 150 * 20% = 30, capped to 20
    assertEquals(20, config.calculateConnectionLimit(200)); // 200 * 20% = 40, capped to 20
    assertEquals(20, config.calculateConnectionLimit(500)); // 500 * 20% = 100, capped to 20
  }

  @Test
  void testConnectionLimitCalculation_FloorWins() {
    BulkOperationConfiguration config = new BulkOperationConfiguration();
    // Defaults: poolPercent=20, minConnections=2

    // Tiny pools: floor wins (ensures bulk can work)
    assertEquals(2, config.calculateConnectionLimit(5)); // 5 * 20% = 1, floored to 2
    assertEquals(2, config.calculateConnectionLimit(8)); // 8 * 20% = 1.6 → 1, floored to 2
    assertEquals(2, config.calculateConnectionLimit(10)); // 10 * 20% = 2, equals floor
  }

  @Test
  void testConnectionLimitCalculation_CustomPercent() {
    BulkOperationConfiguration config = new BulkOperationConfiguration();
    config.setPoolPercent(30); // Higher percentage

    assertEquals(15, config.calculateConnectionLimit(50)); // 50 * 30% = 15
    assertEquals(20, config.calculateConnectionLimit(100)); // 100 * 30% = 30, capped to 20
  }

  @Test
  void testConnectionLimitCalculation_CustomBounds() {
    BulkOperationConfiguration config = new BulkOperationConfiguration();
    config.setMinConnections(5);
    config.setMaxConnectionsLimit(15);

    // Floor at 5
    assertEquals(5, config.calculateConnectionLimit(20)); // 20 * 20% = 4, floored to 5

    // Ceiling at 15
    assertEquals(15, config.calculateConnectionLimit(100)); // 100 * 20% = 20, capped to 15

    // Normal case in between
    assertEquals(10, config.calculateConnectionLimit(50)); // 50 * 20% = 10, within bounds
  }

  @Test
  void testConnectionLimitWithOverride() {
    BulkOperationConfiguration config = new BulkOperationConfiguration();
    config.setMaxConnections(8); // Hard override ignores poolPercent

    // Override uses fixed value (capped at poolSize-1 for safety)
    assertEquals(8, config.calculateConnectionLimit(50));
    assertEquals(8, config.calculateConnectionLimit(100));
    assertEquals(8, config.calculateConnectionLimit(10)); // 10-1 = 9, so 8 is ok
    assertEquals(4, config.calculateConnectionLimit(5)); // 5-1 = 4, capped
  }

  @Test
  void testConnectionLimitWithOverride_IgnoresBounds() {
    BulkOperationConfiguration config = new BulkOperationConfiguration();
    config.setMaxConnections(25); // Override higher than default ceiling
    config.setMaxConnectionsLimit(20); // This ceiling is ignored when override is set

    // Override wins over ceiling
    assertEquals(25, config.calculateConnectionLimit(100));
    assertEquals(25, config.calculateConnectionLimit(50));
  }

  @Test
  void testConnectionLimitWithOverride_TinyPoolNeverReturnsZero() {
    BulkOperationConfiguration config = new BulkOperationConfiguration();
    config.setMaxConnections(10); // Override set

    // Edge case: poolSize=1 would return 0 without the Math.max(1, ...) fix
    // This ensures bulk operations never hang indefinitely waiting for 0 permits
    assertEquals(1, config.calculateConnectionLimit(1)); // 1-1=0, but floored to 1
    assertEquals(1, config.calculateConnectionLimit(2)); // 2-1=1, ok
    assertEquals(3, config.calculateConnectionLimit(4)); // 4-1=3, ok
  }

  @Test
  void testConnectionSemaphore() throws InterruptedException {
    BulkOperationConfiguration config = new BulkOperationConfiguration();
    config.setMaxConnections(3); // Hard limit of 3 connections
    config.setMaxThreads(10);

    BulkExecutor.initialize(config, 50);
    BulkExecutor executor = BulkExecutor.getInstance();

    assertEquals(3, executor.getConnectionLimit());
    assertEquals(3, executor.getAvailableConnections());

    // Acquire all 3 permits
    executor.acquireConnection();
    executor.acquireConnection();
    executor.acquireConnection();

    assertEquals(0, executor.getAvailableConnections());

    // Release one
    executor.releaseConnection();
    assertEquals(1, executor.getAvailableConnections());

    // Release remaining
    executor.releaseConnection();
    executor.releaseConnection();
    assertEquals(3, executor.getAvailableConnections());
  }

  @Test
  void testConnectionSemaphoreLimitsConcurrency() throws InterruptedException {
    BulkOperationConfiguration config = new BulkOperationConfiguration();
    config.setMaxConnections(2); // Only 2 connections allowed
    config.setMaxThreads(10);
    config.setQueueSize(100);

    BulkExecutor.initialize(config, 50);
    BulkExecutor executor = BulkExecutor.getInstance();

    AtomicInteger maxConcurrentConnections = new AtomicInteger(0);
    AtomicInteger currentConnections = new AtomicInteger(0);
    AtomicInteger completed = new AtomicInteger(0);
    CountDownLatch allDone = new CountDownLatch(10);

    for (int i = 0; i < 10; i++) {
      executor.submit(
          () -> {
            try {
              executor.acquireConnection();
              try {
                int current = currentConnections.incrementAndGet();
                maxConcurrentConnections.updateAndGet(max -> Math.max(max, current));
                Thread.sleep(50); // Simulate DB work
                currentConnections.decrementAndGet();
                completed.incrementAndGet();
              } finally {
                executor.releaseConnection();
              }
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
        maxConcurrentConnections.get() <= 2,
        "Max concurrent connections should not exceed 2, got: " + maxConcurrentConnections.get());

    LOG.info(
        "Connection semaphore test: maxConcurrent={}, completed={}",
        maxConcurrentConnections.get(),
        completed.get());
  }

  @Test
  void testConcurrencyLimit() throws InterruptedException {
    BulkOperationConfiguration config = new BulkOperationConfiguration();
    config.setMaxConnections(3);
    config.setMaxThreads(3);
    config.setQueueSize(100);

    BulkExecutor.initialize(config, 50);
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
    config.setMaxConnections(1);
    config.setMaxThreads(1);
    config.setQueueSize(5);

    BulkExecutor.initialize(config, 50);
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
    config.setMaxConnections(1);
    config.setMaxThreads(1);
    config.setQueueSize(2);

    BulkExecutor.initialize(config, 50);
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
    config.setMaxConnections(2);
    config.setMaxThreads(2);
    config.setQueueSize(10);

    BulkExecutor.initialize(config, 50);
    BulkExecutor executor = BulkExecutor.getInstance();

    assertTrue(executor.hasCapacityForBatch(5), "Should have capacity for batch of 5");
    assertTrue(executor.hasCapacityForBatch(10), "Should have capacity for batch of 10");
    assertFalse(executor.hasCapacityForBatch(11), "Should not have capacity for batch of 11");
  }

  @Test
  void testActiveCountAndQueueDepth() throws InterruptedException {
    BulkOperationConfiguration config = new BulkOperationConfiguration();
    config.setMaxConnections(2);
    config.setMaxThreads(2);
    config.setQueueSize(100);

    BulkExecutor.initialize(config, 50);
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

    BulkExecutor.initialize(config, 50);

    BulkExecutor instance1 = BulkExecutor.getInstance();
    BulkExecutor instance2 = BulkExecutor.getInstance();

    assertSame(instance1, instance2, "Should return same singleton instance");
  }

  @Test
  void testIsShutdown() {
    BulkOperationConfiguration config = new BulkOperationConfiguration();
    config.setMaxThreads(2);
    config.setTimeoutSeconds(5);

    BulkExecutor.initialize(config, 50);
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

    BulkExecutor.initialize(config, 50);
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

    BulkExecutor.initialize(config, 50);
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
    config.setMaxConnections(5);
    config.setMaxThreads(5);

    BulkExecutor.initialize(config, 50);
    BulkExecutor executor = BulkExecutor.getInstance();

    String stats = executor.getStats();
    assertNotNull(stats);
    assertTrue(stats.contains("pool=50"));
    assertTrue(stats.contains("connLimit=5"));
  }

  @Test
  void testAcquireConnectionTimesOutAndThrows() throws InterruptedException {
    BulkOperationConfiguration config = new BulkOperationConfiguration();
    config.setMaxConnections(1);
    config.setMaxThreads(2);
    config.setTimeoutSeconds(1);

    BulkExecutor.initialize(config, 50);
    BulkExecutor executor = BulkExecutor.getInstance();

    // Exhaust the single permit
    executor.acquireConnection();

    long start = System.nanoTime();
    assertThrows(
        RejectedExecutionException.class,
        () -> executor.acquireConnection(),
        "Should throw RejectedExecutionException after timeout");
    long elapsedMs = (System.nanoTime() - start) / 1_000_000;

    assertTrue(
        elapsedMs >= 900 && elapsedMs < 3000,
        "Timeout should be approximately 1s, was " + elapsedMs + "ms");

    // Release the held permit
    executor.releaseConnection();
  }

  @Test
  void testAcquireConnectionSucceedsWithinTimeout() throws InterruptedException {
    BulkOperationConfiguration config = new BulkOperationConfiguration();
    config.setMaxConnections(1);
    config.setMaxThreads(2);
    config.setTimeoutSeconds(5);

    BulkExecutor.initialize(config, 50);
    BulkExecutor executor = BulkExecutor.getInstance();

    // Acquire the single permit
    executor.acquireConnection();

    // Schedule a release after 200ms
    new Thread(
            () -> {
              try {
                Thread.sleep(200);
              } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
              }
              executor.releaseConnection();
            })
        .start();

    // This should succeed within the 5s timeout
    long start = System.nanoTime();
    assertDoesNotThrow(
        () -> executor.acquireConnection(), "Should acquire within timeout after permit released");
    long elapsedMs = (System.nanoTime() - start) / 1_000_000;

    assertTrue(elapsedMs < 2000, "Should acquire quickly after release, took " + elapsedMs + "ms");

    executor.releaseConnection();
  }
}
