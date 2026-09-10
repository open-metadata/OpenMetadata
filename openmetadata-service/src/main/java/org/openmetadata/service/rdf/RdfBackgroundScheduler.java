/*
 *  Copyright 2026 Collate
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
package org.openmetadata.service.rdf;

import io.dropwizard.lifecycle.Managed;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.ScheduledThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import lombok.extern.slf4j.Slf4j;

/** Shared pool with enough workers to keep one slow RDF maintenance task from stalling all polls. */
@Slf4j
public final class RdfBackgroundScheduler implements Managed {
  static final int DEFAULT_POOL_SIZE = 3;
  private static final long SHUTDOWN_TIMEOUT_SECONDS = 5;
  private static final RdfBackgroundScheduler INSTANCE =
      new RdfBackgroundScheduler(DEFAULT_POOL_SIZE);

  private final int poolSize;
  private ScheduledThreadPoolExecutor executor;

  RdfBackgroundScheduler(int poolSize) {
    if (poolSize < 1) {
      throw new IllegalArgumentException("RDF background scheduler pool size must be positive");
    }
    this.poolSize = poolSize;
  }

  public static RdfBackgroundScheduler getInstance() {
    return INSTANCE;
  }

  @Override
  public synchronized void start() {
    getOrCreateExecutor();
    LOG.info("RDF background scheduler started with {} workers", poolSize);
  }

  public synchronized ScheduledFuture<?> scheduleWithFixedDelay(
      Runnable task, long initialDelay, long delay, TimeUnit unit) {
    return getOrCreateExecutor().scheduleWithFixedDelay(task, initialDelay, delay, unit);
  }

  @Override
  public void stop() {
    ScheduledThreadPoolExecutor activeExecutor = detachExecutor();
    if (activeExecutor == null) {
      return;
    }
    activeExecutor.shutdown();
    awaitTermination(activeExecutor);
    LOG.info("RDF background scheduler stopped");
  }

  private synchronized ScheduledThreadPoolExecutor getOrCreateExecutor() {
    if (executor == null || executor.isShutdown()) {
      executor = createExecutor();
    }
    return executor;
  }

  private ScheduledThreadPoolExecutor createExecutor() {
    ScheduledThreadPoolExecutor created =
        new ScheduledThreadPoolExecutor(
            poolSize, Thread.ofPlatform().daemon().name("rdf-background-", 0).factory());
    created.setRemoveOnCancelPolicy(true);
    created.setExecuteExistingDelayedTasksAfterShutdownPolicy(false);
    created.setContinueExistingPeriodicTasksAfterShutdownPolicy(false);
    return created;
  }

  private synchronized ScheduledThreadPoolExecutor detachExecutor() {
    ScheduledThreadPoolExecutor activeExecutor = executor;
    executor = null;
    return activeExecutor;
  }

  private void awaitTermination(ScheduledThreadPoolExecutor activeExecutor) {
    try {
      if (!activeExecutor.awaitTermination(SHUTDOWN_TIMEOUT_SECONDS, TimeUnit.SECONDS)) {
        activeExecutor.shutdownNow();
      }
    } catch (InterruptedException e) {
      activeExecutor.shutdownNow();
      Thread.currentThread().interrupt();
    }
  }
}
