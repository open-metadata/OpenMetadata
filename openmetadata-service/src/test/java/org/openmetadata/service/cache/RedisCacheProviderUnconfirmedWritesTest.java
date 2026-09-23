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

import io.lettuce.core.RedisClient;
import io.lettuce.core.RedisURI;
import io.lettuce.core.api.StatefulRedisConnection;
import io.lettuce.core.api.sync.RedisCommands;
import java.time.Duration;
import java.util.Map;
import java.util.Optional;
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
  void writeReportsWhetherRedisAppliedIt() {
    redis.set("om-test:e:table:4", "not-a-hash");

    assertTrue(provider.tryHset("om-test:e:table:3", Map.of("base", "fresh"), TTL));
    assertTrue(provider.trySet("om-test:en:table:3", "fresh", TTL));
    assertFalse(provider.tryHset("om-test:e:table:4", Map.of("base", "fresh"), TTL));
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
