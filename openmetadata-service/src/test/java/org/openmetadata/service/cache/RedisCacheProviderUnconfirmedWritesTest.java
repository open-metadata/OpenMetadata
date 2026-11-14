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
package org.openmetadata.service.cache;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.AdditionalAnswers.delegatesTo;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;

import io.lettuce.core.RedisClient;
import io.lettuce.core.RedisException;
import io.lettuce.core.RedisFuture;
import io.lettuce.core.RedisURI;
import io.lettuce.core.api.StatefulRedisConnection;
import io.lettuce.core.api.async.RedisAsyncCommands;
import io.lettuce.core.api.sync.RedisCommands;
import java.lang.reflect.Field;
import java.time.Duration;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.FutureTask;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;
import java.util.concurrent.locks.ReentrantLock;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Writes the provider could not deliver must not leave Redis serving the value from before them.
 * The provider used to drop writes silently while its circuit breaker was open, then serve the
 * pre-outage copy for up to the entity TTL once Redis recovered.
 */
@Testcontainers(disabledWithoutDocker = true)
class RedisCacheProviderUnconfirmedWritesTest {
  private static final Duration TTL = Duration.ofMinutes(5);
  private static final int FAILURES_TO_OPEN_BREAKER = 5;
  private static final int MAX_HEALTH_CHECKS = 10;
  private static final int RECOVERY_HEALTH_CHECKS = 3;

  @Container
  static final GenericContainer<?> REDIS =
      new GenericContainer<>("redis:7-alpine").withExposedPorts(6379);

  private static RedisClient client;
  private static StatefulRedisConnection<String, String> connection;
  private static RedisCommands<String, String> redis;

  private RedisCacheProvider provider;

  @BeforeAll
  static void connect() {
    client =
        RedisClient.create(
            RedisURI.builder()
                .withHost(REDIS.getHost())
                .withPort(REDIS.getMappedPort(6379))
                .build());
    connection = client.connect();
    redis = connection.sync();
  }

  @AfterAll
  static void disconnect() {
    connection.close();
    client.shutdown();
  }

  @BeforeEach
  void setUp() {
    redis.flushdb();
    provider = new RedisCacheProvider(config());
  }

  @AfterEach
  void tearDown() {
    unpauseRedisIfPaused();
    provider.close();
  }

  @Test
  void writeSkippedWhileTheBreakerIsOpenIsDeletedBeforeRecovery() {
    provider.hset("om-test:e:table:1", Map.of("base", "before-outage"), TTL);
    pauseRedis();
    for (int failure = 0; failure < FAILURES_TO_OPEN_BREAKER; failure++) {
      provider.get("om-test:probe");
    }
    assertFalse(provider.available());
    assertFalse(provider.tryHset("om-test:e:table:1", Map.of("base", "during-outage"), TTL));
    unpauseRedisIfPaused();

    recover();

    assertTrue(provider.available());
    assertEquals(Optional.empty(), provider.hget("om-test:e:table:1", "base"));
  }

  @Test
  void writeThatFailedWhileAvailableIsDeletedByTheNextHealthCheck() {
    redis.set("om-test:e:table:2", "not-a-hash");
    provider.hset("om-test:e:table:2", Map.of("base", "fresh"), TTL);
    assertTrue(provider.available());

    provider.healthCheck();

    assertEquals(0L, redis.exists("om-test:e:table:2"));
  }

  @Test
  @SuppressWarnings("unchecked")
  void cleanupWhileAvailableDoesNotBlockSuccessfulRequests() throws Exception {
    String failedKey = "om-test:failed-write";
    redis.set(failedKey, "not-a-hash");
    assertFalse(provider.tryHset(failedKey, Map.of("base", "fresh"), TTL));
    assertTrue(provider.available());
    redis.set("om-test:read", "read-value");
    redis.hset("om-test:hash", "base", "hash-value");

    CountDownLatch cleanupStarted = new CountDownLatch(1);
    CountDownLatch finishCleanup = new CountDownLatch(1);
    RedisAsyncCommands<String, String> commands =
        mock(RedisAsyncCommands.class, delegatesTo(connection.async()));
    doAnswer(
            invocation -> {
              cleanupStarted.countDown();
              assertTrue(finishCleanup.await(10, TimeUnit.SECONDS));
              return connection.async().unlink(failedKey);
            })
        .when(commands)
        .unlink(failedKey);
    Field asyncCommands = RedisCacheProvider.class.getDeclaredField("asyncCommands");
    asyncCommands.setAccessible(true);
    asyncCommands.set(provider, commands);

    FutureTask<Void> cleanup =
        new FutureTask<>(
            () -> {
              provider.healthCheck();
              return null;
            });
    FutureTask<Optional<String>> request =
        new FutureTask<>(
            () -> {
              assertEquals(Optional.of("read-value"), provider.get("om-test:read"));
              assertTrue(provider.trySet("om-test:write", "written-value", TTL));
              return provider.hget("om-test:hash", "base");
            });
    Thread requestThread = new Thread(request);
    new Thread(cleanup).start();
    try {
      assertTrue(cleanupStarted.await(5, TimeUnit.SECONDS));
      requestThread.start();
      Awaitility.await()
          .atMost(Duration.ofSeconds(5))
          .until(() -> waitsForStateLock(requestThread) || request.isDone());
      assertTrue(request.isDone(), "healthy requests must complete before cleanup is released");
      assertEquals(Optional.of("hash-value"), request.get(5, TimeUnit.SECONDS));
      assertEquals("written-value", redis.get("om-test:write"));
    } finally {
      finishCleanup.countDown();
      cleanup.get(5, TimeUnit.SECONDS);
      requestThread.join(TimeUnit.SECONDS.toMillis(5));
    }
    assertEquals(0L, redis.exists(failedKey));
  }

  @Test
  @SuppressWarnings("unchecked")
  void breakerOpeningDuringAvailableCleanupKeepsSkippedWritesPending() throws Exception {
    String failedKey = "om-test:failed-write";
    String racingKey = "om-test:racing-write";
    redis.set(failedKey, "not-a-hash");
    redis.set(racingKey, "before-outage");
    assertFalse(provider.tryHset(failedKey, Map.of("base", "fresh"), TTL));
    assertTrue(provider.available());

    RedisAsyncCommands<String, String> commands =
        mock(RedisAsyncCommands.class, delegatesTo(connection.async()));
    doAnswer(
            invocation -> {
              for (int failure = 1; failure < FAILURES_TO_OPEN_BREAKER; failure++) {
                assertFalse(provider.tryHset(failedKey, Map.of("base", "fresh"), TTL));
              }
              assertFalse(provider.available());
              assertFalse(provider.trySet(racingKey, "during-outage", TTL));
              return connection.async().unlink(failedKey);
            })
        .when(commands)
        .unlink(failedKey);
    Field asyncCommands = RedisCacheProvider.class.getDeclaredField("asyncCommands");
    asyncCommands.setAccessible(true);
    asyncCommands.set(provider, commands);

    provider.healthCheck();

    assertFalse(provider.available());
    assertEquals(Optional.empty(), provider.get(racingKey));
    assertEquals("before-outage", redis.get(racingKey));
    asyncCommands.set(provider, connection.async());
    recover();
    assertTrue(provider.available());
    assertEquals(0L, redis.exists(failedKey, racingKey));
  }

  @Test
  @SuppressWarnings("unchecked")
  void writeSkippedDuringCleanupKeepsReadsDisabledUntilTheNextCleanup() throws Exception {
    String firstKey = "om-test:first";
    String racingKey = "om-test:racing";
    redis.set(firstKey, "before-outage");
    redis.set(racingKey, "before-outage");
    pauseRedis();
    for (int failure = 0; failure < FAILURES_TO_OPEN_BREAKER; failure++) {
      provider.get("om-test:probe");
    }
    unpauseRedisIfPaused();
    provider.healthCheck();
    provider.healthCheck();
    assertFalse(provider.available());
    provider.set(firstKey, "during-outage", TTL);

    RedisAsyncCommands<String, String> commands =
        mock(RedisAsyncCommands.class, delegatesTo(connection.async()));
    doAnswer(
            invocation -> {
              RedisFuture<Long> deletion = connection.async().unlink(firstKey);
              provider.set(racingKey, "during-cleanup", TTL);
              return deletion;
            })
        .when(commands)
        .unlink(firstKey);
    Field asyncCommands = RedisCacheProvider.class.getDeclaredField("asyncCommands");
    asyncCommands.setAccessible(true);
    asyncCommands.set(provider, commands);

    provider.healthCheck();

    assertFalse(provider.available(), "recovery must wait for the write skipped during cleanup");
    assertEquals(Optional.empty(), provider.get(racingKey));
    provider.healthCheck();
    assertTrue(provider.available());
    assertEquals(0L, redis.exists(firstKey, racingKey));
  }

  @Test
  @SuppressWarnings("unchecked")
  void recoversWhenAWritingRequestArrivesDuringEveryCleanup() throws Exception {
    String key = "om-test:continuous-writes";
    redis.set(key, "before-outage");
    pauseRedis();
    for (int failure = 0; failure < FAILURES_TO_OPEN_BREAKER; failure++) {
      provider.get("om-test:probe");
    }
    unpauseRedisIfPaused();
    assertFalse(provider.available());

    AtomicReference<FutureTask<Boolean>> racingWrite = new AtomicReference<>();
    RedisAsyncCommands<String, String> commands =
        mock(RedisAsyncCommands.class, delegatesTo(connection.async()));
    doAnswer(
            invocation -> {
              FutureTask<Boolean> write =
                  new FutureTask<>(() -> provider.trySet(key, "fresh", TTL));
              racingWrite.set(write);
              Thread writer = new Thread(write);
              writer.start();
              Awaitility.await()
                  .atMost(Duration.ofSeconds(5))
                  .until(() -> waitsForStateLock(writer) || write.isDone());
              assertFalse(provider.available());
              assertEquals(Optional.empty(), provider.get(key));
              return connection.async().unlink(key);
            })
        .when(commands)
        .unlink(key);
    Field asyncCommands = RedisCacheProvider.class.getDeclaredField("asyncCommands");
    asyncCommands.setAccessible(true);
    asyncCommands.set(provider, commands);

    for (int check = 0; check < 3; check++) {
      provider.set(key, "during-outage", TTL);
      provider.healthCheck();
      boolean applied = racingWrite.get().get(5, TimeUnit.SECONDS);
      assertEquals(check == 2, applied, "the racing write must reach Redis on recovery");
    }

    assertTrue(provider.available(), "healthy Redis must recover despite continuous writes");
    assertEquals(Optional.of("fresh"), provider.get(key));
  }

  @Test
  void recoversOnTheThirdHealthCheckWhileWritesKeepArriving() throws Exception {
    openBreaker();
    AtomicBoolean writing = new AtomicBoolean(true);
    AtomicLong attempts = new AtomicLong();
    Thread writer =
        new Thread(
            () -> {
              while (writing.get()) {
                provider.trySet("om-test:steady:" + attempts.incrementAndGet() % 1_000, "v", TTL);
              }
            });
    writer.start();
    try {
      for (int check = 0; check < RECOVERY_HEALTH_CHECKS; check++) {
        long attemptsBeforeCheck = attempts.get();
        Awaitility.await()
            .atMost(Duration.ofSeconds(5))
            .until(() -> attempts.get() > attemptsBeforeCheck + 1_000);
        provider.healthCheck();
      }
      assertTrue(provider.available(), "steady writes must not hold off recovery");
    } finally {
      writing.set(false);
      writer.join();
    }
  }

  @Test
  @SuppressWarnings("unchecked")
  void writesWaitingForRecoveryCleanupDoNotHoldCarrierThreads() throws Exception {
    String trackedKey = "om-test:tracked";
    openBreaker();
    provider.set(trackedKey, "during-outage", TTL);
    CountDownLatch cleanupStarted = new CountDownLatch(1);
    CountDownLatch finishCleanup = new CountDownLatch(1);
    RedisAsyncCommands<String, String> commands =
        mock(RedisAsyncCommands.class, delegatesTo(connection.async()));
    doAnswer(
            invocation -> {
              cleanupStarted.countDown();
              finishCleanup.await(1, TimeUnit.MINUTES);
              return connection.async().unlink(trackedKey);
            })
        .when(commands)
        .unlink(trackedKey);
    Field asyncCommands = RedisCacheProvider.class.getDeclaredField("asyncCommands");
    asyncCommands.setAccessible(true);
    asyncCommands.set(provider, commands);
    Thread healthCheck = new Thread(provider::healthCheck);
    healthCheck.start();
    assertTrue(cleanupStarted.await(5, TimeUnit.SECONDS));

    // More writers than the virtual-thread scheduler has carriers: a writer that waits for the
    // cleanup while keeping its carrier leaves the rest unable to start.
    int writers = Runtime.getRuntime().availableProcessors() * 4;
    AtomicInteger started = new AtomicInteger();
    try (ExecutorService virtualThreads = Executors.newVirtualThreadPerTaskExecutor()) {
      for (int writer = 0; writer < writers; writer++) {
        String key = "om-test:virtual-writer:" + writer;
        virtualThreads.submit(
            () -> {
              started.incrementAndGet();
              return provider.trySet(key, "fresh", TTL);
            });
      }
      try {
        Awaitility.await("every writer starts while the cleanup holds the lock")
            .atMost(Duration.ofSeconds(5))
            .until(() -> started.get() == writers);
      } finally {
        finishCleanup.countDown();
      }
    }
    healthCheck.join();
  }

  @Test
  @SuppressWarnings("unchecked")
  void failedCleanupKeepsReadsDisabledAndRetriesTheTrackedKeys() throws Exception {
    String key = "om-test:failed-cleanup";
    redis.set(key, "before-outage");
    pauseRedis();
    for (int failure = 0; failure < FAILURES_TO_OPEN_BREAKER; failure++) {
      provider.get("om-test:probe");
    }
    unpauseRedisIfPaused();
    provider.healthCheck();
    provider.healthCheck();
    provider.set(key, "during-outage", TTL);

    RedisAsyncCommands<String, String> commands =
        mock(RedisAsyncCommands.class, delegatesTo(connection.async()));
    doAnswer(
            invocation -> {
              throw new RedisException("cleanup failed");
            })
        .when(commands)
        .unlink(key);
    Field asyncCommands = RedisCacheProvider.class.getDeclaredField("asyncCommands");
    asyncCommands.setAccessible(true);
    asyncCommands.set(provider, commands);

    provider.healthCheck();

    assertFalse(provider.available());
    assertEquals(Optional.empty(), provider.get(key));
    assertEquals("before-outage", redis.get(key));
    asyncCommands.set(provider, connection.async());
    recover();
    assertTrue(provider.available());
    assertEquals(0L, redis.exists(key));
  }

  @Test
  void writeReportsWhetherRedisAppliedIt() {
    redis.set("om-test:e:table:4", "not-a-hash");

    assertTrue(provider.tryHset("om-test:e:table:3", Map.of("base", "fresh"), TTL));
    assertTrue(provider.trySet("om-test:en:table:3", "fresh", TTL));
    assertFalse(provider.tryHset("om-test:e:table:4", Map.of("base", "fresh"), TTL));
  }

  private boolean waitsForStateLock(Thread thread) throws ReflectiveOperationException {
    Field stateLock = RedisCacheProvider.class.getDeclaredField("stateLock");
    stateLock.setAccessible(true);
    return ((ReentrantLock) stateLock.get(provider)).hasQueuedThread(thread);
  }

  private void openBreaker() {
    pauseRedis();
    for (int failure = 0; failure < FAILURES_TO_OPEN_BREAKER; failure++) {
      provider.get("om-test:probe");
    }
    unpauseRedisIfPaused();
    assertFalse(provider.available());
  }

  private void recover() {
    for (int check = 0; check < MAX_HEALTH_CHECKS && !provider.available(); check++) {
      provider.healthCheck();
    }
  }

  private static CacheConfig config() {
    CacheConfig config = new CacheConfig();
    config.provider = CacheConfig.Provider.redis;
    config.redis.url = REDIS.getHost() + ":" + REDIS.getMappedPort(6379);
    config.redis.keyspace = "om-test";
    config.redis.commandTimeoutMs = 200;
    // The tests drive health checks themselves.
    config.redis.healthCheckIntervalMs = (int) Duration.ofHours(1).toMillis();
    return config;
  }

  private static void pauseRedis() {
    REDIS.getDockerClient().pauseContainerCmd(REDIS.getContainerId()).exec();
  }

  private static void unpauseRedisIfPaused() {
    Boolean paused =
        REDIS
            .getDockerClient()
            .inspectContainerCmd(REDIS.getContainerId())
            .exec()
            .getState()
            .getPaused();
    if (Boolean.TRUE.equals(paused)) {
      REDIS.getDockerClient().unpauseContainerCmd(REDIS.getContainerId()).exec();
    }
  }
}
