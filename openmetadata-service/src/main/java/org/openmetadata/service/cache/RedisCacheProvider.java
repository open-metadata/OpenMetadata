package org.openmetadata.service.cache;

import io.lettuce.core.RedisClient;
import io.lettuce.core.RedisURI;
import io.lettuce.core.SetArgs;
import io.lettuce.core.api.StatefulRedisConnection;
import io.lettuce.core.api.sync.RedisCommands;
import java.time.Duration;
import java.util.Map;
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;

@Slf4j
public class RedisCacheProvider implements CacheProvider {
  private final CacheConfig config;
  private final CacheKeys keys;
  private RedisClient redisClient;
  private StatefulRedisConnection<String, String> connection;
  private RedisCommands<String, String> syncCommands;
  private volatile boolean available = false;

  public RedisCacheProvider(CacheConfig config) {
    this.config = config;
    this.keys = new CacheKeys(config.redis.keyspace);
    initialize();
  }

  private void initialize() {
    try {
      RedisURI uri = buildRedisURI();
      initializeStandalone(uri);
      available = true;
      LOG.info("Redis cache provider initialized successfully");
    } catch (Exception e) {
      LOG.error("Failed to initialize Redis cache provider", e);
      available = false;
    }
  }

  private RedisURI buildRedisURI() {
    // Parse the URL to handle both "host:port" and "redis://host:port" formats
    String url = config.redis.url;
    RedisURI.Builder builder;

    if (url.startsWith("redis://") || url.startsWith("rediss://")) {
      // Full URL with scheme - use create method
      RedisURI uri = RedisURI.create(url);
      builder =
          RedisURI.Builder.redis(uri.getHost(), uri.getPort())
              .withTimeout(Duration.ofMillis(config.redis.connectTimeoutMs));
    } else if (url.contains(":")) {
      // host:port format
      String[] parts = url.split(":");
      String host = parts[0];
      int port = Integer.parseInt(parts[1]);
      builder =
          RedisURI.Builder.redis(host, port)
              .withTimeout(Duration.ofMillis(config.redis.connectTimeoutMs));
    } else {
      // Just hostname, use default port
      builder =
          RedisURI.Builder.redis(url).withTimeout(Duration.ofMillis(config.redis.connectTimeoutMs));
    }

    if (config.redis.username != null) {
      builder.withAuthentication(config.redis.username, getPassword());
    } else if (config.redis.passwordRef != null) {
      builder.withPassword(getPassword().toCharArray());
    }

    if (config.redis.useSSL) {
      builder.withSsl(true);
    }

    return builder.build();
  }

  private String getPassword() {
    return config.redis.passwordRef != null ? config.redis.passwordRef : "";
  }

  private void initializeStandalone(RedisURI uri) {
    redisClient = RedisClient.create(uri);
    connection = redisClient.connect();
    syncCommands = connection.sync();
    LOG.info("Initialized Redis connection");
  }

  @Override
  public Optional<String> get(String key) {
    if (!available) return Optional.empty();

    try {
      String value = syncCommands.get(key);
      return Optional.ofNullable(value);
    } catch (Exception e) {
      LOG.error("Error getting key: {}", key, e);
      return Optional.empty();
    }
  }

  @Override
  public void set(String key, String value, Duration ttl) {
    if (!available) return;

    try {
      SetArgs args = SetArgs.Builder.ex(ttl.getSeconds());
      syncCommands.set(key, value, args);
    } catch (Exception e) {
      LOG.error("Error setting key: {}", key, e);
    }
  }

  @Override
  public boolean setIfAbsent(String key, String value, Duration ttl) {
    if (!available) return false;

    try {
      // SET NX EX - set if not exists with expiration
      SetArgs args = SetArgs.Builder.nx().ex(ttl.getSeconds());
      String result = syncCommands.set(key, value, args);
      // Redis returns "OK" if the key was set, null if it already exists
      return "OK".equals(result);
    } catch (Exception e) {
      LOG.error("Error setting key if absent: {}", key, e);
      return false;
    }
  }

  @Override
  public void del(String... keys) {
    if (!available || keys.length == 0) return;

    try {
      syncCommands.del(keys);
    } catch (Exception e) {
      LOG.error("Error deleting keys", e);
    }
  }

  @Override
  public Optional<String> hget(String key, String field) {
    if (!available) return Optional.empty();

    try {
      String value = syncCommands.hget(key, field);
      return Optional.ofNullable(value);
    } catch (Exception e) {
      LOG.error("Error getting hash field: {} -> {}", key, field, e);
      return Optional.empty();
    }
  }

  @Override
  public void hset(String key, Map<String, String> fields, Duration ttl) {
    if (!available || fields.isEmpty()) return;

    try {
      syncCommands.hset(key, fields);
      if (ttl != null && ttl.getSeconds() > 0) {
        syncCommands.expire(key, ttl.getSeconds());
      }
    } catch (Exception e) {
      LOG.error("Error setting hash fields: {}", key, e);
    }
  }

  @Override
  public void hdel(String key, String... fields) {
    if (!available || fields.length == 0) return;

    try {
      syncCommands.hdel(key, fields);
    } catch (Exception e) {
      LOG.error("Error deleting hash fields: {}", key, e);
    }
  }

  @Override
  public boolean available() {
    return available;
  }

  @Override
  public void close() {
    try {
      if (connection != null) {
        connection.close();
      }
      if (redisClient != null) {
        redisClient.shutdown();
      }

      available = false;
      LOG.info("Redis cache provider closed");
    } catch (Exception e) {
      LOG.error("Error closing Redis cache provider", e);
    }
  }
}
