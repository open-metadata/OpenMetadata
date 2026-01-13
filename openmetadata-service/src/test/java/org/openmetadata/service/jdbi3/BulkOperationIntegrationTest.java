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
import static org.openmetadata.service.monitoring.MetricUtils.normalizeUri;

import io.micrometer.core.instrument.Metrics;
import io.micrometer.core.instrument.Timer;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicInteger;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.config.BulkOperationConfiguration;
import org.openmetadata.service.monitoring.RequestLatencyContext;

/**
 * Integration tests for bulk operation semaphore throttling and metrics tracking. These tests
 * verify that:
 *
 * <ul>
 *   <li>The semaphore correctly limits concurrent DB operations
 *   <li>Metrics are accurately tracked across virtual threads
 *   <li>The system handles high concurrency without connection pool exhaustion
 *   <li>Timeouts work correctly when the system is overloaded
 * </ul>
 */
@Slf4j
class BulkOperationIntegrationTest {

  private static final ExecutorService VIRTUAL_THREAD_EXECUTOR =
      Executors.newVirtualThreadPerTaskExecutor();

  @BeforeEach
  void setUp() {
    // Reset semaphore and metrics
    BulkOperationSemaphore.reset();
    Metrics.globalRegistry.clear();
    Metrics.globalRegistry.getRegistries().forEach(Metrics.globalRegistry::remove);
    Metrics.addRegistry(new SimpleMeterRegistry());
    // Reset RequestLatencyContext static maps to ensure clean state
    RequestLatencyContext.reset();
  }

  @AfterEach
  void tearDown() {
    BulkOperationSemaphore.reset();
    RequestLatencyContext.reset();
  }

  @Test
  void testSemaphore_LimitsConcurrentOperations() throws InterruptedException {
    int maxPermits = 5;
    int totalOperations = 20;
    int operationDurationMs = 100;

    BulkOperationSemaphore.initialize(maxPermits, 30000);
    BulkOperationSemaphore semaphore = BulkOperationSemaphore.getInstance();

    AtomicInteger maxConcurrent = new AtomicInteger(0);
    AtomicInteger currentConcurrent = new AtomicInteger(0);
    AtomicInteger completedOperations = new AtomicInteger(0);
    List<Throwable> errors = Collections.synchronizedList(new ArrayList<>());

    CountDownLatch startLatch = new CountDownLatch(1);
    CountDownLatch doneLatch = new CountDownLatch(totalOperations);

    // Simulate bulk operations
    for (int i = 0; i < totalOperations; i++) {
      VIRTUAL_THREAD_EXECUTOR.submit(
          () -> {
            try {
              startLatch.await();
              semaphore.acquire();
              try {
                int current = currentConcurrent.incrementAndGet();
                maxConcurrent.updateAndGet(max -> Math.max(max, current));

                // Simulate DB work
                Thread.sleep(operationDurationMs);

                currentConcurrent.decrementAndGet();
                completedOperations.incrementAndGet();
              } finally {
                semaphore.release();
              }
            } catch (Exception e) {
              errors.add(e);
            } finally {
              doneLatch.countDown();
            }
          });
    }

    long startTime = System.currentTimeMillis();
    startLatch.countDown();
    boolean completed = doneLatch.await(30, TimeUnit.SECONDS);
    long totalTime = System.currentTimeMillis() - startTime;

    assertTrue(completed, "All operations should complete");
    assertTrue(errors.isEmpty(), "Should have no errors: " + errors);
    assertEquals(totalOperations, completedOperations.get());

    // Verify concurrency was limited
    assertTrue(
        maxConcurrent.get() <= maxPermits,
        String.format(
            "Max concurrent should not exceed %d permits, got: %d",
            maxPermits, maxConcurrent.get()));

    // Verify execution was serialized due to semaphore
    // With 20 operations, 5 permits, 100ms each: minimum time is (20/5) * 100 = 400ms
    int expectedMinTime = (totalOperations / maxPermits) * operationDurationMs;
    assertTrue(
        totalTime >= expectedMinTime * 0.8,
        String.format(
            "Total time should be at least %dms (with 20%% tolerance), got: %dms",
            (int) (expectedMinTime * 0.8), totalTime));

    LOG.info(
        "Semaphore test: {} ops, {} permits, max concurrent: {}, total time: {}ms (expected min: {}ms)",
        totalOperations,
        maxPermits,
        maxConcurrent.get(),
        totalTime,
        expectedMinTime);
  }

  @Test
  void testSemaphore_TimeoutOnOverload() throws InterruptedException, TimeoutException {
    int maxPermits = 2;
    int shortTimeoutMs = 200;

    BulkOperationSemaphore.initialize(maxPermits, shortTimeoutMs);
    BulkOperationSemaphore semaphore = BulkOperationSemaphore.getInstance();

    AtomicInteger timeoutCount = new AtomicInteger(0);
    AtomicInteger successCount = new AtomicInteger(0);

    // Acquire all permits
    for (int i = 0; i < maxPermits; i++) {
      semaphore.acquire();
    }

    // Try to acquire more - should timeout
    int extraAttempts = 5;
    CountDownLatch latch = new CountDownLatch(extraAttempts);

    for (int i = 0; i < extraAttempts; i++) {
      VIRTUAL_THREAD_EXECUTOR.submit(
          () -> {
            try {
              semaphore.acquire();
              successCount.incrementAndGet();
              semaphore.release();
            } catch (TimeoutException e) {
              timeoutCount.incrementAndGet();
            } catch (InterruptedException e) {
              Thread.currentThread().interrupt();
            } finally {
              latch.countDown();
            }
          });
    }

    latch.await(5, TimeUnit.SECONDS);

    // Release the permits we held
    for (int i = 0; i < maxPermits; i++) {
      semaphore.release();
    }

    assertEquals(extraAttempts, timeoutCount.get(), "All extra attempts should timeout");
    assertEquals(0, successCount.get(), "No extra attempts should succeed");

    LOG.info(
        "Timeout test: {} timeouts as expected with {}ms timeout",
        timeoutCount.get(),
        shortTimeoutMs);
  }

  @Test
  void testMetrics_TrackedAcrossVirtualThreads() throws InterruptedException {
    String endpoint = "/api/v1/tables/bulk";

    // Initialize semaphore
    BulkOperationSemaphore.initialize(10, 30000);

    // Start request tracking on main thread
    RequestLatencyContext.startRequest(endpoint, "PUT");
    RequestLatencyContext.RequestContext parentContext = RequestLatencyContext.getContext();
    assertNotNull(parentContext, "Parent context should exist");

    int numOperations = 5;
    int dbTimePerOpMs = 50;

    CountDownLatch latch = new CountDownLatch(numOperations);
    List<Throwable> errors = Collections.synchronizedList(new ArrayList<>());

    // Simulate bulk operation with virtual threads
    for (int i = 0; i < numOperations; i++) {
      VIRTUAL_THREAD_EXECUTOR.submit(
          () -> {
            try {
              // Propagate context
              RequestLatencyContext.setContext(parentContext);
              try {
                // Simulate DB operation
                Timer.Sample dbSample = RequestLatencyContext.startDatabaseOperation();
                Thread.sleep(dbTimePerOpMs);
                RequestLatencyContext.endDatabaseOperation(dbSample);
              } finally {
                RequestLatencyContext.clearContext();
              }
            } catch (Exception e) {
              errors.add(e);
            } finally {
              latch.countDown();
            }
          });
    }

    latch.await(10, TimeUnit.SECONDS);
    assertTrue(errors.isEmpty(), "Should have no errors");

    // End request to finalize metrics
    RequestLatencyContext.endRequest();

    // Verify DB time was accumulated from all threads
    String normalizedEndpoint = normalizeUri(endpoint);
    Timer dbTimer =
        Metrics.globalRegistry
            .find("request.latency.database")
            .tag("endpoint", normalizedEndpoint)
            .tag("method", "PUT")
            .timer();

    assertNotNull(dbTimer, "DB timer should exist");
    double dbMs = dbTimer.totalTime(TimeUnit.MILLISECONDS);

    // Expected: 5 operations * 50ms = 250ms minimum
    int expectedMinDbTime = numOperations * dbTimePerOpMs;
    assertTrue(
        dbMs >= expectedMinDbTime * 0.8,
        String.format(
            "DB time should be at least %dms (80%% of expected), got: %.0fms",
            (int) (expectedMinDbTime * 0.8), dbMs));

    // Verify operation count
    var dbOps =
        Metrics.globalRegistry
            .find("request.operations.database")
            .tag("endpoint", normalizedEndpoint)
            .tag("method", "PUT")
            .summary();

    assertNotNull(dbOps, "DB operations summary should exist");
    assertEquals(
        numOperations,
        dbOps.totalAmount(),
        String.format("Should have %d DB operations recorded", numOperations));

    LOG.info(
        "Metrics test: {} ops, expected DB time ~{}ms, actual: {}ms, ops recorded: {}",
        numOperations,
        expectedMinDbTime,
        (int) dbMs,
        (int) dbOps.totalAmount());
  }

  @Test
  void testBulkOperationPattern_SimulatesRealWorkload() throws InterruptedException {
    // This test simulates the actual bulk operation pattern from EntityRepository
    int numEntities = 20;
    int dbOpsPerEntity = 2; // findByName + update
    int dbTimePerOpMs = 20;
    int maxPermits = 5;

    BulkOperationSemaphore.initialize(maxPermits, 30000);
    BulkOperationSemaphore semaphore = BulkOperationSemaphore.getInstance();

    String endpoint = "/api/v1/tables/bulk";
    RequestLatencyContext.startRequest(endpoint, "PUT");
    RequestLatencyContext.RequestContext parentContext = RequestLatencyContext.getContext();

    AtomicInteger maxConcurrent = new AtomicInteger(0);
    AtomicInteger currentConcurrent = new AtomicInteger(0);
    AtomicInteger successCount = new AtomicInteger(0);
    AtomicInteger failCount = new AtomicInteger(0);

    List<CompletableFuture<Void>> futures = new ArrayList<>();

    LOG.info(
        "Starting bulk operation for {} entities with {}/{} permits",
        numEntities,
        semaphore.availablePermits(),
        semaphore.getMaxPermits());

    long startTime = System.currentTimeMillis();

    for (int i = 0; i < numEntities; i++) {
      final int entityIndex = i;
      CompletableFuture<Void> future =
          CompletableFuture.runAsync(
              () -> {
                RequestLatencyContext.setContext(parentContext);
                try {
                  semaphore.acquire();
                  try {
                    int current = currentConcurrent.incrementAndGet();
                    maxConcurrent.updateAndGet(max -> Math.max(max, current));

                    // Simulate entity processing with multiple DB operations
                    for (int op = 0; op < dbOpsPerEntity; op++) {
                      Timer.Sample dbSample = RequestLatencyContext.startDatabaseOperation();
                      Thread.sleep(dbTimePerOpMs);
                      RequestLatencyContext.endDatabaseOperation(dbSample);
                    }

                    currentConcurrent.decrementAndGet();
                    successCount.incrementAndGet();
                  } finally {
                    semaphore.release();
                  }
                } catch (TimeoutException e) {
                  failCount.incrementAndGet();
                  LOG.warn("Timeout for entity {}", entityIndex);
                } catch (InterruptedException e) {
                  Thread.currentThread().interrupt();
                  failCount.incrementAndGet();
                } catch (Exception e) {
                  failCount.incrementAndGet();
                  LOG.error("Error processing entity {}", entityIndex, e);
                } finally {
                  RequestLatencyContext.clearContext();
                }
              },
              VIRTUAL_THREAD_EXECUTOR);

      futures.add(future);
    }

    // Wait for all operations
    CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();
    long totalTime = System.currentTimeMillis() - startTime;

    RequestLatencyContext.endRequest();

    // Verify results
    assertEquals(numEntities, successCount.get(), "All entities should succeed");
    assertEquals(0, failCount.get(), "No entities should fail");
    assertTrue(
        maxConcurrent.get() <= maxPermits,
        String.format("Max concurrent should be <= %d, got: %d", maxPermits, maxConcurrent.get()));

    // Verify metrics
    String normalizedEndpoint = normalizeUri(endpoint);
    Timer dbTimer =
        Metrics.globalRegistry
            .find("request.latency.database")
            .tag("endpoint", normalizedEndpoint)
            .tag("method", "PUT")
            .timer();

    assertNotNull(dbTimer, "DB timer should exist");
    double dbMs = dbTimer.totalTime(TimeUnit.MILLISECONDS);
    int expectedMinDbTime = numEntities * dbOpsPerEntity * dbTimePerOpMs;

    var dbOps =
        Metrics.globalRegistry
            .find("request.operations.database")
            .tag("endpoint", normalizedEndpoint)
            .tag("method", "PUT")
            .summary();

    assertNotNull(dbOps, "DB operations summary should exist");
    int expectedTotalOps = numEntities * dbOpsPerEntity;
    assertEquals(expectedTotalOps, (int) dbOps.totalAmount(), "Should have correct DB op count");

    LOG.info(
        "Bulk simulation complete:\n"
            + "  Entities: {}\n"
            + "  Max permits: {}\n"
            + "  Max concurrent: {}\n"
            + "  Total time: {}ms\n"
            + "  DB time (accumulated): {}ms (expected min: {}ms)\n"
            + "  DB operations: {} (expected: {})",
        numEntities,
        maxPermits,
        maxConcurrent.get(),
        totalTime,
        (int) dbMs,
        expectedMinDbTime,
        (int) dbOps.totalAmount(),
        expectedTotalOps);
  }

  @Test
  void testAutoScaling_WithDifferentPoolSizes() {
    BulkOperationConfiguration config = new BulkOperationConfiguration();
    config.setAutoScale(true);
    config.setBulkConnectionPercentage(20);
    config.setMaxConcurrentDbOperations(100);

    // Test with various pool sizes
    int[][] testCases = {
      {10, 2}, // Pool 10, bulk 20% = 2
      {50, 10}, // Pool 50, bulk 20% = 10
      {100, 20}, // Pool 100, bulk 20% = 20
      {500, 100}, // Pool 500, bulk 20% = 100 (capped at max)
    };

    for (int[] testCase : testCases) {
      BulkOperationSemaphore.reset();
      int poolSize = testCase[0];
      int expectedPermits = testCase[1];

      BulkOperationSemaphore.initialize(config, poolSize);
      BulkOperationSemaphore semaphore = BulkOperationSemaphore.getInstance();

      assertEquals(
          expectedPermits,
          semaphore.getMaxPermits(),
          String.format(
              "Pool %d with 20%% bulk should yield %d permits", poolSize, expectedPermits));

      LOG.info("Auto-scale test: pool={}, permits={}", poolSize, semaphore.getMaxPermits());
    }
  }

  @Test
  void testConcurrentBulkRequests_DoNotExceedPoolLimit() throws InterruptedException {
    // Simulate multiple concurrent bulk requests (e.g., multiple ingestion jobs)
    int maxPermits = 10;
    int concurrentRequests = 3;
    int entitiesPerRequest = 10;
    int dbTimeMs = 30;

    BulkOperationSemaphore.initialize(maxPermits, 30000);
    BulkOperationSemaphore semaphore = BulkOperationSemaphore.getInstance();

    AtomicInteger globalMaxConcurrent = new AtomicInteger(0);
    AtomicInteger globalCurrentConcurrent = new AtomicInteger(0);
    AtomicInteger totalSuccess = new AtomicInteger(0);

    CountDownLatch allDone = new CountDownLatch(concurrentRequests);

    // Start multiple bulk requests concurrently
    for (int req = 0; req < concurrentRequests; req++) {
      final int requestId = req;
      VIRTUAL_THREAD_EXECUTOR.submit(
          () -> {
            try {
              List<CompletableFuture<Void>> futures = new ArrayList<>();

              for (int i = 0; i < entitiesPerRequest; i++) {
                CompletableFuture<Void> future =
                    CompletableFuture.runAsync(
                        () -> {
                          try {
                            semaphore.acquire();
                            try {
                              int current = globalCurrentConcurrent.incrementAndGet();
                              globalMaxConcurrent.updateAndGet(max -> Math.max(max, current));

                              Thread.sleep(dbTimeMs);

                              globalCurrentConcurrent.decrementAndGet();
                              totalSuccess.incrementAndGet();
                            } finally {
                              semaphore.release();
                            }
                          } catch (Exception e) {
                            LOG.error("Error in request {} entity", requestId, e);
                          }
                        },
                        VIRTUAL_THREAD_EXECUTOR);
                futures.add(future);
              }

              CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();
            } finally {
              allDone.countDown();
            }
          });
    }

    allDone.await(60, TimeUnit.SECONDS);

    int totalEntities = concurrentRequests * entitiesPerRequest;
    assertEquals(totalEntities, totalSuccess.get(), "All entities should succeed");
    assertTrue(
        globalMaxConcurrent.get() <= maxPermits,
        String.format(
            "Global max concurrent should not exceed %d permits, got: %d",
            maxPermits, globalMaxConcurrent.get()));

    LOG.info(
        "Concurrent requests test: {} requests × {} entities = {} total, "
            + "max concurrent: {}, permits: {}",
        concurrentRequests,
        entitiesPerRequest,
        totalEntities,
        globalMaxConcurrent.get(),
        maxPermits);
  }
}
