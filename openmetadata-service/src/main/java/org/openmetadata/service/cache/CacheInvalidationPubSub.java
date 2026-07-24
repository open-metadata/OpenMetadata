/*
 *  Copyright 2024 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 */

package org.openmetadata.service.cache;

import io.lettuce.core.RedisClient;
import io.lettuce.core.RedisURI;
import io.lettuce.core.api.StatefulRedisConnection;
import io.lettuce.core.pubsub.RedisPubSubAdapter;
import io.lettuce.core.pubsub.StatefulRedisPubSubConnection;
import java.net.InetAddress;
import java.time.Duration;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Consumer;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * Multi-instance cache-invalidation pub/sub.
 *
 * <p>Each OpenMetadata instance opens one Redis pub/sub subscription and one publisher connection.
 * On local writes, instances call {@link #publish} after Redis-side invalidation succeeds; every
 * other instance receives the message and evicts its own per-instance caches (Guava
 * {@code CACHE_WITH_ID}/{@code CACHE_WITH_NAME}). A sender-id filter drops self-echoes.
 *
 * <p>Pub/sub is fire-and-forget; dropped messages fall back to the Guava expireAfterWrite (default
 * 30 s) as a safety net. Intentionally kept narrow — no stream/ack semantics — to match the
 * existing {@code RedisJobNotifier} pattern.
 */
@Slf4j
public class CacheInvalidationPubSub {
  private static final String CHANNEL = "om:cache:invalidate";

  private final CacheConfig.Redis redisConfig;
  @Getter private final String instanceId;
  private final AtomicBoolean running = new AtomicBoolean(false);

  private RedisClient client;
  private StatefulRedisPubSubConnection<String, String> subConnection;
  private StatefulRedisConnection<String, String> pubConnection;
  private Consumer<InvalidateMessage> handler = msg -> {};

  public CacheInvalidationPubSub(CacheConfig cacheConfig) {
    this.redisConfig = cacheConfig.redis;
    this.instanceId = generateInstanceId();
  }

  public void setHandler(Consumer<InvalidateMessage> handler) {
    this.handler = handler == null ? msg -> {} : handler;
  }

  public void start() {
    if (!running.compareAndSet(false, true)) {
      return;
    }
    try {
      RedisURI uri = RedisURIFactory.build(redisConfig);
      client = RedisClient.create(uri);

      subConnection = client.connectPubSub();
      subConnection.addListener(
          new RedisPubSubAdapter<>() {
            @Override
            public void message(String channel, String message) {
              handleMessage(channel, message);
            }
          });
      subConnection.sync().subscribe(CHANNEL);

      pubConnection = client.connect();
      pubConnection.setTimeout(Duration.ofMillis(redisConfig.commandTimeoutMs));

      LOG.info("CacheInvalidationPubSub started instance={} channel={}", instanceId, CHANNEL);
    } catch (Exception e) {
      // Tear down any partial allocation before flipping `running` back, otherwise stop() would
      // short-circuit on the flag and leak the half-initialised Lettuce client/connections.
      LOG.error("Failed to start CacheInvalidationPubSub, cleaning up partial state", e);
      closeResources(false);
      running.set(false);
    }
  }

  public void stop() {
    if (!running.compareAndSet(true, false)) {
      return;
    }
    closeResources(true);
    LOG.info("CacheInvalidationPubSub stopped instance={}", instanceId);
  }

  private void closeResources(boolean unsubscribe) {
    try {
      if (subConnection != null) {
        if (unsubscribe) {
          try {
            subConnection.sync().unsubscribe(CHANNEL);
          } catch (Exception e) {
            LOG.debug("Unsubscribe failed during cleanup", e);
          }
        }
        subConnection.close();
      }
    } catch (Exception e) {
      LOG.debug("Error closing sub connection", e);
    }
    try {
      if (pubConnection != null) {
        pubConnection.close();
      }
    } catch (Exception e) {
      LOG.debug("Error closing pub connection", e);
    }
    try {
      if (client != null) {
        client.shutdown();
      }
    } catch (Exception e) {
      LOG.debug("Error shutting down Redis client", e);
    }
    subConnection = null;
    pubConnection = null;
    client = null;
  }

  public void publish(String entityType, UUID id, String fqn, String op) {
    if (!running.get() || pubConnection == null || entityType == null) {
      return;
    }
    try {
      InvalidateMessage msg = new InvalidateMessage(entityType, id, fqn, op, instanceId);
      String payload = JsonUtils.pojoToJson(msg);
      pubConnection.async().publish(CHANNEL, payload);
    } catch (Exception e) {
      LOG.debug("Failed to publish invalidation: type={} id={}", entityType, id, e);
    }
  }

  private void handleMessage(String channel, String message) {
    try {
      InvalidateMessage msg = JsonUtils.readValue(message, InvalidateMessage.class);
      if (msg == null || instanceId.equals(msg.sender())) {
        return;
      }
      handler.accept(msg);
    } catch (Exception e) {
      LOG.debug("Bad invalidation message on {}: {}", channel, message, e);
    }
  }

  private static String generateInstanceId() {
    try {
      String host = InetAddress.getLocalHost().getHostName();
      long pid = ProcessHandle.current().pid();
      long started = System.currentTimeMillis();
      return host + ":" + pid + ":" + started;
    } catch (Exception e) {
      return UUID.randomUUID().toString();
    }
  }

  public record InvalidateMessage(String type, UUID id, String fqn, String op, String sender) {}
}
