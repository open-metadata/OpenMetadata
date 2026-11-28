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

import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.lettuce.core.Range;
import io.lettuce.core.RedisClient;
import io.lettuce.core.RedisURI;
import io.lettuce.core.SetArgs;
import io.lettuce.core.api.StatefulRedisConnection;
import io.lettuce.core.api.sync.RedisCommands;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIf;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.schema.utils.JsonUtils;
import org.testcontainers.containers.GenericContainer;

/**
 * Concrete {@link SessionStoreContractBase} subclass that runs the shared session-store contract
 * against a real Redis instance launched in a Testcontainer. Verifies that the Lua CAS, ZSET
 * secondary indexes, and TTL behavior all produce the same observable semantics as the JDBC store.
 */
@EnabledIf("org.openmetadata.it.bootstrap.TestSuiteBootstrap#isRedisEnabled")
@Execution(ExecutionMode.SAME_THREAD)
class RedisSessionStoreIT extends SessionStoreContractBase {

  // A single cluster-mode node owns every slot, so plain single-key commands behave as on a
  // standalone server, but a command whose keys hash to different slots fails with CROSSSLOT, as it
  // does on a Redis Cluster or a cluster proxy endpoint.
  private static GenericContainer<?> REDIS;

  private static RedisClient client;
  private static StatefulRedisConnection<String, String> connection;
  private static RedisCommands<String, String> commands;

  @BeforeAll
  static void connect() {
    REDIS = TestSuiteBootstrap.onDemandRedis("session-cluster", "--cluster-enabled", "yes");
    RedisURI uri =
        RedisURI.builder().withHost(REDIS.getHost()).withPort(REDIS.getMappedPort(6379)).build();
    client = RedisClient.create(uri);
    connection = client.connect();
    commands = connection.sync();
    commands.clusterAddSlotsRange(Range.create(0, 16383));
    await()
        .atMost(Duration.ofSeconds(30))
        .until(() -> commands.clusterInfo().contains("cluster_state:ok"));
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
  void refreshedSessionLeavesNoIndexEntryOnceRedisEvictsIt() {
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
    store.create(active);
    UserSession refreshing =
        active.toBuilder().status(SessionStatus.REFRESHING).version(1L).build();
    assertTrue(store.updateIfVersion(refreshing, 0L));
    UserSession refreshed = refreshing.toBuilder().status(SessionStatus.ACTIVE).version(2L).build();
    assertTrue(store.updateIfVersion(refreshed, 1L));

    commands.del("om-test:session:" + active.getId());

    assertTrue(store.findByUserIdAndStatus(userId, SessionStatus.ACTIVE, 10).isEmpty());
    assertEquals(List.of(), commands.keys("om-test:session:idx:user:" + userId + ":*"));
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

  @Test
  void userIndexZsetHasBoundedTtlThatExtendsWithoutShortening() {
    RedisSessionStore redisStore = (RedisSessionStore) store;
    String userId = UUID.randomUUID().toString();
    String indexKey = "om-test:session:idx:user:" + userId + ":ACTIVE";
    long now = System.currentTimeMillis();

    UserSession longer =
        UserSession.builder()
            .id(UUID.randomUUID().toString())
            .type(SessionType.AUTH)
            .provider("basic")
            .status(SessionStatus.ACTIVE)
            .userId(userId)
            .version(0L)
            .lastAccessedAt(now)
            .expiresAt(now + TimeUnit.HOURS.toMillis(2))
            .idleExpiresAt(now + TimeUnit.HOURS.toMillis(2))
            .build();
    redisStore.create(longer);

    Long ttlAfterLonger = commands.ttl(indexKey);
    assertTrue(ttlAfterLonger > TimeUnit.MINUTES.toSeconds(110));
    assertTrue(ttlAfterLonger <= TimeUnit.HOURS.toSeconds(2));

    UserSession shorter =
        UserSession.builder()
            .id(UUID.randomUUID().toString())
            .type(SessionType.AUTH)
            .provider("basic")
            .status(SessionStatus.ACTIVE)
            .userId(userId)
            .version(0L)
            .lastAccessedAt(now)
            .expiresAt(now + TimeUnit.MINUTES.toMillis(10))
            .idleExpiresAt(now + TimeUnit.MINUTES.toMillis(10))
            .build();
    redisStore.create(shorter);

    Long ttlAfterShorter = commands.ttl(indexKey);
    assertTrue(
        ttlAfterShorter > TimeUnit.MINUTES.toSeconds(110),
        "a shorter session must not shrink the user index TTL");

    UserSession extended =
        shorter.toBuilder()
            .version(1L)
            .expiresAt(now + TimeUnit.HOURS.toMillis(4))
            .idleExpiresAt(now + TimeUnit.HOURS.toMillis(4))
            .build();
    assertTrue(redisStore.updateIfVersion(extended, 0L));

    Long ttlAfterExtend = commands.ttl(indexKey);
    assertTrue(
        ttlAfterExtend > TimeUnit.MINUTES.toSeconds(230),
        "updating a session with a longer horizon must extend the user index TTL");
  }

  @Test
  void preUpgradePersistentUserIndexIsNotShortenedByNewShortSessionAndTransitionsOnFullScan() {
    RedisSessionStore redisStore = (RedisSessionStore) store;
    String userId = UUID.randomUUID().toString();
    String indexKey = "om-test:session:idx:user:" + userId + ":ACTIVE";
    long now = System.currentTimeMillis();

    // Simulate a legacy persistent user index (TTL == -1) holding a live 2-hour pre-upgrade session
    // plus an already-expired session ID.
    String longSessionId = UUID.randomUUID().toString();
    UserSession legacyLongSession =
        UserSession.builder()
            .id(longSessionId)
            .type(SessionType.AUTH)
            .provider("basic")
            .status(SessionStatus.ACTIVE)
            .userId(userId)
            .version(0L)
            .lastAccessedAt(now - TimeUnit.MINUTES.toMillis(5))
            .expiresAt(now + TimeUnit.HOURS.toMillis(2))
            .idleExpiresAt(now + TimeUnit.HOURS.toMillis(2))
            .build();
    commands.set(
        "om-test:session:" + longSessionId,
        JsonUtils.pojoToJson(legacyLongSession),
        SetArgs.Builder.ex(TimeUnit.HOURS.toSeconds(2)));
    commands.zadd(indexKey, (double) (now - TimeUnit.MINUTES.toMillis(5)), longSessionId);
    commands.zadd(indexKey, (double) (now - TimeUnit.HOURS.toMillis(1)), "expired-legacy-id");
    assertEquals(-1L, commands.ttl(indexKey));

    // Step 1: ZADD of a shorter 10-minute session must NOT shorten the persistent legacy index.
    UserSession shortSession =
        UserSession.builder()
            .id(UUID.randomUUID().toString())
            .type(SessionType.AUTH)
            .provider("basic")
            .status(SessionStatus.ACTIVE)
            .userId(userId)
            .version(0L)
            .lastAccessedAt(now)
            .expiresAt(now + TimeUnit.MINUTES.toMillis(10))
            .idleExpiresAt(now + TimeUnit.MINUTES.toMillis(10))
            .build();
    redisStore.create(shortSession);

    assertEquals(
        -1L,
        commands.ttl(indexKey),
        "a pre-upgrade persistent user index must not be shortened to a single short session's TTL");

    // Step 2: Full scan (as run by SessionService.applySessionLimit immediately after create)
    // cleans stale entries and transitions the persistent index to the max surviving session TTL.
    List<UserSession> active = redisStore.findByUserIdAndStatus(userId, SessionStatus.ACTIVE, 10);
    assertEquals(2, active.size());
    assertEquals(2L, redisStore.userIndexSize(userId, SessionStatus.ACTIVE));

    Long ttlAfterScan = commands.ttl(indexKey);
    assertTrue(
        ttlAfterScan > TimeUnit.MINUTES.toSeconds(110)
            && ttlAfterScan <= TimeUnit.HOURS.toSeconds(2),
        "full scan must transition legacy TTL == -1 index to the max live session horizon, got "
            + ttlAfterScan);
  }
}
