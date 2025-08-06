/*
 *  Copyright 2024 Collate.
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
package org.openmetadata.service.security.auth;

import static org.openmetadata.service.Entity.USER;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.locks.ReadWriteLock;
import java.util.concurrent.locks.ReentrantReadWriteLock;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.UserRepository;

/**
 * Distributed user activity tracker that works across multiple web servers.
 * Uses Java 21 virtual threads for efficient concurrent processing.
 * Design considerations:
 * 1. Each server tracks its own activity in memory
 * 2. Periodic batch updates to database (eventual consistency)
 * 3. Database acts as the source of truth for activity across all servers
 * 4. Virtual threads with semaphore to limit concurrent DB operations
 */
@Slf4j
public class UserActivityTracker {
  private final Map<String, UserActivity> localActivityCache = new ConcurrentHashMap<>();
  private final ReadWriteLock cacheLock = new ReentrantReadWriteLock();
  private final Semaphore dbOperationPermits;

  private final long minUpdateIntervalMs;
  private final long batchUpdateIntervalSeconds;

  private final ScheduledExecutorService scheduler =
      Executors.newSingleThreadScheduledExecutor(
          r -> Thread.ofPlatform().name("UserActivityTracker-Scheduler").daemon(true).unstarted(r));

  private final ScheduledExecutorService virtualThreadExecutor =
      Executors.newScheduledThreadPool(
          0, r -> Thread.ofVirtual().name("UserActivityTracker-VirtualThread-", 0).unstarted(r));

  private volatile UserRepository userRepository;

  private static volatile UserActivityTracker INSTANCE;

  private UserActivityTracker() {
    this.minUpdateIntervalMs = 60000;
    this.batchUpdateIntervalSeconds = 30;
    int maxConcurrentDbOperations = 10;
    this.dbOperationPermits = new Semaphore(maxConcurrentDbOperations);
  }

  public static UserActivityTracker getInstance() {
    if (INSTANCE == null) {
      synchronized (UserActivityTracker.class) {
        if (INSTANCE == null) {
          INSTANCE = new UserActivityTracker();
          INSTANCE.initialize();
        }
      }
    }
    return INSTANCE;
  }

  private void initialize() {
    scheduler.scheduleWithFixedDelay(
        this::performBatchUpdate,
        batchUpdateIntervalSeconds,
        batchUpdateIntervalSeconds,
        TimeUnit.SECONDS);
    LOG.debug(
        "UserActivityTracker initialized with batch interval: {}s", batchUpdateIntervalSeconds);
  }

  public void shutdown() {
    LOG.info("Shutting down UserActivityTracker...");
    scheduler.shutdown();
    virtualThreadExecutor.shutdown();
    try {
      performBatchUpdate();
    } catch (Exception e) {
      LOG.error("Error during final batch update", e);
    }
    try {
      if (!scheduler.awaitTermination(5, TimeUnit.SECONDS)) {
        scheduler.shutdownNow();
      }
      if (!virtualThreadExecutor.awaitTermination(10, TimeUnit.SECONDS)) {
        virtualThreadExecutor.shutdownNow();
      }
    } catch (InterruptedException e) {
      scheduler.shutdownNow();
      virtualThreadExecutor.shutdownNow();
      Thread.currentThread().interrupt();
    }
  }

  public void trackActivity(String userName) {
    if (userName == null || userName.isEmpty()) {
      return;
    }

    long currentTime = System.currentTimeMillis();
    cacheLock.readLock().lock();
    try {
      UserActivity existing = localActivityCache.get(userName);
      if (existing != null && (currentTime - existing.lastLocalUpdate) < minUpdateIntervalMs) {
        return;
      }
    } finally {
      cacheLock.readLock().unlock();
    }

    cacheLock.writeLock().lock();
    try {
      localActivityCache.compute(
          userName,
          (k, v) -> {
            if (v == null) {
              return new UserActivity(userName, currentTime, currentTime);
            } else if ((currentTime - v.lastLocalUpdate) >= minUpdateIntervalMs) {
              v.lastActivityTime = currentTime;
              v.lastLocalUpdate = currentTime;
            }
            return v;
          });
    } finally {
      cacheLock.writeLock().unlock();
    }
  }

  private void performBatchUpdate() {
    Map<String, Long> userActivityMap;

    cacheLock.writeLock().lock();
    try {
      if (localActivityCache.isEmpty()) {
        return;
      }

      userActivityMap = new HashMap<>();
      localActivityCache.forEach(
          (userName, activity) -> userActivityMap.put(userName, activity.lastActivityTime));
      localActivityCache.clear();
    } finally {
      cacheLock.writeLock().unlock();
    }
    virtualThreadExecutor.execute(() -> performBulkDatabaseUpdate(userActivityMap));
  }

  private void performBulkDatabaseUpdate(Map<String, Long> userActivityMap) {
    LOG.debug("performBulkDatabaseUpdate called with {} users", userActivityMap.size());
    try {
      if (!dbOperationPermits.tryAcquire(5, TimeUnit.SECONDS)) {
        LOG.warn("Timeout waiting for DB operation permit for bulk update");
        reAddAllToCache(userActivityMap);
        return;
      }

      try {
        getUserRepository().updateUsersLastActivityTimeBatch(userActivityMap);
      } finally {
        dbOperationPermits.release();
      }

    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      LOG.error("Interrupted during bulk activity update", e);
      reAddAllToCache(userActivityMap);
    } catch (Exception e) {
      LOG.error("Failed to perform bulk activity update", e);
      reAddAllToCache(userActivityMap);
    }
  }

  private void reAddAllToCache(Map<String, Long> userActivityMap) {
    cacheLock.writeLock().lock();
    try {
      userActivityMap.forEach(
          (userName, lastActivityTime) ->
              localActivityCache.putIfAbsent(
                  userName,
                  new UserActivity(userName, lastActivityTime, System.currentTimeMillis())));
    } finally {
      cacheLock.writeLock().unlock();
    }
  }

  private UserRepository getUserRepository() {
    if (userRepository == null) {
      synchronized (this) {
        if (userRepository == null) {
          userRepository = (UserRepository) Entity.getEntityRepository(USER);
        }
      }
    }
    return userRepository;
  }

  private static class UserActivity {
    String userName;
    long lastActivityTime;
    long lastLocalUpdate;

    UserActivity(String userName, long lastActivityTime, long lastLocalUpdate) {
      this.userName = userName;
      this.lastActivityTime = lastActivityTime;
      this.lastLocalUpdate = lastLocalUpdate;
    }
  }

  public int getLocalCacheSize() {
    cacheLock.readLock().lock();
    try {
      return localActivityCache.size();
    } finally {
      cacheLock.readLock().unlock();
    }
  }

  public void forceFlushSync() throws InterruptedException {
    Map<String, Long> userActivityMap;

    cacheLock.writeLock().lock();
    try {
      if (localActivityCache.isEmpty()) {
        return;
      }
      userActivityMap = new HashMap<>();
      localActivityCache.forEach(
          (userName, activity) -> userActivityMap.put(userName, activity.lastActivityTime));
      localActivityCache.clear();
    } finally {
      cacheLock.writeLock().unlock();
    }
    CompletableFuture<Void> future =
        CompletableFuture.runAsync(
            () -> performBulkDatabaseUpdate(userActivityMap), virtualThreadExecutor);

    try {
      future.get(10, TimeUnit.SECONDS);
    } catch (ExecutionException | TimeoutException e) {
      LOG.error("Error during synchronous flush", e);
      throw new RuntimeException("Failed to flush user activities", e);
    }
  }
}
