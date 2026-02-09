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
 * Manages bulk operations with a bounded thread pool and admission control.
 *
 * <p>Key guarantees:
 *
 * <ul>
 *   <li>Once a request is accepted, it will complete (never fails due to resource unavailability)
 *   <li>Admission control rejects requests with 503 when queue is full
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

    this.executor =
        new ThreadPoolExecutor(
            maxThreads,
            maxThreads,
            60L,
            TimeUnit.SECONDS,
            new ArrayBlockingQueue<>(queueSize),
            r -> {
              Thread t = new Thread(r, "bulk-operation-worker");
              t.setDaemon(true);
              return t;
            },
            new ThreadPoolExecutor.AbortPolicy());

    LOG.info("BulkExecutor initialized: threads={}, queue={}", maxThreads, queueSize);

    registerShutdownHook();
  }

  private static void registerShutdownHook() {
    if (shutdownHookRegistered.compareAndSet(false, true)) {
      Runtime.getRuntime()
          .addShutdownHook(
              new Thread(
                  () -> {
                    if (instance != null && !instance.isShutdown) {
                      instance.shutdown();
                    }
                  },
                  "bulk-executor-shutdown-hook"));
    }
  }

  public static void initialize(BulkOperationConfiguration config) {
    if (instance == null) {
      synchronized (LOCK) {
        if (instance == null) {
          instance = new BulkExecutor(config);
        }
      }
    }
  }

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

  public static void reset() {
    synchronized (LOCK) {
      if (instance != null) {
        instance.isShutdown = true;
        instance.executor.shutdownNow();
        instance = null;
      }
    }
  }

  public boolean hasCapacity() {
    if (executor instanceof ThreadPoolExecutor tpe) {
      return tpe.getQueue().remainingCapacity() > 0;
    }
    return true;
  }

  public boolean hasCapacityForBatch(int batchSize) {
    if (executor instanceof ThreadPoolExecutor tpe) {
      return tpe.getQueue().remainingCapacity() >= batchSize;
    }
    return true;
  }

  public int getQueueDepth() {
    if (executor instanceof ThreadPoolExecutor tpe) {
      return tpe.getQueue().size();
    }
    return 0;
  }

  public int getActiveCount() {
    if (executor instanceof ThreadPoolExecutor tpe) {
      return tpe.getActiveCount();
    }
    return 0;
  }

  public void submit(Runnable task) throws RejectedExecutionException {
    if (isShutdown) {
      throw new RejectedExecutionException("BulkExecutor is shut down");
    }
    executor.execute(task);
  }

  public Future<?> submitWithFuture(Runnable task) throws RejectedExecutionException {
    if (isShutdown) {
      throw new RejectedExecutionException("BulkExecutor is shut down");
    }
    return executor.submit(task);
  }

  public boolean isShutdown() {
    return isShutdown;
  }

  public String getStats() {
    return String.format(
        "BulkExecutor[threads=%d, active=%d, queued=%d]",
        maxThreads, getActiveCount(), getQueueDepth());
  }

  public void shutdown() {
    if (isShutdown) {
      return;
    }
    isShutdown = true;
    LOG.info("Shutting down BulkExecutor...");
    executor.shutdown();
    try {
      if (!executor.awaitTermination(timeoutSeconds, TimeUnit.SECONDS)) {
        LOG.warn("BulkExecutor did not terminate in {}s, forcing shutdown", timeoutSeconds);
        executor.shutdownNow();
      }
    } catch (InterruptedException e) {
      executor.shutdownNow();
      Thread.currentThread().interrupt();
    }
  }
}
