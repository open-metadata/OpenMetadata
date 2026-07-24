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
package org.openmetadata.service.security.session;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.lettuce.core.RedisClient;
import io.lettuce.core.RedisURI;
import io.lettuce.core.api.StatefulRedisConnection;
import io.lettuce.core.api.sync.RedisCommands;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Concrete {@link SessionStoreContractTest} subclass that runs the shared session-store contract
 * against a real Redis instance launched in a Testcontainer. Verifies that the Lua CAS, ZSET
 * secondary indexes, and TTL behavior all produce the same observable semantics as the JDBC store.
 */
@Testcontainers(disabledWithoutDocker = true)
class RedisSessionStoreTest extends SessionStoreContractTest {

  @Container
  static final GenericContainer<?> REDIS =
      new GenericContainer<>("redis:7-alpine").withExposedPorts(6379);

  private static RedisClient client;
  private static StatefulRedisConnection<String, String> connection;
  private static RedisCommands<String, String> commands;

  @BeforeAll
  static void connect() {
    RedisURI uri =
        RedisURI.builder().withHost(REDIS.getHost()).withPort(REDIS.getMappedPort(6379)).build();
    client = RedisClient.create(uri);
    connection = client.connect();
    commands = connection.sync();
  }

  @AfterAll
  static void teardown() {
    if (connection != null) {
      connection.close();
    }
    if (client != null) {
      client.shutdown();
    }
  }

  @BeforeEach
  void flushDb() {
    commands.flushdb();
  }

  @Override
  protected SessionStore newStore() {
    return new RedisSessionStore(commands, "om-test");
  }

  @Test
  void updateIfVersionMovesNonTerminalIndexInCasScript() {
    RedisSessionStore redisStore = (RedisSessionStore) store;
    String userId = UUID.randomUUID().toString();
    long now = System.currentTimeMillis();
    UserSession active =
        UserSession.builder()
            .id(UUID.randomUUID().toString())
            .type(SessionType.AUTH)
            .provider("basic")
            .status(SessionStatus.ACTIVE)
            .userId(userId)
            .version(0L)
            .lastAccessedAt(now)
            .expiresAt(now + TimeUnit.HOURS.toMillis(1))
            .idleExpiresAt(now + TimeUnit.MINUTES.toMillis(30))
            .build();
    redisStore.create(active);

    UserSession refreshing =
        active.toBuilder().status(SessionStatus.REFRESHING).version(1L).build();

    assertTrue(redisStore.updateIfVersion(refreshing, 0L));
    assertEquals(0L, redisStore.userIndexSize(userId, SessionStatus.ACTIVE));
    assertEquals(1L, redisStore.userIndexSize(userId, SessionStatus.REFRESHING));
  }

  @Test
  void createUsesEarliestSessionExpiryForRedisTtl() {
    RedisSessionStore redisStore = (RedisSessionStore) store;
    String userId = UUID.randomUUID().toString();
    long now = System.currentTimeMillis();
    UserSession session =
        UserSession.builder()
            .id(UUID.randomUUID().toString())
            .type(SessionType.AUTH)
            .provider("basic")
            .status(SessionStatus.ACTIVE)
            .userId(userId)
            .version(0L)
            .lastAccessedAt(now)
            .expiresAt(now + TimeUnit.HOURS.toMillis(1))
            .idleExpiresAt(now + TimeUnit.MINUTES.toMillis(5))
            .build();

    redisStore.create(session);

    Long ttl = commands.ttl("om-test:session:" + session.getId());
    assertTrue(ttl <= TimeUnit.MINUTES.toSeconds(5));
    assertTrue(ttl > TimeUnit.MINUTES.toSeconds(4));
  }

  @Test
  void findByUserIdAndStatusRemovesIdleExpiredSessionsStillInsideMinimumTtl() {
    RedisSessionStore redisStore = (RedisSessionStore) store;
    String userId = UUID.randomUUID().toString();
    long now = System.currentTimeMillis();
    UserSession session =
        UserSession.builder()
            .id(UUID.randomUUID().toString())
            .type(SessionType.AUTH)
            .provider("basic")
            .status(SessionStatus.ACTIVE)
            .userId(userId)
            .version(0L)
            .lastAccessedAt(now)
            .expiresAt(now + TimeUnit.HOURS.toMillis(1))
            .idleExpiresAt(now - TimeUnit.SECONDS.toMillis(1))
            .build();

    redisStore.create(session);

    assertTrue(redisStore.findByUserIdAndStatus(userId, SessionStatus.ACTIVE, 10).isEmpty());
    assertEquals(0L, redisStore.userIndexSize(userId, SessionStatus.ACTIVE));
  }
}
