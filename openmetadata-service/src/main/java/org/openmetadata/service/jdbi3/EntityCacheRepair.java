/*
 *  Copyright 2026 Collate.
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

import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.tuple.ImmutablePair;

/**
 * Deferred re-eviction of the in-JVM entity caches ({@link EntityRepository#CACHE_WITH_ID} and
 * {@link EntityRepository#CACHE_WITH_NAME}). Backstops the nanosecond race where a cache loader's
 * put lands after the writer's inline invalidate: a short while after every write, the touched keys
 * are invalidated again so any racing stale put is evicted.
 */
@Slf4j
public final class EntityCacheRepair {
  private static final long REPAIR_DELAY_MS = 500L;

  private static volatile ScheduledExecutorService executor = createExecutor();

  // Coalescing guard. Without this, bulk writes can enqueue thousands of pending repair tasks
  // per key (one per write). One pending task per key is sufficient to evict any racing loader's
  // put — repeated bumps within the delay window collapse to a single eviction.
  private static final Set<Object> PENDING_REPAIRS = ConcurrentHashMap.newKeySet();

  private EntityCacheRepair() {}

  private record RepairRequest(String entityType, UUID id, String fqn, String originalFqn) {
    // Includes fqn so a rename within the delay window gets its own task instead of being
    // coalesced into a prior task that only knows the old fqn.
    Object coalesceKey() {
      return List.of(entityType, id == null ? "" : id.toString(), fqn == null ? "" : fqn);
    }
  }

  static void scheduleRepair(String entityType, UUID id, String fqn, String originalFqn) {
    ScheduledExecutorService current = executor;
    if (entityType != null && !current.isShutdown()) {
      RepairRequest request = new RepairRequest(entityType, id, fqn, originalFqn);
      if (PENDING_REPAIRS.add(request.coalesceKey())) {
        submit(current, request);
      }
    }
  }

  private static void submit(ScheduledExecutorService current, RepairRequest request) {
    try {
      current.schedule(() -> repair(request), REPAIR_DELAY_MS, TimeUnit.MILLISECONDS);
    } catch (RejectedExecutionException e) {
      PENDING_REPAIRS.remove(request.coalesceKey());
      LOG.debug(
          "Failed to schedule entity cache repair type={} id={}",
          request.entityType(),
          request.id(),
          e);
    }
  }

  private static void repair(RepairRequest request) {
    // Clear at task start so a writer arriving during the invalidates re-schedules its own task
    // and gets the full delay-window backstop.
    PENDING_REPAIRS.remove(request.coalesceKey());
    try {
      if (request.id() != null) {
        EntityRepository.CACHE_WITH_ID.invalidate(
            new ImmutablePair<>(request.entityType(), request.id()));
      }
      if (request.fqn() != null) {
        EntityRepository.CACHE_WITH_NAME.invalidate(
            EntityRepository.cacheNameKey(request.entityType(), request.fqn()));
      }
      if (request.originalFqn() != null && !request.originalFqn().equals(request.fqn())) {
        EntityRepository.CACHE_WITH_NAME.invalidate(
            EntityRepository.cacheNameKey(request.entityType(), request.originalFqn()));
      }
    } catch (RuntimeException e) {
      LOG.debug(
          "Deferred entity cache repair failed for type={} id={} fqn={}",
          request.entityType(),
          request.id(),
          request.fqn(),
          e);
    }
  }

  private static ScheduledExecutorService createExecutor() {
    return Executors.newScheduledThreadPool(
        2,
        r -> {
          Thread thread = new Thread(r, "entity-cache-repair");
          thread.setDaemon(true);
          return thread;
        });
  }

  public static synchronized void start() {
    if (executor.isShutdown() || executor.isTerminated()) {
      PENDING_REPAIRS.clear();
      executor = createExecutor();
    }
  }

  public static synchronized void shutdown() {
    ScheduledExecutorService current = executor;
    current.shutdown();
    try {
      if (!current.awaitTermination(2, TimeUnit.SECONDS)) {
        current.shutdownNow();
      }
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      current.shutdownNow();
    } finally {
      PENDING_REPAIRS.clear();
    }
  }
}
