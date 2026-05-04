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
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentLinkedDeque;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import lombok.extern.slf4j.Slf4j;

@Slf4j
public class RedisCacheProvider implements CacheProvider {
  // Sliding-window failure detector. A single 300ms timeout used to flip the provider to
  // unavailable, which combined with a 1s health-check that flipped it back on a single PING
  // success caused the indexer's setFieldsInBulk path to flap — every cycle it paid one timeout
  // before going to fast-fail, then the health check unblocked the whole thing again. We require
  // multiple failures in a sliding window before going unavailable, and multiple consecutive
  // successes (across health-checks AND real ops) before recovering. Same shape as
  // {@code BulkCircuitBreaker}, applied here at the cache layer.
  private static final int FAILURE_THRESHOLD = 5;
  private static final long FAILURE_WINDOW_MS = 30_000L;
  private static final int RECOVERY_THRESHOLD = 3;

  private final CacheConfig config;
  private final CacheKeys keys;
  private RedisClient redisClient;
  private StatefulRedisConnection<String, String> connection;
  private RedisCommands<String, String> syncCommands;
  private RedisAsyncCommands<String, String> asyncCommands;
  private ScheduledExecutorService healthChecker;
  private volatile boolean available = false;
  private final ConcurrentLinkedDeque<Long> failureTimestamps = new ConcurrentLinkedDeque<>();
  private final AtomicInteger consecutiveSuccesses = new AtomicInteger(0);

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
        recordFailure(new IllegalStateException("Unexpected PING reply: " + reply));
        return;
      }
      recordSuccess();
    } catch (Exception e) {
      recordFailure(e);
    }
  }

  /**
   * Record a successful Redis operation (real op or health-check PING). When the provider is in
   * the unavailable state, this counts toward {@link #RECOVERY_THRESHOLD}; once we've seen that
   * many consecutive successes the flag flips back. While available, success just trims the
   * failure-window deque. Critical that single-PING-success no longer flips us back: that
   * caused the flapping behaviour where every health-check window let one more real op pay a
   * timeout before going to fast-fail again.
   */
  private void recordSuccess() {
    if (!available) {
      int n = consecutiveSuccesses.incrementAndGet();
      if (n >= RECOVERY_THRESHOLD) {
        available = true;
        failureTimestamps.clear();
        consecutiveSuccesses.set(0);
        LOG.info("Redis cache provider recovered after {} consecutive successful ops", n);
      }
      return;
    }
    consecutiveSuccesses.set(0);
    pruneOldFailures(System.currentTimeMillis());
  }

  /**
   * Record a Redis failure (timeout, IO error, unexpected reply). Flips {@code available=false}
   * once the count of failures within {@link #FAILURE_WINDOW_MS} crosses
   * {@link #FAILURE_THRESHOLD}. Older failures fall out of the window automatically. Single
   * transient failures no longer flip the provider — they used to, which combined with eager
   * recovery on the next PING produced the flap pattern that made indexing pay a 300ms timeout
   * per Redis call indefinitely.
   */
  private void recordFailure(Exception e) {
    consecutiveSuccesses.set(0);
    long now = System.currentTimeMillis();
    failureTimestamps.addLast(now);
    pruneOldFailures(now);
    if (available && failureTimestamps.size() >= FAILURE_THRESHOLD) {
      available = false;
      LOG.warn(
          "Redis cache provider marked unavailable: {} failures within {}ms",
          failureTimestamps.size(),
          FAILURE_WINDOW_MS,
          e);
    }
  }

  private void pruneOldFailures(long now) {
    long cutoff = now - FAILURE_WINDOW_MS;
    Iterator<Long> it = failureTimestamps.iterator();
    while (it.hasNext()) {
      if (it.next() < cutoff) {
        it.remove();
      } else {
        break;
      }
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
      recordSuccess();
      return Optional.ofNullable(value);
    } catch (Exception e) {
      if (m != null) m.recordError();
      recordFailure(e);
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
      recordSuccess();
    } catch (Exception e) {
      if (m != null) m.recordError();
      recordFailure(e);
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
      recordSuccess();
      return acquired;
    } catch (Exception e) {
      if (m != null) m.recordError();
      recordFailure(e);
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
      recordSuccess();
    } catch (Exception e) {
      if (m != null) m.recordError();
      recordFailure(e);
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
      recordSuccess();
      return Optional.ofNullable(value);
    } catch (Exception e) {
      if (m != null) m.recordError();
      recordFailure(e);
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
      recordSuccess();
    } catch (Exception e) {
      if (m != null) m.recordError();
      recordFailure(e);
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
      recordSuccess();
    } catch (Exception e) {
      if (m != null) m.recordError();
      recordFailure(e);
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
      recordSuccess();
    } catch (RuntimeException e) {
      if (m != null) m.recordError();
      recordFailure(e);
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
      recordSuccess();
    } catch (RuntimeException e) {
      if (m != null) m.recordError();
      recordFailure(e);
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
  public long scanCount(String pattern) {
    if (!available || pattern == null || pattern.isEmpty()) {
      return -1L;
    }
    try {
      io.lettuce.core.ScanArgs args = io.lettuce.core.ScanArgs.Builder.matches(pattern).limit(1000);
      io.lettuce.core.KeyScanCursor<String> cursor = syncCommands.scan(args);
      long count = cursor.getKeys().size();
      while (!cursor.isFinished()) {
        cursor = syncCommands.scan(cursor, args);
        count += cursor.getKeys().size();
      }
      return count;
    } catch (Exception e) {
      LOG.warn("scanCount failed for pattern={}", pattern, e);
      return -1L;
    }
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
