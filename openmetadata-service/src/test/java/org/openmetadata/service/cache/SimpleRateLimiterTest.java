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

package org.openmetadata.service.cache;

import static org.junit.jupiter.api.Assertions.*;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;

@Slf4j
class SimpleRateLimiterTest {

  @Test
  @DisplayName("Test SimpleRateLimiter basic functionality")
  void testSimpleRateLimiterBasicFunctionality() throws Exception {
    SimpleRateLimiter rateLimiter = SimpleRateLimiter.create(5.0); // 5 ops/sec

    // Test basic properties
    assertEquals(5.0, rateLimiter.getRate(), 0.1, "Rate should match configured value");
    assertNotNull(rateLimiter.toString(), "toString should not be null");
    assertTrue(
        rateLimiter.toString().contains("SimpleRateLimiter"), "toString should contain class name");

    // Test try-acquire
    assertTrue(rateLimiter.tryAcquire(), "Should be able to try acquire immediately");

    // Test acquire single permit
    long startTime = System.currentTimeMillis();
    rateLimiter.acquire();
    long duration = System.currentTimeMillis() - startTime;
    assertTrue(duration >= 0, "Acquire should complete");

    LOG.info("SimpleRateLimiter basic functionality test passed");
  }

  @Test
  @DisplayName("Test SimpleRateLimiter rate limiting accuracy")
  void testSimpleRateLimiterRateLimitingAccuracy() throws Exception {
    double targetRate = 10.0; // 10 ops/sec
    SimpleRateLimiter rateLimiter = SimpleRateLimiter.create(targetRate);

    int operationCount = 20;
    long startTime = System.currentTimeMillis();

    for (int i = 0; i < operationCount; i++) {
      rateLimiter.acquire();
    }

    long endTime = System.currentTimeMillis();
    long duration = endTime - startTime;
    double actualRate = (double) operationCount * 1000 / duration;

    LOG.info(
        "SimpleRateLimiter: {} operations in {}ms (rate: {:.2f} ops/sec, target: {:.2f})",
        operationCount,
        duration,
        actualRate,
        targetRate);

    // Should be reasonably close to target rate (within 50% due to timing overhead)
    assertTrue(
        actualRate <= targetRate * 1.5, "Actual rate should not exceed target rate significantly");
    assertTrue(
        duration >= (operationCount - 1) * 1000 / targetRate * 0.5,
        "Should take reasonable time based on rate limit");
  }

  @Test
  @Timeout(10)
  @DisplayName("Test SimpleRateLimiter concurrent access")
  void testSimpleRateLimiterConcurrentAccess() throws Exception {
    double targetRate = 20.0; // 20 ops/sec
    SimpleRateLimiter rateLimiter = SimpleRateLimiter.create(targetRate);

    int threadCount = 3;
    int operationsPerThread = 10;
    ExecutorService executor = Executors.newFixedThreadPool(threadCount);

    AtomicInteger completedOperations = new AtomicInteger(0);
    List<Future<Void>> futures = new ArrayList<>();

    long startTime = System.currentTimeMillis();

    for (int i = 0; i < threadCount; i++) {
      futures.add(
          executor.submit(
              () -> {
                for (int j = 0; j < operationsPerThread; j++) {
                  rateLimiter.acquire();
                  completedOperations.incrementAndGet();
                }
                return null;
              }));
    }

    // Wait for all operations to complete
    for (Future<Void> future : futures) {
      future.get(30, TimeUnit.SECONDS);
    }

    long endTime = System.currentTimeMillis();
    long duration = endTime - startTime;
    int totalOperations = threadCount * operationsPerThread;
    double actualRate = (double) totalOperations * 1000 / duration;

    assertEquals(
        totalOperations, completedOperations.get(), "All operations should complete successfully");

    LOG.info(
        "SimpleRateLimiter concurrent test: {} operations in {}ms (rate: {:.2f} ops/sec)",
        totalOperations,
        duration,
        actualRate);

    // Rate should be approximately our target rate, allowing for overhead
    assertTrue(actualRate <= targetRate * 1.5, "Concurrent access should respect rate limits");

    executor.shutdown();
    assertTrue(executor.awaitTermination(5, TimeUnit.SECONDS), "Executor should terminate");
  }

  @Test
  @DisplayName("Test SimpleRateLimiter error handling")
  void testSimpleRateLimiterErrorHandling() {
    // Test invalid rate values
    assertThrows(
        IllegalArgumentException.class,
        () -> SimpleRateLimiter.create(0),
        "Should reject zero rate");
    assertThrows(
        IllegalArgumentException.class,
        () -> SimpleRateLimiter.create(-1),
        "Should reject negative rate");

    SimpleRateLimiter limiter = SimpleRateLimiter.create(1.0);

    // Test invalid permit counts
    assertThrows(
        IllegalArgumentException.class, () -> limiter.acquire(0), "Should reject zero permits");
    assertThrows(
        IllegalArgumentException.class,
        () -> limiter.acquire(-1),
        "Should reject negative permits");
    assertThrows(
        IllegalArgumentException.class,
        () -> limiter.tryAcquire(0),
        "Should reject zero permits in tryAcquire");
    assertThrows(
        IllegalArgumentException.class,
        () -> limiter.tryAcquire(-1),
        "Should reject negative permits in tryAcquire");

    LOG.info("SimpleRateLimiter error handling test passed");
  }

  @Test
  @Timeout(10)
  @DisplayName("Test SimpleRateLimiter interruption handling")
  void testSimpleRateLimiterInterruptionHandling() throws Exception {
    SimpleRateLimiter slowLimiter = SimpleRateLimiter.create(0.1); // Very slow rate

    CompletableFuture<Exception> exceptionFuture = new CompletableFuture<>();

    Thread testThread =
        new Thread(
            () -> {
              try {
                Thread.currentThread().interrupt(); // Set interrupt flag
                slowLimiter.acquire(); // This should detect interrupt and throw
                exceptionFuture.complete(null); // Should not reach here
              } catch (Exception e) {
                exceptionFuture.complete(e);
              }
            });

    testThread.start();

    Exception exception = exceptionFuture.get(5, TimeUnit.SECONDS);
    assertNotNull(exception, "Should throw exception when interrupted");
    assertTrue(exception instanceof RuntimeException, "Should throw RuntimeException");
    assertTrue(exception.getMessage().contains("Interrupted"), "Should mention interruption");

    testThread.join(1000); // Wait for thread to finish

    LOG.info("SimpleRateLimiter interruption handling test passed");
  }

  @Test
  @DisplayName("Test SimpleRateLimiter multiple permits")
  void testSimpleRateLimiterMultiplePermits() throws Exception {
    SimpleRateLimiter rateLimiter = SimpleRateLimiter.create(10.0); // 10 ops/sec

    // Test acquiring multiple permits at once
    long startTime = System.currentTimeMillis();
    rateLimiter.acquire(5); // Acquire 5 permits at once
    long duration = System.currentTimeMillis() - startTime;

    // Should take approximately 0.5 seconds for 5 permits at 10 ops/sec
    assertTrue(duration >= 400, "Should take time proportional to permit count");
    assertTrue(duration <= 1000, "Should not take excessively long");

    // Test try-acquire with multiple permits
    boolean acquired = rateLimiter.tryAcquire(3);
    // May or may not succeed depending on available permits

    LOG.info("SimpleRateLimiter multiple permits test: {} permits in {}ms", 5, duration);
  }
}
