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

import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Future;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.config.BulkOperationConfiguration;

/**
 * Manages a bounded thread pool for bulk operations. This provides natural backpressure and
 * prevents bulk operations from overwhelming the database connection pool.
 *
 * <p>Key design decisions:
 *
 * <ul>
 *   <li>Bounded thread pool limits concurrent DB operations directly
 *   <li>Bounded queue prevents memory exhaustion from too many pending tasks
 *   <li>Rejected execution throws exception so caller can return 503
 *   <li>Virtual threads are NOT used here because we need bounded concurrency
 * </ul>
 */
@Slf4j
public class BulkExecutor {

  private static volatile BulkExecutor instance;
  private static final Object LOCK = new Object();
  private static final AtomicBoolean shutdownHookRegistered = new AtomicBoolean(false);

  @Getter private final ExecutorService executor;
  @Getter private final int maxThreads;
  @Getter private final int queueSize;
  @Getter private final int timeoutSeconds;
  private volatile boolean isShutdown = false;

  private BulkExecutor(BulkOperationConfiguration config) {
    this.maxThreads = config.getMaxThreads();
    this.queueSize = config.getQueueSize();
    this.timeoutSeconds = config.getTimeoutSeconds();

    // Create a bounded thread pool with a bounded queue
    // When queue is full, new submissions will throw RejectedExecutionException
    this.executor =
        new ThreadPoolExecutor(
            maxThreads, // core pool size
            maxThreads, // max pool size (same as core for predictable behavior)
            60L,
            TimeUnit.SECONDS, // idle thread timeout
            new ArrayBlockingQueue<>(queueSize), // bounded queue
            r -> {
              Thread t = new Thread(r, "bulk-operation-worker");
              t.setDaemon(true);
              return t;
            },
            new ThreadPoolExecutor.AbortPolicy() // throw on rejection
            );

    LOG.info(
        "BulkExecutor initialized: maxThreads={}, queueSize={}, timeoutSeconds={}",
        maxThreads,
        queueSize,
        timeoutSeconds);

    registerShutdownHook();
  }

  private static void registerShutdownHook() {
    if (shutdownHookRegistered.compareAndSet(false, true)) {
      Runtime.getRuntime()
          .addShutdownHook(
              new Thread(
                  () -> {
                    LOG.info("JVM shutdown detected, shutting down BulkExecutor gracefully...");
                    if (instance != null && !instance.isShutdown) {
                      instance.shutdown();
                    }
                  },
                  "bulk-executor-shutdown-hook"));
    }
  }

  /** Initialize with configuration. Should be called during application startup. */
  public static void initialize(BulkOperationConfiguration config) {
    if (instance == null) {
      synchronized (LOCK) {
        if (instance == null) {
          instance = new BulkExecutor(config);
        }
      }
    }
  }

  /** Get the singleton instance. Creates with defaults if not initialized. */
  public static BulkExecutor getInstance() {
    if (instance == null) {
      synchronized (LOCK) {
        if (instance == null) {
          LOG.warn("BulkExecutor not initialized, using defaults");
          instance = new BulkExecutor(new BulkOperationConfiguration());
        }
      }
    }
    return instance;
  }

  /** Reset the singleton (for testing). */
  public static void reset() {
    synchronized (LOCK) {
      if (instance != null) {
        instance.isShutdown = true;
        instance.executor.shutdownNow();
        instance = null;
      }
    }
  }

  /**
   * Check if the executor can accept more work.
   *
   * @return true if queue has capacity
   */
  public boolean hasCapacity() {
    if (executor instanceof ThreadPoolExecutor tpe) {
      return tpe.getQueue().remainingCapacity() > 0;
    }
    return true;
  }

  /**
   * Get current queue depth.
   *
   * @return number of tasks waiting in queue
   */
  public int getQueueDepth() {
    if (executor instanceof ThreadPoolExecutor tpe) {
      return tpe.getQueue().size();
    }
    return 0;
  }

  /**
   * Get number of currently active threads.
   *
   * @return active thread count
   */
  public int getActiveCount() {
    if (executor instanceof ThreadPoolExecutor tpe) {
      return tpe.getActiveCount();
    }
    return 0;
  }

  /**
   * Submit a task for execution. Throws RejectedExecutionException if queue is full.
   *
   * @param task the task to execute
   * @throws RejectedExecutionException if the queue is full
   */
  public void submit(Runnable task) throws RejectedExecutionException {
    if (isShutdown) {
      throw new RejectedExecutionException("BulkExecutor is shut down");
    }
    executor.execute(task);
  }

  /**
   * Submit a task for execution and return a Future that can be used to cancel the task.
   *
   * @param task the task to execute
   * @return a Future representing the pending task
   * @throws RejectedExecutionException if the queue is full
   */
  public Future<?> submitWithFuture(Runnable task) throws RejectedExecutionException {
    if (isShutdown) {
      throw new RejectedExecutionException("BulkExecutor is shut down");
    }
    return executor.submit(task);
  }

  /** Check if the executor has been shut down. */
  public boolean isShutdown() {
    return isShutdown;
  }

  /** Graceful shutdown with configurable timeout. */
  public void shutdown() {
    if (isShutdown) {
      return;
    }
    isShutdown = true;
    LOG.info("Shutting down BulkExecutor, waiting for pending tasks to complete...");
    executor.shutdown();
    try {
      if (!executor.awaitTermination(timeoutSeconds, TimeUnit.SECONDS)) {
        LOG.warn(
            "BulkExecutor did not terminate within {} seconds, forcing shutdown", timeoutSeconds);
        executor.shutdownNow();
      } else {
        LOG.info("BulkExecutor shut down gracefully");
      }
    } catch (InterruptedException e) {
      LOG.warn("BulkExecutor shutdown interrupted, forcing shutdown");
      executor.shutdownNow();
      Thread.currentThread().interrupt();
    }
  }
}
