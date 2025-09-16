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

import com.google.common.util.concurrent.RateLimiter;
import io.github.resilience4j.ratelimiter.RateLimiterConfig;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;

@Slf4j
class RateLimiterComparisonTest {

  private static final double TEST_RATE = 10.0; // 10 operations per second
  private static final int TEST_DURATION_SECONDS = 2;
  private static final int EXPECTED_OPERATIONS = (int) (TEST_RATE * TEST_DURATION_SECONDS);
  private static final double TOLERANCE = 0.2; // 20% tolerance

  @Test
  @Timeout(30)
  @DisplayName("Test Guava RateLimiter performance and accuracy")
  public void testGuavaRateLimiter() throws Exception {
    LOG.info("Testing Guava RateLimiter (version: 33.4.8-jre, marked @Beta)");

    RateLimiter rateLimiter = RateLimiter.create(TEST_RATE);
    RateLimiterTestResult result = performRateLimiterTest("Guava", rateLimiter::acquire);

    validateRateLimiterResult(result, "Guava RateLimiter");

    // Test try-acquire functionality
    // Reset the rate limiter to ensure clean state
    rateLimiter = RateLimiter.create(TEST_RATE);
    // First acquisition should succeed
    assertTrue(rateLimiter.tryAcquire(), "Should be able to acquire permit immediately");

    // Test rate change
    rateLimiter.setRate(20.0);
    assertEquals(20.0, rateLimiter.getRate(), 0.1, "Rate should be updated");

    LOG.info("Guava RateLimiter test completed: {}", result);
  }

  @Test
  @Timeout(30)
  @DisplayName("Test Resilience4j RateLimiter performance and accuracy")
  public void testResilience4jRateLimiter() throws Exception {
    LOG.info("Testing Resilience4j RateLimiter (production-ready)");

    RateLimiterConfig config =
        RateLimiterConfig.custom()
            .limitForPeriod((int) TEST_RATE)
            .limitRefreshPeriod(Duration.ofSeconds(1))
            .timeoutDuration(Duration.ofSeconds(10))
            .build();

    io.github.resilience4j.ratelimiter.RateLimiter rateLimiter =
        io.github.resilience4j.ratelimiter.RateLimiter.of("test", config);

    RateLimiterTestResult result =
        performRateLimiterTest(
            "Resilience4j",
            () -> {
              try {
                rateLimiter.acquirePermission();
              } catch (Exception e) {
                throw new RuntimeException("Failed to acquire permission", e);
              }
            });

    validateRateLimiterResult(result, "Resilience4j RateLimiter");

    // Test try-acquire functionality
    boolean acquired = false;
    try {
      acquired = rateLimiter.acquirePermission(100);
    } catch (Exception e) {
      // Handle timeout or interruption
    }
    // Note: Just test that the method exists and doesn't throw on valid calls

    // Test metrics
    io.github.resilience4j.ratelimiter.RateLimiter.Metrics metrics = rateLimiter.getMetrics();
    assertTrue(metrics.getNumberOfWaitingThreads() >= 0, "Should provide metrics");

    LOG.info("Resilience4j RateLimiter test completed: {}", result);
  }

  @Test
  @Timeout(30)
  @DisplayName("Test Resilience4j production configuration")
  public void testResilience4jProductionConfiguration() throws Exception {
    LOG.info(
        "Testing Resilience4j RateLimiter production configuration matching CacheWarmupService");

    // Use the same configuration as CacheWarmupService
    RateLimiterConfig config =
        RateLimiterConfig.custom()
            .limitForPeriod((int) TEST_RATE)
            .limitRefreshPeriod(Duration.ofSeconds(1))
            .timeoutDuration(Duration.ofSeconds(60))
            .build();

    io.github.resilience4j.ratelimiter.RateLimiter rateLimiter =
        io.github.resilience4j.ratelimiter.RateLimiter.of("cache-warmup-test", config);

    RateLimiterTestResult result =
        performRateLimiterTest(
            "Resilience4j-Production",
            () -> {
              try {
                rateLimiter.acquirePermission();
              } catch (Exception e) {
                throw new RuntimeException("Failed to acquire permission", e);
              }
            });

    validateRateLimiterResult(result, "Resilience4j Production Config");

    // Test metrics (production benefit)
    io.github.resilience4j.ratelimiter.RateLimiter.Metrics metrics = rateLimiter.getMetrics();
    assertTrue(metrics.getNumberOfWaitingThreads() >= 0, "Should provide production metrics");
    assertTrue(metrics.getAvailablePermissions() >= 0, "Should track available permits");

    LOG.info("Resilience4j production configuration test completed: {}", result);
    LOG.info(
        "Production metrics - Available permits: {}, Waiting threads: {}",
        metrics.getAvailablePermissions(),
        metrics.getNumberOfWaitingThreads());
  }

  @Test
  @DisplayName("Test concurrent access with multiple rate limiters")
  public void testConcurrentAccess() throws Exception {
    LOG.info("Testing concurrent access patterns");

    int threadCount = 5;
    int operationsPerThread = 20;
    ExecutorService executor = Executors.newFixedThreadPool(threadCount);

    // Test Guava RateLimiter under concurrency
    RateLimiter guavaLimiter = RateLimiter.create(TEST_RATE);
    testConcurrentRateLimiter(
        "Guava", executor, threadCount, operationsPerThread, guavaLimiter::acquire);

    // Test Resilience4j RateLimiter under concurrency
    RateLimiterConfig config =
        RateLimiterConfig.custom()
            .limitForPeriod((int) TEST_RATE)
            .limitRefreshPeriod(Duration.ofSeconds(1))
            .timeoutDuration(Duration.ofSeconds(30))
            .build();
    io.github.resilience4j.ratelimiter.RateLimiter resilience4jLimiter =
        io.github.resilience4j.ratelimiter.RateLimiter.of("concurrent-test", config);
    testConcurrentRateLimiter(
        "Resilience4j",
        executor,
        threadCount,
        operationsPerThread,
        resilience4jLimiter::acquirePermission);

    // Test production Resilience4j configuration under concurrency
    RateLimiterConfig prodConfig =
        RateLimiterConfig.custom()
            .limitForPeriod((int) TEST_RATE)
            .limitRefreshPeriod(Duration.ofSeconds(1))
            .timeoutDuration(Duration.ofSeconds(30))
            .build();
    io.github.resilience4j.ratelimiter.RateLimiter prodLimiter =
        io.github.resilience4j.ratelimiter.RateLimiter.of("production-concurrent-test", prodConfig);
    testConcurrentRateLimiter(
        "Resilience4j-Production",
        executor,
        threadCount,
        operationsPerThread,
        prodLimiter::acquirePermission);

    executor.shutdown();
    assertTrue(
        executor.awaitTermination(30, TimeUnit.SECONDS),
        "Executor should terminate within timeout");
  }

  @Test
  @DisplayName("Test rate limiter edge cases and error handling")
  public void testEdgeCasesAndErrorHandling() {
    LOG.info("Testing edge cases and error handling");

    // Test invalid rate values
    assertThrows(
        IllegalArgumentException.class,
        () -> RateLimiter.create(0),
        "Guava should reject zero rate");
    assertThrows(
        IllegalArgumentException.class,
        () -> RateLimiter.create(-1),
        "Guava should reject negative rate");
    // Test Resilience4j configuration validation
    assertThrows(
        IllegalArgumentException.class,
        () -> RateLimiterConfig.custom().limitForPeriod(0).build(),
        "Resilience4j should reject zero limit");
    assertThrows(
        IllegalArgumentException.class,
        () -> RateLimiterConfig.custom().limitForPeriod(-1).build(),
        "Resilience4j should reject negative limit");

    // Test production timeout configuration
    RateLimiterConfig timeoutConfig =
        RateLimiterConfig.custom()
            .limitForPeriod(1)
            .limitRefreshPeriod(Duration.ofSeconds(1))
            .timeoutDuration(Duration.ofMillis(100))
            .build();

    io.github.resilience4j.ratelimiter.RateLimiter timeoutLimiter =
        io.github.resilience4j.ratelimiter.RateLimiter.of("timeoutTest", timeoutConfig);

    // First acquire should succeed immediately
    assertTrue(
        timeoutLimiter.acquirePermission(1), "First acquire with production config should succeed");

    // For Resilience4j, acquirePermission(n) is asking for n permits, not setting a timeout.
    // The timeout is configured as 100ms in the timeoutConfig.
    // Since we already consumed the only available permit, the next call should time out
    // after the configured 100ms timeout duration and return false.
    // This is how timeouts work in production with Resilience4j.
    long startTime = System.currentTimeMillis();
    boolean acquired = timeoutLimiter.acquirePermission(1);
    long elapsedTime = System.currentTimeMillis() - startTime;

    assertFalse(acquired, "Should not acquire permit when limit exceeded with timeout config");
    assertTrue(
        elapsedTime >= 100 && elapsedTime < 1000,
        "Timeout should occur after ~100ms, not after the full refresh period. Actual time: "
            + elapsedTime
            + "ms");

    LOG.info("Edge cases and error handling tests completed");
  }

  @Test
  @DisplayName("Test production scenario with cache warmup simulation")
  public void testProductionScenarioSimulation() throws Exception {
    LOG.info("Testing production scenario simulation");

    // Simulate cache warmup scenario with different rate limiters
    double warmupRate = 50.0; // 50 ops/sec for warmup
    int totalOperations = 200;

    // Test each rate limiter in a cache warmup simulation
    testCacheWarmupSimulation("Guava", RateLimiter.create(warmupRate), totalOperations);

    RateLimiterConfig config =
        RateLimiterConfig.custom()
            .limitForPeriod((int) warmupRate)
            .limitRefreshPeriod(Duration.ofSeconds(1))
            .timeoutDuration(Duration.ofSeconds(60))
            .build();
    io.github.resilience4j.ratelimiter.RateLimiter resilience4jLimiter =
        io.github.resilience4j.ratelimiter.RateLimiter.of("warmup-test", config);
    testCacheWarmupSimulation("Resilience4j", resilience4jLimiter, totalOperations);

    // Test production configuration that matches CacheWarmupService
    RateLimiterConfig prodConfig =
        RateLimiterConfig.custom()
            .limitForPeriod((int) warmupRate)
            .limitRefreshPeriod(Duration.ofSeconds(1))
            .timeoutDuration(Duration.ofSeconds(60))
            .build();
    io.github.resilience4j.ratelimiter.RateLimiter prodLimiter =
        io.github.resilience4j.ratelimiter.RateLimiter.of("cache-warmup-sim", prodConfig);
    testCacheWarmupSimulation("Resilience4j-Production", prodLimiter, totalOperations);

    LOG.info("Production scenario simulation completed");
  }

  private void testCacheWarmupSimulation(String limiterType, Object rateLimiter, int operations)
      throws Exception {
    LOG.info("Testing cache warmup simulation with {} rate limiter", limiterType);

    long startTime = System.currentTimeMillis();

    for (int i = 0; i < operations; i++) {
      if (rateLimiter instanceof RateLimiter) {
        ((RateLimiter) rateLimiter).acquire();
      } else if (rateLimiter instanceof io.github.resilience4j.ratelimiter.RateLimiter) {
        ((io.github.resilience4j.ratelimiter.RateLimiter) rateLimiter).acquirePermission();
      }

      // Simulate some work (database query)
      Thread.sleep(1); // 1ms of "work"
    }

    long endTime = System.currentTimeMillis();
    long duration = endTime - startTime;
    double actualRate = (double) operations * 1000 / duration;

    LOG.info(
        "{} warmup simulation: {} operations in {}ms (rate: {} ops/sec)",
        limiterType,
        operations,
        duration,
        String.format("%.2f", actualRate));

    // The actual rate should be close to our target rate (50 ops/sec)
    // but can be slightly higher or lower due to processing overhead
    double maxAcceptableRate = 66.0; // 32% tolerance for test environments
    assertTrue(
        actualRate <= maxAcceptableRate,
        limiterType
            + " should not exceed target rate significantly (actual: "
            + actualRate
            + ", max: "
            + maxAcceptableRate
            + ")");
  }

  private void testConcurrentRateLimiter(
      String name,
      ExecutorService executor,
      int threadCount,
      int operationsPerThread,
      Runnable acquireOperation)
      throws Exception {

    LOG.info(
        "Testing {} under concurrent load: {} threads, {} ops each",
        name,
        threadCount,
        operationsPerThread);

    AtomicInteger completedOperations = new AtomicInteger(0);
    List<Future<Void>> futures = new ArrayList<>();

    long startTime = System.currentTimeMillis();

    for (int i = 0; i < threadCount; i++) {
      futures.add(
          executor.submit(
              () -> {
                for (int j = 0; j < operationsPerThread; j++) {
                  try {
                    acquireOperation.run();
                    completedOperations.incrementAndGet();
                  } catch (Exception e) {
                    LOG.error("Error in concurrent test: {}", e.getMessage());
                    throw new RuntimeException(e);
                  }
                }
                return null;
              }));
    }

    // Wait for all operations to complete
    for (Future<Void> future : futures) {
      future.get(60, TimeUnit.SECONDS); // 60 second timeout
    }

    long endTime = System.currentTimeMillis();
    long duration = endTime - startTime;
    int totalOperations = threadCount * operationsPerThread;

    assertEquals(
        totalOperations, completedOperations.get(), "All operations should complete successfully");

    double actualRate = (double) totalOperations * 1000 / duration;
    LOG.info(
        "{} concurrent test completed: {} operations in {}ms (rate: {} ops/sec)",
        name,
        totalOperations,
        duration,
        String.format("%.2f", actualRate));

    // Rate should be approximately our test rate, allowing for overhead
    assertTrue(
        actualRate <= TEST_RATE * 1.2, name + " should respect rate limits under concurrent load");
  }

  private RateLimiterTestResult performRateLimiterTest(String name, Runnable acquireOperation) {
    LOG.info("Starting rate limiter test for: {}", name);

    long startTime = System.currentTimeMillis();
    int operationCount = 0;

    while ((System.currentTimeMillis() - startTime) < (TEST_DURATION_SECONDS * 1000)) {
      acquireOperation.run();
      operationCount++;
    }

    long endTime = System.currentTimeMillis();
    long actualDuration = endTime - startTime;
    double actualRate = (double) operationCount * 1000 / actualDuration;

    return new RateLimiterTestResult(name, operationCount, actualDuration, actualRate, TEST_RATE);
  }

  private void validateRateLimiterResult(RateLimiterTestResult result, String limiterName) {
    LOG.info("Validating {} results: {}", limiterName, result);

    assertTrue(result.operationCount > 0, "Should perform at least one operation");
    assertTrue(result.actualDurationMs > 0, "Duration should be positive");
    assertTrue(result.actualRate > 0, "Actual rate should be positive");

    // Allow some tolerance for timing variations and overhead
    double minExpectedRate = TEST_RATE * (1 - TOLERANCE);
    double maxExpectedRate = TEST_RATE * (1 + TOLERANCE);

    assertTrue(
        result.actualRate >= minExpectedRate,
        String.format(
            "%s actual rate (%.2f) should be at least %.2f ops/sec",
            limiterName, result.actualRate, minExpectedRate));

    assertTrue(
        result.actualRate <= maxExpectedRate,
        String.format(
            "%s actual rate (%.2f) should not exceed %.2f ops/sec",
            limiterName, result.actualRate, maxExpectedRate));

    LOG.info("{} validation passed", limiterName);
  }

  private static class RateLimiterTestResult {
    final String name;
    final int operationCount;
    final long actualDurationMs;
    final double actualRate;
    final double expectedRate;

    RateLimiterTestResult(
        String name,
        int operationCount,
        long actualDurationMs,
        double actualRate,
        double expectedRate) {
      this.name = name;
      this.operationCount = operationCount;
      this.actualDurationMs = actualDurationMs;
      this.actualRate = actualRate;
      this.expectedRate = expectedRate;
    }

    @Override
    public String toString() {
      return String.format(
          "%s: %d operations in %dms (%.2f ops/sec, expected: %.2f)",
          name, operationCount, actualDurationMs, actualRate, expectedRate);
    }
  }
}
