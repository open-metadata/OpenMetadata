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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.openmetadata.service.util.TestUtils.simulateWork;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.UserRepository;

class UserActivityTrackerTest {

  private UserActivityTracker tracker;
  private UserRepository mockUserRepository;

  @BeforeEach
  void setUp() throws Exception {
    Field instanceField = UserActivityTracker.class.getDeclaredField("INSTANCE");
    instanceField.setAccessible(true);
    instanceField.set(null, null);

    tracker = UserActivityTracker.getInstance();

    // Mock UserRepository
    mockUserRepository = mock(UserRepository.class);
    doNothing().when(mockUserRepository).updateUserLastActivityTime(anyString(), anyLong());
    doNothing().when(mockUserRepository).updateUsersLastActivityTimeBatch(anyMap());

    // Set mock repository
    Field repoField = UserActivityTracker.class.getDeclaredField("userRepository");
    repoField.setAccessible(true);
    repoField.set(tracker, mockUserRepository);
  }

  @AfterEach
  void tearDown() {
    if (tracker != null) {
      tracker.shutdown();
    }
  }

  @Test
  void testTrackActivity() {
    tracker.trackActivity("testUser");
    assertEquals(1, tracker.getLocalCacheSize());
    tracker.trackActivity("testUser");
    assertEquals(1, tracker.getLocalCacheSize());
    tracker.trackActivity("anotherUser");
    assertEquals(2, tracker.getLocalCacheSize());
  }

  @Test
  void testTrackActivityWithNullUser() {
    // Should not track null or empty users
    tracker.trackActivity(null);
    tracker.trackActivity("");

    assertEquals(0, tracker.getLocalCacheSize());
  }

  @Test
  void testBatchUpdate() throws Exception {
    try (MockedStatic<Entity> mockedEntity = Mockito.mockStatic(Entity.class)) {
      mockedEntity
          .when(() -> Entity.getEntityRepository(Entity.USER))
          .thenReturn(mockUserRepository);
      tracker.trackActivity("user1");
      tracker.trackActivity("user2");
      tracker.trackActivity("user3");

      assertEquals(3, tracker.getLocalCacheSize());

      // Use the synchronous flush for testing
      tracker.forceFlushSync();
      verify(mockUserRepository, times(1)).updateUsersLastActivityTimeBatch(anyMap());
      assertEquals(0, tracker.getLocalCacheSize());
    }
  }

  @Test
  void testMinUpdateInterval() throws Exception {
    Field minIntervalField = UserActivityTracker.class.getDeclaredField("minUpdateIntervalMs");
    minIntervalField.setAccessible(true);

    long firstTime = System.currentTimeMillis();
    tracker.trackActivity("user1");

    tracker.trackActivity("user1");
    Field cacheField = UserActivityTracker.class.getDeclaredField("localActivityCache");
    cacheField.setAccessible(true);
    Map<String, ?> cache = (Map<String, ?>) cacheField.get(tracker);
    assertEquals(1, cache.size());
    Object activity = cache.get("user1");
    Field lastActivityTimeField = activity.getClass().getDeclaredField("lastActivityTime");
    lastActivityTimeField.setAccessible(true);
    long activityTime = (long) lastActivityTimeField.get(activity);
    assertTrue(Math.abs(activityTime - firstTime) < 100);
  }

  @Test
  void testTrackActivityUpdatesExistingUserAfterMinInterval() throws Exception {
    tracker.trackActivity("user1");

    Map<String, ?> cache = getCache();
    Object activity = cache.get("user1");
    long previousActivityTime = getActivityField(activity, "lastActivityTime");
    long staleTime = previousActivityTime - TimeUnit.MINUTES.toMillis(2);
    setActivityField(activity, "lastLocalUpdate", staleTime);
    setActivityField(activity, "lastActivityTime", staleTime);

    tracker.trackActivity("user1");

    Object refreshedActivity = getCache().get("user1");
    assertEquals(1, tracker.getLocalCacheSize());
    assertTrue(getActivityField(refreshedActivity, "lastActivityTime") > staleTime);
    assertTrue(getActivityField(refreshedActivity, "lastLocalUpdate") > staleTime);
  }

  @Test
  void testConcurrentTracking() throws Exception {
    // Track activities from multiple threads
    int numThreads = 10;
    int numUsersPerThread = 100;

    Thread[] threads = new Thread[numThreads];
    for (int i = 0; i < numThreads; i++) {
      final int threadId = i;
      threads[i] =
          new Thread(
              () -> {
                for (int j = 0; j < numUsersPerThread; j++) {
                  tracker.trackActivity("user_" + threadId + "_" + j);
                }
              });
    }

    for (Thread t : threads) {
      t.start();
    }

    for (Thread t : threads) {
      t.join();
    }
    assertEquals(numThreads * numUsersPerThread, tracker.getLocalCacheSize());
  }

  @Test
  void testDatabaseUpdateFailure() throws Exception {
    try (MockedStatic<Entity> mockedEntity = Mockito.mockStatic(Entity.class)) {
      mockedEntity
          .when(() -> Entity.getEntityRepository(Entity.USER))
          .thenReturn(mockUserRepository);
      doThrow(new RuntimeException("DB Error"))
          .when(mockUserRepository)
          .updateUsersLastActivityTimeBatch(anyMap());
      tracker.trackActivity("user1");
      tracker.trackActivity("user2");

      // Use the synchronous flush for testing
      tracker.forceFlushSync();
      verify(mockUserRepository, times(1)).updateUsersLastActivityTimeBatch(anyMap());
      assertTrue(tracker.getLocalCacheSize() > 0, "Cache should contain failed updates for retry");
    }
  }

  @Test
  void testMultipleUsersWithDifferentActivityTimes() throws Exception {
    try (MockedStatic<Entity> mockedEntity = Mockito.mockStatic(Entity.class)) {
      mockedEntity
          .when(() -> Entity.getEntityRepository(Entity.USER))
          .thenReturn(mockUserRepository);
      tracker.trackActivity("user1");
      simulateWork(1);

      tracker.trackActivity("user2");
      simulateWork(1);

      tracker.trackActivity("user3");
      simulateWork(1);

      tracker.trackActivity("user1");
      assertEquals(3, tracker.getLocalCacheSize());
      tracker.forceFlushSync();
      verify(mockUserRepository, times(1)).updateUsersLastActivityTimeBatch(anyMap());
      assertEquals(0, tracker.getLocalCacheSize());
    }
  }

  @Test
  void testVerifyCorrectTimestampsAreTracked() throws Exception {
    try (MockedStatic<Entity> mockedEntity = Mockito.mockStatic(Entity.class)) {
      mockedEntity
          .when(() -> Entity.getEntityRepository(Entity.USER))
          .thenReturn(mockUserRepository);

      long time1 = System.currentTimeMillis();
      tracker.trackActivity("alice");
      simulateWork(2);
      long time2 = System.currentTimeMillis();
      tracker.trackActivity("bob");
      simulateWork(2);
      long time3 = System.currentTimeMillis();
      tracker.trackActivity("charlie");
      Field cacheField = UserActivityTracker.class.getDeclaredField("localActivityCache");
      cacheField.setAccessible(true);
      Map<String, ?> cache = (Map<String, ?>) cacheField.get(tracker);

      for (Map.Entry<String, ?> entry : cache.entrySet()) {
        Object activity = entry.getValue();
        Field lastActivityTimeField = activity.getClass().getDeclaredField("lastActivityTime");
        lastActivityTimeField.setAccessible(true);
        long activityTime = (long) lastActivityTimeField.get(activity);

        switch (entry.getKey()) {
          case "alice" -> assertTrue(
              Math.abs(activityTime - time1) < 500,
              "Alice's activity time should be close to time1");
          case "bob" -> assertTrue(
              Math.abs(activityTime - time2) < 500, "Bob's activity time should be close to time2");
          case "charlie" -> assertTrue(
              Math.abs(activityTime - time3) < 500,
              "Charlie's activity time should be close to time3");
        }
      }

      tracker.forceFlushSync();
      verify(mockUserRepository, times(1)).updateUsersLastActivityTimeBatch(anyMap());
    }
  }

  @Test
  void testCountDailyActiveUsers() {
    CollectionDAO.UserDAO mockUserDAO = mock(CollectionDAO.UserDAO.class);
    when(mockUserRepository.getDao()).thenReturn(mockUserDAO);

    long now = System.currentTimeMillis();
    long twentyFourHoursAgo = now - (24 * 60 * 60 * 1000);
    long oneYearAgo = now - (365L * 24 * 60 * 60 * 1000);

    when(mockUserDAO.countDailyActiveUsers(twentyFourHoursAgo)).thenReturn(0);
    int count = mockUserDAO.countDailyActiveUsers(twentyFourHoursAgo);
    assertEquals(0, count, "Should return 0 when no users are active");

    when(mockUserDAO.countDailyActiveUsers(twentyFourHoursAgo)).thenReturn(5);
    count = mockUserDAO.countDailyActiveUsers(twentyFourHoursAgo);
    assertEquals(5, count, "Should return count of active users");

    when(mockUserDAO.countDailyActiveUsers(oneYearAgo)).thenReturn(12);
    count = mockUserDAO.countDailyActiveUsers(oneYearAgo);
    assertEquals(12, count, "Should return all users when querying from far past");

    verify(mockUserDAO, times(2)).countDailyActiveUsers(twentyFourHoursAgo);
    verify(mockUserDAO, times(1)).countDailyActiveUsers(oneYearAgo);
  }

  @Test
  void testForceFlushSkipsDatabaseWhenCacheIsEmpty() {
    tracker.forceFlush();

    verify(mockUserRepository, times(0)).updateUsersLastActivityTimeBatch(anyMap());
    assertEquals(0, tracker.getLocalCacheSize());
  }

  @Test
  void testForceFlushUsesLazyLoadedRepositoryAndDirectExecutor() throws Exception {
    ScheduledExecutorService directExecutor = mock(ScheduledExecutorService.class);
    doAnswer(
            invocation -> {
              ((Runnable) invocation.getArgument(0)).run();
              return null;
            })
        .when(directExecutor)
        .execute(any(Runnable.class));
    setField(tracker, "virtualThreadExecutor", directExecutor);
    setField(tracker, "userRepository", null);

    try (MockedStatic<Entity> mockedEntity = Mockito.mockStatic(Entity.class)) {
      mockedEntity
          .when(() -> Entity.getEntityRepository(Entity.USER))
          .thenReturn(mockUserRepository);

      tracker.trackActivity("lazy-user");
      tracker.forceFlush();

      verify(mockUserRepository).updateUsersLastActivityTimeBatch(anyMap());
      assertSame(mockUserRepository, getField(tracker, "userRepository", UserRepository.class));
      assertEquals(0, tracker.getLocalCacheSize());
    }
  }

  @Test
  void testBulkDatabaseUpdateReaddsInterruptedBatch() throws Exception {
    Semaphore permits = getField(tracker, "dbOperationPermits", Semaphore.class);
    permits.acquire(10);
    try {
      Map<String, Long> userActivityMap = Map.of("interrupt-user", 123L);

      Thread.currentThread().interrupt();
      invokePerformBulkDatabaseUpdate(userActivityMap);

      assertEquals(1, tracker.getLocalCacheSize());
      Map<String, ?> cache = getCache();
      assertTrue(cache.containsKey("interrupt-user"));
      assertTrue(Thread.currentThread().isInterrupted());
    } finally {
      Thread.interrupted();
      permits.release(10);
    }
  }

  @Test
  void testBulkDatabaseUpdateDoesNotOverwriteNewerCachedEntryOnFailure() throws Exception {
    tracker.trackActivity("user1");
    Map<String, ?> cacheBefore = getCache();
    Object existingActivity = cacheBefore.get("user1");
    long existingLastLocalUpdate = getActivityField(existingActivity, "lastLocalUpdate");

    Map<String, Long> failedBatch = new HashMap<>();
    failedBatch.put("user1", 1L);
    failedBatch.put("user2", 2L);

    doThrow(new RuntimeException("DB down"))
        .when(mockUserRepository)
        .updateUsersLastActivityTimeBatch(anyMap());

    invokePerformBulkDatabaseUpdate(failedBatch);

    Map<String, ?> cacheAfter = getCache();
    assertEquals(2, cacheAfter.size());
    assertSame(existingActivity, cacheAfter.get("user1"));
    assertEquals(
        existingLastLocalUpdate, getActivityField(cacheAfter.get("user1"), "lastLocalUpdate"));
    assertTrue(cacheAfter.containsKey("user2"));
  }

  @Test
  void testShutdownCallsShutdownNowWhenExecutorsDoNotTerminate() throws Exception {
    ScheduledExecutorService scheduler = mock(ScheduledExecutorService.class);
    ScheduledExecutorService executor = mock(ScheduledExecutorService.class);
    when(scheduler.awaitTermination(5, TimeUnit.SECONDS)).thenReturn(false);
    when(executor.awaitTermination(10, TimeUnit.SECONDS)).thenReturn(false);
    setField(tracker, "scheduler", scheduler);
    setField(tracker, "virtualThreadExecutor", executor);

    tracker.shutdown();
    tracker = null;

    verify(scheduler).shutdown();
    verify(scheduler).shutdownNow();
    verify(executor).shutdown();
    verify(executor).shutdownNow();
  }

  @Test
  void testShutdownRestoresInterruptWhenAwaitTerminationIsInterrupted() throws Exception {
    ScheduledExecutorService scheduler = mock(ScheduledExecutorService.class);
    ScheduledExecutorService executor = mock(ScheduledExecutorService.class);
    when(scheduler.awaitTermination(5, TimeUnit.SECONDS))
        .thenThrow(new InterruptedException("stop"));
    setField(tracker, "scheduler", scheduler);
    setField(tracker, "virtualThreadExecutor", executor);

    tracker.shutdown();
    tracker = null;

    verify(scheduler).shutdown();
    verify(scheduler).shutdownNow();
    verify(executor).shutdown();
    verify(executor).shutdownNow();
    assertTrue(Thread.currentThread().isInterrupted());
    assertTrue(Thread.interrupted());
    assertFalse(Thread.currentThread().isInterrupted());
  }

  private Map<String, ?> getCache() throws Exception {
    return getField(tracker, "localActivityCache", Map.class);
  }

  private static void invokePerformBulkDatabaseUpdate(Map<String, Long> userActivityMap)
      throws Exception {
    Method method =
        UserActivityTracker.class.getDeclaredMethod("performBulkDatabaseUpdate", Map.class);
    method.setAccessible(true);
    method.invoke(UserActivityTracker.getInstance(), userActivityMap);
  }

  @SuppressWarnings("unchecked")
  private static <T> T getField(Object target, String name, Class<T> type) throws Exception {
    Field field = UserActivityTracker.class.getDeclaredField(name);
    field.setAccessible(true);
    return (T) field.get(target);
  }

  private static long getActivityField(Object activity, String name) throws Exception {
    Field field = activity.getClass().getDeclaredField(name);
    field.setAccessible(true);
    return (long) field.get(activity);
  }

  private static void setActivityField(Object activity, String name, long value) throws Exception {
    Field field = activity.getClass().getDeclaredField(name);
    field.setAccessible(true);
    field.set(activity, value);
  }

  private static void setField(Object target, String name, Object value) throws Exception {
    Field field = UserActivityTracker.class.getDeclaredField(name);
    field.setAccessible(true);
    field.set(target, value);
  }
}
