package org.openmetadata.service.cache;

import io.lettuce.core.LettuceFutures;
import io.lettuce.core.RedisClient;
import io.lettuce.core.RedisFuture;
import io.lettuce.core.RedisURI;
import io.lettuce.core.SetArgs;
import io.lettuce.core.api.StatefulRedisConnection;
import io.lettuce.core.api.async.RedisAsyncCommands;
import io.lettuce.core.api.sync.RedisCommands;
import io.micrometer.core.instrument.Timer;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import lombok.extern.slf4j.Slf4j;

@Slf4j
public class RedisCacheProvider implements CacheProvider {
  private final CacheConfig config;
  private final CacheKeys keys;
  private RedisClient redisClient;
  private StatefulRedisConnection<String, String> connection;
  private RedisCommands<String, String> syncCommands;
  private RedisAsyncCommands<String, String> asyncCommands;
  private ScheduledExecutorService healthChecker;
  private volatile boolean available = false;

  public RedisCacheProvider(CacheConfig config) {
    this.config = config;
    this.keys = new CacheKeys(config.redis.keyspace);
    initialize();
  }

  private void initialize() {
    try {
      RedisURI uri = RedisURIFactory.build(config.redis);
      initializeStandalone(uri);
      available = true;
      startHealthChecker();
      LOG.info(
          "Redis cache provider initialized (commandTimeoutMs={})", config.redis.commandTimeoutMs);
    } catch (Exception e) {
      LOG.error("Failed to initialize Redis cache provider", e);
      available = false;
    }
  }

  private void startHealthChecker() {
    long intervalMs = Math.max(1000L, config.redis.healthCheckIntervalMs);
    healthChecker =
        Executors.newSingleThreadScheduledExecutor(
            r -> {
              Thread t = new Thread(r, "redis-cache-health-check");
              t.setDaemon(true);
              return t;
            });
    healthChecker.scheduleWithFixedDelay(
        this::healthCheck, intervalMs, intervalMs, TimeUnit.MILLISECONDS);
  }

  private void healthCheck() {
    try {
      String reply = syncCommands.ping();
      if (!"PONG".equalsIgnoreCase(reply)) {
        markUnhealthy(new IllegalStateException("Unexpected PING reply: " + reply));
        return;
      }
      if (!available) {
        available = true;
        LOG.info("Redis cache provider recovered, available=true");
      }
    } catch (Exception e) {
      markUnhealthy(e);
    }
  }

  /**
   * Flip {@code available=false} so callers (and {@code EntityResource.isDistributedCacheEnabled})
   * fall back to DB reads until the background health check confirms Redis is reachable again.
   * Transient errors are rare; leaving {@code available=true} after a failure causes multi-instance
   * readers to diverge via per-instance Guava L1.
   */
  private void markUnhealthy(Exception e) {
    if (available) {
      available = false;
      LOG.warn("Redis cache provider marked unavailable after command failure", e);
    }
  }

  private void initializeStandalone(RedisURI uri) {
    redisClient = RedisClient.create(uri);
    connection = redisClient.connect();
    connection.setTimeout(Duration.ofMillis(config.redis.commandTimeoutMs));
    syncCommands = connection.sync();
    asyncCommands = connection.async();
    LOG.info("Initialized Redis connection");
  }

  private static CacheMetrics metrics() {
    return CacheMetrics.getInstance();
  }

  private static Timer.Sample startReadTimer(CacheMetrics m) {
    return m != null ? m.startReadTimer() : null;
  }

  private static Timer.Sample startWriteTimer(CacheMetrics m) {
    return m != null ? m.startWriteTimer() : null;
  }

  private static void stopReadTimer(CacheMetrics m, Timer.Sample sample) {
    if (m != null && sample != null) {
      m.recordReadTime(sample);
    }
  }

  private static void stopWriteTimer(CacheMetrics m, Timer.Sample sample) {
    if (m != null && sample != null) {
      m.recordWriteTime(sample);
    }
  }

  @Override
  public Optional<String> get(String key) {
    if (!available) return Optional.empty();

    CacheMetrics m = metrics();
    Timer.Sample sample = startReadTimer(m);
    try {
      String value = syncCommands.get(key);
      if (m != null) {
        if (value != null) m.recordHit();
        else m.recordMiss();
      }
      return Optional.ofNullable(value);
    } catch (Exception e) {
      if (m != null) m.recordError();
      markUnhealthy(e);
      LOG.error("Error getting key: {}", key, e);
      return Optional.empty();
    } finally {
      stopReadTimer(m, sample);
    }
  }

  @Override
  public void set(String key, String value, Duration ttl) {
    if (!available) return;

    CacheMetrics m = metrics();
    Timer.Sample sample = startWriteTimer(m);
    try {
      SetArgs args = SetArgs.Builder.ex(ttl.getSeconds());
      syncCommands.set(key, value, args);
      if (m != null) m.recordWrite();
    } catch (Exception e) {
      if (m != null) m.recordError();
      markUnhealthy(e);
      LOG.error("Error setting key: {}", key, e);
    } finally {
      stopWriteTimer(m, sample);
    }
  }

  @Override
  public boolean setIfAbsent(String key, String value, Duration ttl) {
    if (!available) return false;

    CacheMetrics m = metrics();
    Timer.Sample sample = startWriteTimer(m);
    try {
      SetArgs args = SetArgs.Builder.nx().ex(ttl.getSeconds());
      String result = syncCommands.set(key, value, args);
      boolean acquired = "OK".equals(result);
      if (m != null && acquired) m.recordWrite();
      return acquired;
    } catch (Exception e) {
      if (m != null) m.recordError();
      markUnhealthy(e);
      LOG.error("Error setting key if absent: {}", key, e);
      return false;
    } finally {
      stopWriteTimer(m, sample);
    }
  }

  @Override
  public void del(String... keys) {
    if (!available || keys.length == 0) return;

    CacheMetrics m = metrics();
    Timer.Sample sample = startWriteTimer(m);
    try {
      syncCommands.del(keys);
      if (m != null) m.recordEviction();
    } catch (Exception e) {
      if (m != null) m.recordError();
      markUnhealthy(e);
      LOG.error("Error deleting keys", e);
    } finally {
      stopWriteTimer(m, sample);
    }
  }

  @Override
  public Optional<String> hget(String key, String field) {
    if (!available) return Optional.empty();

    CacheMetrics m = metrics();
    Timer.Sample sample = startReadTimer(m);
    try {
      String value = syncCommands.hget(key, field);
      if (m != null) {
        if (value != null) m.recordHit();
        else m.recordMiss();
      }
      return Optional.ofNullable(value);
    } catch (Exception e) {
      if (m != null) m.recordError();
      markUnhealthy(e);
      LOG.error("Error getting hash field: {} -> {}", key, field, e);
      return Optional.empty();
    } finally {
      stopReadTimer(m, sample);
    }
  }

  @Override
  public void hset(String key, Map<String, String> fields, Duration ttl) {
    if (!available || fields.isEmpty()) return;

    CacheMetrics m = metrics();
    Timer.Sample sample = startWriteTimer(m);
    try {
      syncCommands.hset(key, fields);
      if (ttl != null && ttl.getSeconds() > 0) {
        syncCommands.expire(key, ttl.getSeconds());
      }
      if (m != null) m.recordWrite();
    } catch (Exception e) {
      if (m != null) m.recordError();
      markUnhealthy(e);
      LOG.error("Error setting hash fields: {}", key, e);
    } finally {
      stopWriteTimer(m, sample);
    }
  }

  @Override
  public void hdel(String key, String... fields) {
    if (!available || fields.length == 0) return;

    CacheMetrics m = metrics();
    Timer.Sample sample = startWriteTimer(m);
    try {
      syncCommands.hdel(key, fields);
      if (m != null) m.recordEviction();
    } catch (Exception e) {
      if (m != null) m.recordError();
      markUnhealthy(e);
      LOG.error("Error deleting hash fields: {}", key, e);
    } finally {
      stopWriteTimer(m, sample);
    }
  }

  @Override
  public void pipelineSet(Map<String, String> keyValues, Duration ttl) {
    if (!available || keyValues.isEmpty()) return;

    CacheMetrics m = metrics();
    Timer.Sample sample = startWriteTimer(m);
    try {
      SetArgs args = SetArgs.Builder.ex(ttl.getSeconds());
      List<RedisFuture<?>> futures = new ArrayList<>(keyValues.size());
      for (Map.Entry<String, String> e : keyValues.entrySet()) {
        futures.add(asyncCommands.set(e.getKey(), e.getValue(), args));
      }
      awaitAll(futures);
      if (m != null) {
        for (int i = 0; i < keyValues.size(); i++) m.recordWrite();
      }
    } catch (RuntimeException e) {
      if (m != null) m.recordError();
      markUnhealthy(e);
      LOG.error("Error on pipelineSet (batch={})", keyValues.size(), e);
      throw e;
    } finally {
      stopWriteTimer(m, sample);
    }
  }

  @Override
  public void pipelineHset(Map<String, Map<String, String>> keyFields, Duration ttl) {
    if (!available || keyFields.isEmpty()) return;

    CacheMetrics m = metrics();
    Timer.Sample sample = startWriteTimer(m);
    try {
      List<RedisFuture<?>> futures = new ArrayList<>(keyFields.size() * 2);
      for (Map.Entry<String, Map<String, String>> e : keyFields.entrySet()) {
        if (e.getValue().isEmpty()) continue;
        futures.add(asyncCommands.hset(e.getKey(), e.getValue()));
        if (ttl != null && ttl.getSeconds() > 0) {
          futures.add(asyncCommands.expire(e.getKey(), ttl.getSeconds()));
        }
      }
      awaitAll(futures);
      if (m != null) {
        for (int i = 0; i < keyFields.size(); i++) m.recordWrite();
      }
    } catch (RuntimeException e) {
      if (m != null) m.recordError();
      markUnhealthy(e);
      LOG.error("Error on pipelineHset (batch={})", keyFields.size(), e);
      throw e;
    } finally {
      stopWriteTimer(m, sample);
    }
  }

  private void awaitAll(List<RedisFuture<?>> futures) {
    long timeoutMs = Math.max(1000L, (long) config.redis.commandTimeoutMs * 10);
    RedisFuture<?>[] array = futures.toArray(new RedisFuture[0]);
    boolean completed = LettuceFutures.awaitAll(timeoutMs, TimeUnit.MILLISECONDS, array);
    int failed = 0;
    int cancelled = 0;
    Throwable firstFailure = null;
    for (RedisFuture<?> f : array) {
      if (!f.isDone()) {
        // Cancel futures still in flight on timeout. Without this the Lettuce event loop keeps
        // the response slot alive until the server (eventually) replies, accumulating memory
        // and dispatcher work across repeated timeouts.
        if (f.cancel(false)) {
          cancelled++;
        }
        failed++;
        continue;
      }
      if (f.isCancelled()) {
        failed++;
        continue;
      }
      try {
        f.get();
      } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
        throw new IllegalStateException("Interrupted awaiting Redis pipeline", e);
      } catch (Exception e) {
        if (firstFailure == null) {
          firstFailure = e.getCause() != null ? e.getCause() : e;
          // Log the first underlying failure so operators can tell NOSCRIPT / OOM / connection-
          // reset apart without instrumenting every future. Subsequent failures are summarized
          // by the throw below.
          LOG.warn("Redis pipeline command failed", firstFailure);
        }
        failed++;
      }
    }
    if (!completed || failed > 0) {
      IllegalStateException ise =
          new IllegalStateException(
              String.format(
                  "Redis pipeline batch did not complete cleanly (completed=%s, failed=%d, cancelled=%d, total=%d, timeoutMs=%d)",
                  completed, failed, cancelled, array.length, timeoutMs));
      if (firstFailure != null) {
        ise.initCause(firstFailure);
      }
      throw ise;
    }
  }

  @Override
  public boolean available() {
    return available;
  }

  @Override
  public Map<String, Object> getStats() {
    Map<String, Object> stats = new HashMap<>();
    stats.put("type", "redis");
    stats.put("available", available);

    if (available) {
      try {
        String info = syncCommands.info("stats");
        String[] lines = info.split("\r?\n");
        for (String line : lines) {
          if (line.startsWith("keyspace_hits:")) {
            stats.put("hits", Long.parseLong(line.split(":")[1]));
          } else if (line.startsWith("keyspace_misses:")) {
            stats.put("misses", Long.parseLong(line.split(":")[1]));
          } else if (line.startsWith("total_connections_received:")) {
            stats.put("totalConnections", Long.parseLong(line.split(":")[1]));
          }
        }

        Long dbSize = syncCommands.dbsize();
        stats.put("keys", dbSize);

        Long hits = (Long) stats.get("hits");
        Long misses = (Long) stats.get("misses");
        if (hits != null && misses != null) {
          long total = hits + misses;
          if (total > 0) {
            double hitRate = (double) hits / total * 100;
            stats.put("hitRate", String.format("%.2f%%", hitRate));
          }
        }
      } catch (Exception e) {
        LOG.warn("Failed to get Redis stats", e);
        stats.put("error", "Failed to get stats: " + e.getMessage());
      }
    } else {
      stats.put("status", "unavailable");
    }

    stats.put(
        "config",
        Map.of(
            "keyspace", config.redis.keyspace,
            "ttl", config.entityTtlSeconds,
            "database", config.redis.database));

    return stats;
  }

  @Override
  public void close() {
    try {
      if (healthChecker != null) {
        healthChecker.shutdownNow();
      }
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
