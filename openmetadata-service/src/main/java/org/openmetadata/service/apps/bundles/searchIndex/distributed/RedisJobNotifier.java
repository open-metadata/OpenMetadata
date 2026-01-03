/*
 *  Copyright 2024 Collate
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

package org.openmetadata.service.apps.bundles.searchIndex.distributed;

import io.lettuce.core.RedisClient;
import io.lettuce.core.RedisURI;
import io.lettuce.core.api.StatefulRedisConnection;
import io.lettuce.core.pubsub.RedisPubSubAdapter;
import io.lettuce.core.pubsub.StatefulRedisPubSubConnection;
import java.time.Duration;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Consumer;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.cache.CacheConfig;

/**
 * Redis Pub/Sub based job notifier for instant push notifications.
 *
 * <p>When Redis is available, this provides zero-latency job discovery across all servers in the
 * cluster. Messages are delivered instantly via Redis Pub/Sub.
 */
@Slf4j
public class RedisJobNotifier implements DistributedJobNotifier {

  private static final String CHANNEL_PREFIX = "om:distributed-jobs:";
  private static final String START_CHANNEL = CHANNEL_PREFIX + "start";
  private static final String COMPLETE_CHANNEL = CHANNEL_PREFIX + "complete";

  private final CacheConfig.Redis redisConfig;
  private final String serverId;
  private final AtomicBoolean running = new AtomicBoolean(false);

  private RedisClient redisClient;
  private StatefulRedisPubSubConnection<String, String> subConnection;
  private StatefulRedisConnection<String, String> pubConnection;
  private Consumer<UUID> jobStartedCallback;

  public RedisJobNotifier(CacheConfig cacheConfig, String serverId) {
    this.redisConfig = cacheConfig.redis;
    this.serverId = serverId;
  }

  @Override
  public void start() {
    if (!running.compareAndSet(false, true)) {
      LOG.warn("RedisJobNotifier already running");
      return;
    }

    try {
      RedisURI uri = buildRedisURI();
      redisClient = RedisClient.create(uri);

      // Create subscription connection
      subConnection = redisClient.connectPubSub();
      subConnection.addListener(
          new RedisPubSubAdapter<>() {
            @Override
            public void message(String channel, String message) {
              handleMessage(channel, message);
            }
          });

      // Subscribe to job channels
      subConnection.sync().subscribe(START_CHANNEL, COMPLETE_CHANNEL);

      // Create publish connection (separate from subscription)
      pubConnection = redisClient.connect();

      LOG.info(
          "RedisJobNotifier started on server {} - subscribed to channels: {}, {}",
          serverId,
          START_CHANNEL,
          COMPLETE_CHANNEL);

    } catch (Exception e) {
      running.set(false);
      LOG.error("Failed to start RedisJobNotifier", e);
      throw new RuntimeException("Failed to initialize Redis Pub/Sub", e);
    }
  }

  @Override
  public void stop() {
    if (!running.compareAndSet(true, false)) {
      return;
    }

    try {
      if (subConnection != null) {
        subConnection.sync().unsubscribe(START_CHANNEL, COMPLETE_CHANNEL);
        subConnection.close();
      }
      if (pubConnection != null) {
        pubConnection.close();
      }
      if (redisClient != null) {
        redisClient.shutdown();
      }
      LOG.info("RedisJobNotifier stopped on server {}", serverId);
    } catch (Exception e) {
      LOG.error("Error stopping RedisJobNotifier", e);
    }
  }

  @Override
  public void notifyJobStarted(UUID jobId, String jobType) {
    if (!running.get() || pubConnection == null) {
      LOG.warn("Cannot notify job started - RedisJobNotifier not running");
      return;
    }

    try {
      String message = formatMessage(jobId, jobType, serverId);
      long receivers = pubConnection.sync().publish(START_CHANNEL, message);
      LOG.info(
          "Published job start notification for {} (type: {}) to {} subscribers",
          jobId,
          jobType,
          receivers);
    } catch (Exception e) {
      LOG.error("Failed to publish job start notification for {}", jobId, e);
    }
  }

  @Override
  public void notifyJobCompleted(UUID jobId) {
    if (!running.get() || pubConnection == null) {
      LOG.warn("Cannot notify job completed - RedisJobNotifier not running");
      return;
    }

    try {
      String message = formatMessage(jobId, "COMPLETED", serverId);
      pubConnection.sync().publish(COMPLETE_CHANNEL, message);
      LOG.debug("Published job completion notification for {}", jobId);
    } catch (Exception e) {
      LOG.error("Failed to publish job completion notification for {}", jobId, e);
    }
  }

  @Override
  public void onJobStarted(Consumer<UUID> callback) {
    this.jobStartedCallback = callback;
  }

  @Override
  public boolean isRunning() {
    return running.get();
  }

  @Override
  public String getType() {
    return "redis-pubsub";
  }

  private void handleMessage(String channel, String message) {
    try {
      String[] parts = message.split("\\|");
      if (parts.length < 3) {
        LOG.warn("Invalid message format: {}", message);
        return;
      }

      UUID jobId = UUID.fromString(parts[0]);
      String jobType = parts[1];
      String sourceServer = parts[2];

      // Don't process our own messages
      if (serverId.equals(sourceServer)) {
        LOG.debug("Ignoring own message for job {}", jobId);
        return;
      }

      if (START_CHANNEL.equals(channel)) {
        LOG.info(
            "Received job start notification from server {}: job={}, type={}",
            sourceServer,
            jobId,
            jobType);
        if (jobStartedCallback != null) {
          jobStartedCallback.accept(jobId);
        }
      } else if (COMPLETE_CHANNEL.equals(channel)) {
        LOG.debug("Received job completion notification: job={}", jobId);
      }

    } catch (Exception e) {
      LOG.error("Error handling message on channel {}: {}", channel, message, e);
    }
  }

  private String formatMessage(UUID jobId, String jobType, String sourceServer) {
    return jobId.toString() + "|" + jobType + "|" + sourceServer;
  }

  private RedisURI buildRedisURI() {
    String url = redisConfig.url;
    RedisURI.Builder builder;

    if (url.startsWith("redis://") || url.startsWith("rediss://")) {
      RedisURI uri = RedisURI.create(url);
      builder =
          RedisURI.Builder.redis(uri.getHost(), uri.getPort())
              .withTimeout(Duration.ofMillis(redisConfig.connectTimeoutMs));
    } else if (url.contains(":")) {
      String[] parts = url.split(":");
      String host = parts[0];
      int port = Integer.parseInt(parts[1]);
      builder =
          RedisURI.Builder.redis(host, port)
              .withTimeout(Duration.ofMillis(redisConfig.connectTimeoutMs));
    } else {
      builder =
          RedisURI.Builder.redis(url).withTimeout(Duration.ofMillis(redisConfig.connectTimeoutMs));
    }

    if (redisConfig.authType == CacheConfig.AuthType.PASSWORD) {
      if (redisConfig.username != null && redisConfig.passwordRef != null) {
        builder.withAuthentication(redisConfig.username, redisConfig.passwordRef);
      } else if (redisConfig.passwordRef != null) {
        builder.withPassword(redisConfig.passwordRef.toCharArray());
      }
    }

    if (redisConfig.useSSL) {
      builder.withSsl(true);
    }

    builder.withDatabase(redisConfig.database);
    return builder.build();
  }
}
