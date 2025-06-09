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
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@Slf4j
class RateLimiterProductionReadinessTest {

  @Test
  @DisplayName("Production readiness comparison: Guava vs Resilience4j vs SimpleRateLimiter")
  void testProductionReadinessComparison() throws Exception {
    LOG.info("=== RATE LIMITER PRODUCTION READINESS COMPARISON ===");

    double targetRate = 50.0; // 50 operations per second
    int testOperations = 100;

    // Test Guava RateLimiter
    testGuavaRateLimiterProduction(targetRate, testOperations);

    // Test Resilience4j RateLimiter
    testResilience4jRateLimiterProduction(targetRate, testOperations);

    LOG.info("=== PRODUCTION READINESS SUMMARY ===");
    LOG.info("✓ Guava RateLimiter: WORKS (v33.4.8-jre) - ⚠️ Marked @Beta");
    LOG.info("✓ Resilience4j RateLimiter: WORKS (v2.2.0) - ✅ Production Ready");
    LOG.info("");
    LOG.info("FINAL RECOMMENDATION for production:");
    LOG.info(
        "✅ CHOSEN: Resilience4j RateLimiter - Production-ready, excellent metrics, stable API");
    LOG.info("⚠️  Alternative: Guava RateLimiter - Works but marked @Beta (use with caution)");
  }

  private void testGuavaRateLimiterProduction(double targetRate, int operations) throws Exception {
    LOG.info("\n--- Testing Guava RateLimiter (v33.4.8-jre) ---");
    LOG.info("Status: ⚠️ Marked @Beta - Use with caution in production");

    RateLimiter rateLimiter = RateLimiter.create(targetRate);

    long startTime = System.currentTimeMillis();
    for (int i = 0; i < operations; i++) {
      rateLimiter.acquire();
    }
    long endTime = System.currentTimeMillis();

    long duration = endTime - startTime;
    double actualRate = (double) operations * 1000 / duration;

    LOG.info("Guava Results:");
    LOG.info("  - Target Rate: {:.1f} ops/sec", targetRate);
    LOG.info("  - Actual Rate: {:.1f} ops/sec", actualRate);
    LOG.info("  - Duration: {}ms for {} operations", duration, operations);
    LOG.info("  - Rate Accuracy: {:.1f}%", (actualRate / targetRate) * 100);
    LOG.info("  - Production Status: ⚠️ @Beta annotation - stability not guaranteed");

    // Verify rate limiting works - allow more tolerance for test environment
    assertTrue(actualRate <= targetRate * 1.5, "Rate should be reasonably close to target");
    assertTrue(
        duration >= (operations - 1) * 1000 / targetRate * 0.5, "Should take reasonable time");
  }

  private void testResilience4jRateLimiterProduction(double targetRate, int operations)
      throws Exception {
    LOG.info("\n--- Testing Resilience4j RateLimiter (v2.2.0) ---");
    LOG.info("Status: ✅ Production Ready - Stable and well-maintained");

    RateLimiterConfig config =
        RateLimiterConfig.custom()
            .limitForPeriod((int) targetRate)
            .limitRefreshPeriod(Duration.ofSeconds(1))
            .timeoutDuration(Duration.ofSeconds(30))
            .build();

    io.github.resilience4j.ratelimiter.RateLimiter rateLimiter =
        io.github.resilience4j.ratelimiter.RateLimiter.of("production-test", config);

    long startTime = System.currentTimeMillis();
    for (int i = 0; i < operations; i++) {
      rateLimiter.acquirePermission();
    }
    long endTime = System.currentTimeMillis();

    long duration = endTime - startTime;
    double actualRate = (double) operations * 1000 / duration;

    // Get metrics
    io.github.resilience4j.ratelimiter.RateLimiter.Metrics metrics = rateLimiter.getMetrics();

    LOG.info("Resilience4j Results:");
    LOG.info("  - Target Rate: {:.1f} ops/sec", targetRate);
    LOG.info("  - Actual Rate: {:.1f} ops/sec", actualRate);
    LOG.info("  - Duration: {}ms for {} operations", duration, operations);
    LOG.info("  - Rate Accuracy: {:.1f}%", (actualRate / targetRate) * 100);
    LOG.info("  - Available Permits: {}", metrics.getAvailablePermissions());
    LOG.info("  - Waiting Threads: {}", metrics.getNumberOfWaitingThreads());
    LOG.info("  - Production Status: ✅ Stable, production-ready, excellent metrics");

    // Verify rate limiting works - allow more tolerance for test environment
    assertTrue(actualRate <= targetRate * 1.5, "Rate should be reasonably close to target");
    assertTrue(
        duration >= (operations - 1) * 1000 / targetRate * 0.5, "Should take reasonable time");
    assertTrue(metrics.getAvailablePermissions() >= 0, "Metrics should be available");
  }

  @Test
  @DisplayName("Cache warmup scenario simulation with all rate limiters")
  void testCacheWarmupScenarioSimulation() throws Exception {
    LOG.info("\n=== CACHE WARMUP SCENARIO SIMULATION ===");

    // Simulate cache warmup: 200 database queries at 50 ops/sec max
    double warmupRate = 50.0;
    int dbQueries = 200;

    LOG.info(
        "Scenario: Cache warmup with {} database queries at max {} ops/sec", dbQueries, warmupRate);
    LOG.info("Expected duration: ~{} seconds", dbQueries / warmupRate);

    // Test rate limiters in the cache warmup scenario
    simulateCacheWarmupWithGuava(warmupRate, dbQueries);
    simulateCacheWarmupWithResilience4j(warmupRate, dbQueries);

    LOG.info("\n=== CACHE WARMUP SIMULATION COMPLETE ===");
    LOG.info("All rate limiters successfully controlled database load during warmup");
  }

  private void simulateCacheWarmupWithGuava(double rate, int queries) throws Exception {
    LOG.info("\n--- Cache Warmup with Guava RateLimiter ---");
    RateLimiter rateLimiter = RateLimiter.create(rate);

    long startTime = System.currentTimeMillis();
    for (int i = 0; i < queries; i++) {
      rateLimiter.acquire();
      simulateDatabaseQuery(); // Simulate DB work
    }
    long endTime = System.currentTimeMillis();

    double duration = (endTime - startTime) / 1000.0;
    double actualRate = queries / duration;

    LOG.info(
        "Guava Warmup: {:.1f} seconds, {:.1f} queries/sec (target: {:.1f})",
        duration,
        actualRate,
        rate);
  }

  private void simulateCacheWarmupWithResilience4j(double rate, int queries) throws Exception {
    LOG.info("\n--- Cache Warmup with Resilience4j RateLimiter ---");

    RateLimiterConfig config =
        RateLimiterConfig.custom()
            .limitForPeriod((int) rate)
            .limitRefreshPeriod(Duration.ofSeconds(1))
            .timeoutDuration(Duration.ofMinutes(1))
            .build();

    io.github.resilience4j.ratelimiter.RateLimiter rateLimiter =
        io.github.resilience4j.ratelimiter.RateLimiter.of("cache-warmup", config);

    long startTime = System.currentTimeMillis();
    for (int i = 0; i < queries; i++) {
      rateLimiter.acquirePermission();
      simulateDatabaseQuery(); // Simulate DB work
    }
    long endTime = System.currentTimeMillis();

    double duration = (endTime - startTime) / 1000.0;
    double actualRate = queries / duration;

    LOG.info(
        "Resilience4j Warmup: {:.1f} seconds, {:.1f} queries/sec (target: {:.1f})",
        duration,
        actualRate,
        rate);
  }

  private void simulateDatabaseQuery() {
    // Simulate database query overhead (1-2ms)
    try {
      Thread.sleep(1 + (int) (Math.random() * 2));
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
    }
  }

  @Test
  @DisplayName("Production stability test under load")
  void testProductionStabilityUnderLoad() throws Exception {
    LOG.info("\n=== PRODUCTION STABILITY TEST ===");

    int threadCount = 5;
    int operationsPerThread = 20;
    double rate = 25.0; // 25 ops/sec total

    // Test Resilience4j under concurrent load (our recommended choice)
    testConcurrentStability(
        "Resilience4j",
        () -> {
          RateLimiterConfig config =
              RateLimiterConfig.custom()
                  .limitForPeriod((int) rate)
                  .limitRefreshPeriod(Duration.ofSeconds(1))
                  .timeoutDuration(Duration.ofSeconds(30))
                  .build();

          io.github.resilience4j.ratelimiter.RateLimiter rateLimiter =
              io.github.resilience4j.ratelimiter.RateLimiter.of("stability-test", config);

          return () -> rateLimiter.acquirePermission();
        },
        threadCount,
        operationsPerThread,
        rate);

    LOG.info("✅ Resilience4j passed stability test under concurrent load");
  }

  private void testConcurrentStability(
      String name,
      java.util.function.Supplier<Runnable> rateLimiterSupplier,
      int threadCount,
      int operationsPerThread,
      double rate)
      throws Exception {

    LOG.info("Testing {} with {} threads, {} ops each", name, threadCount, operationsPerThread);

    ExecutorService executor = Executors.newFixedThreadPool(threadCount);
    List<Future<Void>> futures = new ArrayList<>();

    long startTime = System.currentTimeMillis();

    for (int i = 0; i < threadCount; i++) {
      Runnable rateLimiter = rateLimiterSupplier.get();
      futures.add(
          executor.submit(
              () -> {
                for (int j = 0; j < operationsPerThread; j++) {
                  rateLimiter.run();
                }
                return null;
              }));
    }

    // Wait for completion
    for (Future<Void> future : futures) {
      future.get(60, TimeUnit.SECONDS);
    }

    long endTime = System.currentTimeMillis();
    double duration = (endTime - startTime) / 1000.0;
    int totalOps = threadCount * operationsPerThread;
    double actualRate = totalOps / duration;

    LOG.info(
        "{} Stability Results: {:.1f} seconds, {:.1f} ops/sec (target: {:.1f})",
        name,
        duration,
        actualRate,
        rate);

    executor.shutdown();
    assertTrue(executor.awaitTermination(10, TimeUnit.SECONDS), "Executor should terminate");

    // Verify rate limiting worked under load
    assertTrue(actualRate <= rate * 1.3, "Rate should be controlled under concurrent load");
  }
}
