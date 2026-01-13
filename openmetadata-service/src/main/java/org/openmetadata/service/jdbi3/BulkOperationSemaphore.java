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

import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.config.BulkOperationConfiguration;

/**
 * Manages concurrent database operations during bulk processing using a semaphore. This prevents
 * bulk operations from exhausting the connection pool and starving regular API requests.
 *
 * <p>The semaphore limits the number of concurrent DB operations, not threads. Virtual threads are
 * cheap and unlimited; DB connections are the limited resource we need to protect.
 */
@Slf4j
public class BulkOperationSemaphore {

  private static volatile BulkOperationSemaphore instance;
  private static final Object LOCK = new Object();

  private final Semaphore semaphore;
  private final int maxPermits;
  private final long acquireTimeoutMs;

  private BulkOperationSemaphore(int maxConcurrentOperations, long acquireTimeoutMs) {
    this.maxPermits = maxConcurrentOperations;
    this.acquireTimeoutMs = acquireTimeoutMs;
    this.semaphore = new Semaphore(maxConcurrentOperations, true); // Fair ordering
    LOG.info(
        "BulkOperationSemaphore initialized with {} permits, timeout {}ms",
        maxConcurrentOperations,
        acquireTimeoutMs);
  }

  /**
   * Initialize the singleton with configuration. Should be called during application startup.
   *
   * @param config the bulk operation configuration
   * @param connectionPoolSize the maximum connection pool size
   */
  public static void initialize(BulkOperationConfiguration config, int connectionPoolSize) {
    if (instance == null) {
      synchronized (LOCK) {
        if (instance == null) {
          int maxOperations = calculateMaxOperations(config, connectionPoolSize);
          instance = new BulkOperationSemaphore(maxOperations, config.getAcquireTimeoutMs());
        }
      }
    }
  }

  /**
   * Initialize with explicit values (useful for testing or when config is not available).
   *
   * @param maxConcurrentOperations maximum concurrent DB operations
   * @param acquireTimeoutMs timeout for acquiring permits
   */
  public static void initialize(int maxConcurrentOperations, long acquireTimeoutMs) {
    if (instance == null) {
      synchronized (LOCK) {
        if (instance == null) {
          instance = new BulkOperationSemaphore(maxConcurrentOperations, acquireTimeoutMs);
        }
      }
    }
  }

  /** Reset the singleton (primarily for testing). */
  public static void reset() {
    synchronized (LOCK) {
      instance = null;
    }
  }

  /**
   * Get the singleton instance. If not initialized, creates with default values.
   *
   * @return the singleton instance
   */
  public static BulkOperationSemaphore getInstance() {
    if (instance == null) {
      synchronized (LOCK) {
        if (instance == null) {
          // Default initialization if not explicitly configured
          LOG.warn(
              "BulkOperationSemaphore not initialized, using defaults: 10 permits, 30s timeout");
          instance = new BulkOperationSemaphore(10, 30000);
        }
      }
    }
    return instance;
  }

  private static int calculateMaxOperations(
      BulkOperationConfiguration config, int connectionPoolSize) {
    if (config.isAutoScale()) {
      // Calculate based on connection pool size
      // bulkConnectionPercentage is what bulk operations get (rest is for user traffic)
      int bulkPercentage = config.getBulkConnectionPercentage();
      int calculated = (connectionPoolSize * bulkPercentage) / 100;

      // Ensure at least 1 and at most the configured max
      calculated = Math.max(1, calculated);
      calculated = Math.min(calculated, config.getMaxConcurrentDbOperations());

      LOG.info(
          "Auto-scaled bulk operations: poolSize={}, bulkAllocation={}%, calculated={}, "
              + "reservedForUserTraffic={}%",
          connectionPoolSize, bulkPercentage, calculated, 100 - bulkPercentage);
      return calculated;
    } else {
      LOG.info("Using fixed bulk operation limit: {}", config.getMaxConcurrentDbOperations());
      return config.getMaxConcurrentDbOperations();
    }
  }

  /**
   * Acquire a permit for a bulk database operation. Blocks until a permit is available or timeout
   * occurs.
   *
   * @throws TimeoutException if permit cannot be acquired within timeout
   * @throws InterruptedException if thread is interrupted while waiting
   */
  public void acquire() throws TimeoutException, InterruptedException {
    boolean acquired = semaphore.tryAcquire(acquireTimeoutMs, TimeUnit.MILLISECONDS);
    if (!acquired) {
      throw new TimeoutException(
          String.format(
              "Failed to acquire bulk operation permit within %dms. "
                  + "System is under heavy load. Available permits: %d/%d",
              acquireTimeoutMs, semaphore.availablePermits(), maxPermits));
    }
    if (LOG.isDebugEnabled()) {
      LOG.debug(
          "Acquired bulk operation permit. Available: {}/{}",
          semaphore.availablePermits(),
          maxPermits);
    }
  }

  /** Release a permit after completing a bulk database operation. */
  public void release() {
    semaphore.release();
    if (LOG.isDebugEnabled()) {
      LOG.debug(
          "Released bulk operation permit. Available: {}/{}",
          semaphore.availablePermits(),
          maxPermits);
    }
  }

  /**
   * Get the number of currently available permits.
   *
   * @return available permits
   */
  public int availablePermits() {
    return semaphore.availablePermits();
  }

  /**
   * Get the maximum number of permits.
   *
   * @return max permits
   */
  public int getMaxPermits() {
    return maxPermits;
  }

  /**
   * Execute a runnable with automatic permit acquisition and release.
   *
   * @param operation the operation to execute
   * @throws TimeoutException if permit cannot be acquired
   * @throws InterruptedException if interrupted while waiting
   */
  public void executeWithPermit(Runnable operation) throws TimeoutException, InterruptedException {
    acquire();
    try {
      operation.run();
    } finally {
      release();
    }
  }

  /**
   * Execute a callable with automatic permit acquisition and release.
   *
   * @param operation the operation to execute
   * @param <T> the return type
   * @return the result of the operation
   * @throws TimeoutException if permit cannot be acquired
   * @throws InterruptedException if interrupted while waiting
   * @throws Exception if the operation throws an exception
   */
  public <T> T executeWithPermit(java.util.concurrent.Callable<T> operation)
      throws TimeoutException, InterruptedException, Exception {
    acquire();
    try {
      return operation.call();
    } finally {
      release();
    }
  }
}
