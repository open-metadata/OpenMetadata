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
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.openmetadata.service.util.TestUtils.simulateWork;

import java.lang.reflect.Field;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.openmetadata.service.Entity;
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
    tracker.shutdown();
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
    tracker.trackActivity((String) null);
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
}
