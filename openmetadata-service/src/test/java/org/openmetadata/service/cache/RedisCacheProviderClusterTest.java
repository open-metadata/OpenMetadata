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

import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.lettuce.core.Range;
import io.lettuce.core.RedisClient;
import io.lettuce.core.RedisURI;
import io.lettuce.core.api.StatefulRedisConnection;
import io.lettuce.core.api.sync.RedisCommands;
import io.lettuce.core.cluster.SlotHash;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Multi-key DEL and UNLINK against a cluster-mode Redis, which refuses keys from different slots in
 * one command, and against a standalone Redis, which must keep receiving them in one command so an
 * entity's aliases leave the cache atomically (#33540).
 */
@Testcontainers(disabledWithoutDocker = true)
class RedisCacheProviderClusterTest {

  private static final String KEYSPACE = "om-test";
  private static final int REDIS_PORT = 6379;
  private static final Pattern DEL_CALLS = Pattern.compile("cmdstat_del:calls=(\\d+)");

  // A single cluster-mode node owns every slot, so plain single-key commands behave as on a
  // standalone server, but a command whose keys hash to different slots fails with CROSSSLOT, as it
  // does on a Redis Cluster or a cluster proxy endpoint.
  @Container
  static final GenericContainer<?> CLUSTER =
      new GenericContainer<>("redis:7-alpine")
          .withExposedPorts(REDIS_PORT)
          .withCommand("redis-server", "--cluster-enabled", "yes");

  @Container
  static final GenericContainer<?> STANDALONE =
      new GenericContainer<>("redis:7-alpine").withExposedPorts(REDIS_PORT);

  private static RedisClient clusterClient;
  private static StatefulRedisConnection<String, String> clusterConnection;
  private static RedisCommands<String, String> cluster;
  private static RedisClient standaloneClient;
  private static StatefulRedisConnection<String, String> standaloneConnection;
  private static RedisCommands<String, String> standalone;

  @BeforeAll
  static void connect() {
    clusterClient = RedisClient.create(uri(CLUSTER));
    clusterConnection = clusterClient.connect();
    cluster = clusterConnection.sync();
    cluster.clusterAddSlotsRange(Range.create(0, 16383));
    await()
        .atMost(Duration.ofSeconds(30))
        .until(() -> cluster.clusterInfo().contains("cluster_state:ok"));
    standaloneClient = RedisClient.create(uri(STANDALONE));
    standaloneConnection = standaloneClient.connect();
    standalone = standaloneConnection.sync();
  }

  @AfterAll
  static void disconnect() {
    clusterConnection.close();
    clusterClient.shutdown();
    standaloneConnection.close();
    standaloneClient.shutdown();
  }

  @BeforeEach
  void flush() {
    cluster.flushdb();
    standalone.flushdb();
  }

  @Test
  void delAcrossSlotsRemovesEveryKeyAndKeepsTheProviderAvailable() {
    List<String> keys = keysInDistinctSlots(3);
    try (RedisCacheProvider provider = newProvider(CLUSTER)) {
      for (int round = 0; round < 6; round++) {
        keys.forEach(key -> cluster.set(key, "v"));
        provider.del(keys.toArray(new String[0]));
        for (String key : keys) {
          assertNull(cluster.get(key), key + " survived del in round " + round);
        }
      }
      assertTrue(provider.available(), "six cross-slot dels must not trip the failure detector");
    }
  }

  @Test
  void scanDeleteAcrossSlotsRemovesEveryKeyAndReturnsTheirCount() {
    int count = 1000;
    for (int i = 0; i < count; i++) {
      cluster.set(KEYSPACE + ":entity:" + i, "v");
    }
    try (RedisCacheProvider provider = newProvider(CLUSTER)) {
      assertEquals(count, provider.scanDelete(KEYSPACE + ":*"));
    }
    assertEquals(0L, cluster.dbsize());
  }

  @Test
  void standaloneDelOfCrossSlotKeysStaysOneCommand() {
    List<String> keys = keysInDistinctSlots(3);
    keys.forEach(key -> standalone.set(key, "v"));
    try (RedisCacheProvider provider = newProvider(STANDALONE)) {
      standalone.configResetstat();
      provider.del(keys.toArray(new String[0]));
    }
    for (String key : keys) {
      assertNull(standalone.get(key), key + " survived del");
    }
    assertEquals(
        1,
        delCalls(standalone.info("commandstats")),
        "a standalone server must receive the aliases in one DEL (#33540)");
  }

  private static RedisCacheProvider newProvider(GenericContainer<?> redis) {
    CacheConfig config = new CacheConfig();
    config.provider = CacheConfig.Provider.redis;
    config.redis.url = redis.getHost() + ":" + redis.getMappedPort(REDIS_PORT);
    config.redis.authType = CacheConfig.AuthType.NONE;
    config.redis.keyspace = KEYSPACE;
    RedisCacheProvider provider = new RedisCacheProvider(config);
    assertTrue(provider.available(), "provider did not connect to " + config.redis.url);
    return provider;
  }

  private static RedisURI uri(GenericContainer<?> redis) {
    return RedisURI.builder()
        .withHost(redis.getHost())
        .withPort(redis.getMappedPort(REDIS_PORT))
        .build();
  }

  private static List<String> keysInDistinctSlots(int count) {
    List<String> keys = new ArrayList<>();
    Set<Integer> slots = new HashSet<>();
    for (int i = 0; keys.size() < count; i++) {
      String key = KEYSPACE + ":entity:" + i;
      if (slots.add(SlotHash.getSlot(key))) {
        keys.add(key);
      }
    }
    return keys;
  }

  private static int delCalls(String commandStats) {
    Matcher matcher = DEL_CALLS.matcher(commandStats);
    return matcher.find() ? Integer.parseInt(matcher.group(1)) : 0;
  }
}
