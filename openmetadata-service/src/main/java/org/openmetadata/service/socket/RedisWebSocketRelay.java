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
package org.openmetadata.service.socket;

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
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.cache.CacheConfig;
import org.openmetadata.service.cache.RedisURIFactory;

/**
 * Redis pub/sub relay for cross-pod WebSocket delivery. Mirrors {@code CacheInvalidationPubSub}: one
 * subscriber connection and one publisher connection per pod, a sender-id filter to drop self-echoes.
 *
 * <p>{@link #publish} fans a frame out to every pod; each pod's subscriber delivers it to its own
 * local sockets via {@link WebSocketManager#sendToOneLocal}. The producing pod has already delivered
 * to its own sockets in {@code sendToOne}, so it skips its own message here to avoid double delivery.
 */
@Slf4j
public class RedisWebSocketRelay implements WebSocketRelay {
  private static final String CHANNEL = "om:ws:relay";

  private final CacheConfig.Redis redisConfig;
  private final String instanceId;
  private final AtomicBoolean running = new AtomicBoolean(false);

  // Seam for tests: default delivers to the live WebSocketManager; a test can route to a probe.
  private final Consumer<RelayFrame> deliver;

  private RedisClient client;
  private StatefulRedisPubSubConnection<String, String> subConnection;
  private StatefulRedisConnection<String, String> pubConnection;

  public RedisWebSocketRelay(CacheConfig cacheConfig) {
    this(cacheConfig, RedisWebSocketRelay::deliverToLocalManager);
  }

  RedisWebSocketRelay(CacheConfig cacheConfig, Consumer<RelayFrame> deliver) {
    this.redisConfig = cacheConfig.redis;
    this.instanceId = generateInstanceId();
    this.deliver = deliver;
  }

  @Override
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
              handleMessage(message);
            }
          });
      subConnection.sync().subscribe(CHANNEL);

      pubConnection = client.connect();
      pubConnection.setTimeout(Duration.ofMillis(redisConfig.commandTimeoutMs));

      LOG.info("RedisWebSocketRelay started instance={} channel={}", instanceId, CHANNEL);
    } catch (Exception e) {
      LOG.error("Failed to start RedisWebSocketRelay, cleaning up partial state", e);
      closeResources(false);
      running.set(false);
    }
  }

  @Override
  public void stop() {
    if (!running.compareAndSet(true, false)) {
      return;
    }
    closeResources(true);
    LOG.info("RedisWebSocketRelay stopped instance={}", instanceId);
  }

  @Override
  public void publish(String scope, String target, String event, String message) {
    if (!running.get() || pubConnection == null || scope == null) {
      return;
    }
    try {
      RelayFrame frame = new RelayFrame(scope, target, event, message, instanceId);
      pubConnection.async().publish(CHANNEL, JsonUtils.pojoToJson(frame));
    } catch (Exception e) {
      LOG.debug("Failed to publish ws relay frame: scope={} event={}", scope, event, e);
    }
  }

  private void handleMessage(String message) {
    try {
      RelayFrame frame = JsonUtils.readValue(message, RelayFrame.class);
      if (frame == null || frame.scope() == null || instanceId.equals(frame.sender())) {
        return;
      }
      deliver.accept(frame);
    } catch (Exception e) {
      LOG.debug("Bad ws relay frame: {}", message, e);
    }
  }

  private static void deliverToLocalManager(RelayFrame frame) {
    WebSocketManager manager = WebSocketManager.getInstance();
    if (manager != null) {
      manager.deliverRelayedFrame(frame.scope(), frame.target(), frame.event(), frame.message());
    }
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

  /** Wire frame carried on the relay channel. {@code sender} is the publishing pod's instance id. */
  public record RelayFrame(
      String scope, String target, String event, String message, String sender) {}
}
