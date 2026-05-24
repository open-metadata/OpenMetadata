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
  //
  // Tradeoff: the detector intentionally tolerates up to FAILURE_THRESHOLD-1 transient errors
  // before flipping unavailable. During that admit-window other OM pods that subscribed to
  // invalidation pubsub may serve stale Guava L1 reads if the failures are invalidation
  // broadcasts that didn't make it across. We accept this over the previous flap, because:
  //   1. L1 entries TTL out within the entity TTL anyway (default 30s, well under FAILURE_WINDOW),
  //   2. the prior single-failure flip caused a much larger correctness gap — every Redis op
  //      paid 300ms before the provider went unavailable, then the next PING let one more op
  //      pay it again, indefinitely,
  //   3. once unavailable, EntityResource fully bypasses cached reads (RECOVERY_THRESHOLD also
  //      keeps the bypass stable across flaky moments).
  // If you need stricter L1 coherence (e.g. a deployment that can't tolerate any stale reads),
  // lower FAILURE_THRESHOLD to 1 — accepting the flap cost — or pair this with a shorter
  // entity TTL.
  private static final int FAILURE_THRESHOLD = 5;
  private static final long FAILURE_WINDOW_MS = 30_000L;
  private static final int RECOVERY_THRESHOLD = 3;

  private final CacheConfig config;
  private final CacheKeys keys;
  private RedisClient redisClient;
  private StatefulRedisConnection<String, String> connection;
  private RedisCommands<String, String> syncCommands;
  private RedisAsyncCommands<String, String> asyncCommands;
  // Dedicated Lettuce connection used ONLY for pipelined operations (currently {@link #mget}).
  // Pipelining toggles `setAutoFlushCommands(false)` which is a property of the connection
  // instance — if we did that on the shared `connection`, every concurrent caller using
  // syncCommands/asyncCommands would have their commands buffered for the duration of the
  // pipeline, producing latency spikes / apparent hangs on unrelated request paths. The
  // dedicated connection lets us flip auto-flush freely without disturbing anyone else.
  private StatefulRedisConnection<String, String> pipelineConnection;
  private RedisAsyncCommands<String, String> pipelineAsyncCommands;
  private ScheduledExecutorService healthChecker;
  private volatile boolean available = false;
  private final ConcurrentLinkedDeque<Long> failureTimestamps = new ConcurrentLinkedDeque<>();
  private final AtomicInteger consecutiveSuccesses = new AtomicInteger(0);
  // Serializes the recordSuccess / recordFailure / pruneOldFailures state transitions so a
  // concurrent failure can't slip in between the success path's read of `available` and its
  // write, and vice versa. The methods themselves are not on the hot path (one call per Redis
  // op outcome), so the lock cost is negligible compared to the round-trip we're already paying.
  private final Object stateLock = new Object();

  // Serializes pipelined operations (currently {@link #mget}) that toggle
  // {@code setAutoFlushCommands(false)} on the shared Lettuce connection. Without this lock
  // two concurrent pipelines could overlap and the first one's commands would be buffered
  // while the second is still issuing GETs — observable as random latency spikes and apparent
  // hangs in other paths sharing the connection. We hold the lock for one pipeline at a time
  // and unconditionally restore auto-flush in a finally.
  private final java.util.concurrent.locks.ReentrantLock pipelineLock =
      new java.util.concurrent.locks.ReentrantLock();

  public RedisCacheProvider(CacheConfig config) {
    this.config = config;
    this.keys = new CacheKeys(config.redis.keyspace);
    initialize();
  }

  // Package-private no-arg constructor used by tests that exercise the sliding-window
  // availability state machine without a live Redis connection. Skips initialize() — no
  // Lettuce client is opened, no health-checker is started.
  RedisCacheProvider() {
    this.config = null;
    this.keys = null;
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
   *
   * <p>Synchronized with {@link #recordFailure(Exception)} on {@link #stateLock} so a concurrent
   * failure can't be racing with the {@code consecutiveSuccesses}/{@code available} transitions.
   */
  private void recordSuccess() {
    synchronized (stateLock) {
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
  }

  /**
   * Record a Redis failure (timeout, IO error, unexpected reply). Flips {@code available=false}
   * once the count of failures within {@link #FAILURE_WINDOW_MS} crosses
   * {@link #FAILURE_THRESHOLD}. Older failures fall out of the window automatically. Single
   * transient failures no longer flip the provider — they used to, which combined with eager
   * recovery on the next PING produced the flap pattern that made indexing pay a 300ms timeout
   * per Redis call indefinitely.
   *
   * <p>Synchronized with {@link #recordSuccess()} on {@link #stateLock} so a concurrent
   * success-recovery transition can't observe a half-applied failure (or vice versa).
   */
  private void recordFailure(Exception e) {
    synchronized (stateLock) {
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
  }

  /**
   * Drop failure timestamps older than the sliding window. Always called under {@link
   * #stateLock}. Iterates the entire deque rather than breaking on the first non-stale entry —
   * concurrent {@code addLast} calls from {@link #recordFailure(Exception)} aren't strictly
   * ordered (the {@code currentTimeMillis()} sample and the {@code addLast} happen in
   * separate steps even under the lock, but the bound is small), so a strictly-monotonic
   * assumption would occasionally leave stale entries behind.
   */
  private void pruneOldFailures(long now) {
    long cutoff = now - FAILURE_WINDOW_MS;
    Iterator<Long> it = failureTimestamps.iterator();
    while (it.hasNext()) {
      if (it.next() < cutoff) {
        it.remove();
      }
    }
  }

  private void initializeStandalone(RedisURI uri) {
    redisClient = RedisClient.create(uri);
    connection = redisClient.connect();
    connection.setTimeout(Duration.ofMillis(config.redis.commandTimeoutMs));
    syncCommands = connection.sync();
    asyncCommands = connection.async();
    // Separate physical connection so mget's setAutoFlushCommands(false) window can't
    // interfere with single-key ops running on the main connection.
    pipelineConnection = redisClient.connect();
    pipelineConnection.setTimeout(Duration.ofMillis(config.redis.commandTimeoutMs));
    pipelineAsyncCommands = pipelineConnection.async();
    LOG.info("Initialized Redis connections (primary + pipeline)");
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

  /**
   * Bump the slow-read counter and emit a WARN log when a read exceeds the configured threshold.
   * Called from {@code finally} blocks of the read primitives so it fires on success and on the
   * timeout path. {@code thresholdMs <= 0} disables the check entirely. Bounded by the existing
   * Redis command timeout (default 300ms) so we can't log indefinitely.
   */
  private void checkSlowRead(CacheMetrics m, String key, long startNanos) {
    int thresholdMs = config != null ? config.slowReadThresholdMs : 0;
    if (thresholdMs <= 0) return;
    long elapsedMs = (System.nanoTime() - startNanos) / 1_000_000L;
    if (elapsedMs >= thresholdMs) {
      if (m != null) m.recordSlowRead();
      LOG.warn("cache: slow read key={} duration={}ms threshold={}ms", key, elapsedMs, thresholdMs);
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
    long startNanos = System.nanoTime();
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
      checkSlowRead(m, key, startNanos);
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
    long startNanos = System.nanoTime();
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
      checkSlowRead(m, key, startNanos);
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
  public void hset(String key, Map<String, String> fields) {
    if (!available || fields.isEmpty()) return;
    CacheMetrics m = metrics();
    Timer.Sample sample = startWriteTimer(m);
    try {
      // Plain HSET: leaves any existing TTL on the hash key alone. Pair with
      // {@link #expireIfAbsent} when the caller wants TTL set only on first write.
      syncCommands.hset(key, fields);
      if (m != null) m.recordWrite();
      recordSuccess();
    } catch (Exception e) {
      if (m != null) m.recordError();
      recordFailure(e);
      LOG.error("Error setting hash fields (no-ttl): {}", key, e);
    } finally {
      stopWriteTimer(m, sample);
    }
  }

  @Override
  public boolean expireIfAbsent(String key, Duration ttl) {
    if (!available || ttl == null || ttl.getSeconds() <= 0) return false;
    try {
      // EXPIRE key seconds NX — only set when no prior TTL exists. Available since Redis 7.0;
      // Lettuce exposes it via ExpireArgs.Builder.nx(). Returns true on the first writer to
      // claim the expiry, false on subsequent writers and on missing keys.
      boolean claimed =
          Boolean.TRUE.equals(
              syncCommands.expire(key, ttl.getSeconds(), io.lettuce.core.ExpireArgs.Builder.nx()));
      recordSuccess();
      return claimed;
    } catch (Exception e) {
      // Older Redis (<7.0) doesn't support EXPIRE … NX and returns a syntax error. Fall back
      // to plain EXPIRE so the key still gets a bounded lifetime — extending it on every
      // variant write is worse than the strict NX semantics, but vastly better than letting
      // the key live forever and accumulate in Redis memory until the next manual
      // invalidation. Feed each outcome into the circuit breaker so a real network failure
      // here counts toward the failure-window detector instead of being silently swallowed.
      LOG.debug("expireIfAbsent failed for key={}; falling back to plain EXPIRE", key, e);
      try {
        boolean result = Boolean.TRUE.equals(syncCommands.expire(key, ttl.getSeconds()));
        recordSuccess();
        return result;
      } catch (Exception fallback) {
        recordFailure(fallback);
        LOG.debug("Plain EXPIRE fallback also failed for key={}", key, fallback);
        return false;
      }
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

  /**
   * Pipelined batch GET. Issues all GETs without flushing, then flushes once and awaits all
   * responses — single TCP round-trip when the underlying connection is healthy. Falls back
   * to per-key empties on the error path so callers get a same-shape result either way.
   *
   * <p>Note: we use individual GETs in pipeline mode rather than {@code MGET} so that keys
   * hashing to different slots in a Redis Cluster deployment work transparently. Real
   * {@code MGET} requires same-slot keys (Redis Cluster restriction); the per-key pipeline
   * approach has the same network cost (one round-trip) without the slot constraint.
   */
  @Override
  public java.util.List<java.util.Optional<String>> mget(java.util.List<String> keys) {
    // Empty input → empty output is fine (no positions to align). For the unavailable
    // fast-path we must still return one Optional.empty() per requested key so callers that
    // index by position (CachedReadBundle.getBatch, etc.) stay aligned with their input list.
    // Same shape as the error-fallback branch below — keep them consistent.
    if (keys == null || keys.isEmpty()) {
      return java.util.Collections.emptyList();
    }
    if (!available) {
      java.util.List<java.util.Optional<String>> out = new java.util.ArrayList<>(keys.size());
      for (int i = 0; i < keys.size(); i++) {
        out.add(java.util.Optional.empty());
      }
      return out;
    }
    int n = keys.size();
    CacheMetrics m = metrics();
    Timer.Sample sample = startReadTimer(m);
    long startNanos = System.nanoTime();
    try {
      // Use the dedicated pipeline connection so setAutoFlushCommands(false) doesn't disturb
      // the shared `connection` that everyone else uses. pipelineLock still serializes mget
      // vs mget on this dedicated connection (auto-flush is per-connection but per-call
      // toggling still needs strict ordering between concurrent mgets).
      pipelineLock.lock();
      java.util.List<io.lettuce.core.RedisFuture<String>> futures = new java.util.ArrayList<>(n);
      try {
        pipelineConnection.setAutoFlushCommands(false);
        try {
          for (String k : keys) {
            futures.add(k == null ? null : pipelineAsyncCommands.get(k));
          }
          pipelineConnection.flushCommands();
        } finally {
          // Restore auto-flush before releasing the lock so the next mget caller sees a
          // clean baseline; finally guarantees this runs even if queue/flush throw.
          pipelineConnection.setAutoFlushCommands(true);
        }
      } finally {
        pipelineLock.unlock();
      }
      io.lettuce.core.RedisFuture<?>[] nonNullFutures =
          futures.stream()
              .filter(java.util.Objects::nonNull)
              .toArray(io.lettuce.core.RedisFuture[]::new);
      long perCallTimeoutMs = Math.max(1000L, config.redis.commandTimeoutMs * 2L);
      boolean allCompleted =
          io.lettuce.core.LettuceFutures.awaitAll(
              java.time.Duration.ofMillis(perCallTimeoutMs), nonNullFutures);
      // If awaitAll timed out, some futures are still in flight. Cancel them now — the
      // unbounded f.get() below would otherwise block the request thread indefinitely
      // while the Lettuce event loop holds the response slot open.
      if (!allCompleted) {
        for (io.lettuce.core.RedisFuture<?> f : nonNullFutures) {
          if (!f.isDone()) {
            f.cancel(false);
          }
        }
        LOG.warn("Pipelined mget timed out after {}ms for {} keys", perCallTimeoutMs, n);
        // Feed the partial timeout into the circuit breaker. Without this, persistent
        // partial timeouts (Redis answering some keys, dropping others) would keep
        // calling recordSuccess() and consecutiveSuccesses would prevent the breaker
        // from ever opening — masking real backend slowness behind a "healthy" provider.
        if (m != null) {
          m.recordError();
        }
        recordFailure(
            new java.util.concurrent.TimeoutException(
                "mget partial timeout after " + perCallTimeoutMs + "ms"));
      }
      java.util.List<java.util.Optional<String>> out = new java.util.ArrayList<>(n);
      int hits = 0;
      int misses = 0;
      for (io.lettuce.core.RedisFuture<String> f : futures) {
        if (f == null) {
          out.add(java.util.Optional.empty());
          continue;
        }
        // After cancel-on-timeout above every future is done one way or another — got a
        // value, errored, or was cancelled — so f.get() can't block.
        try {
          String v = f.get();
          out.add(java.util.Optional.ofNullable(v));
          if (v != null) {
            hits++;
          } else {
            misses++;
          }
        } catch (Exception inner) {
          out.add(java.util.Optional.empty());
          misses++;
        }
      }
      if (m != null) {
        for (int i = 0; i < hits; i++) {
          m.recordHit();
        }
        for (int i = 0; i < misses; i++) {
          m.recordMiss();
        }
      }
      // Only the all-completed path is a "success" for the circuit breaker. The
      // partial-timeout path already called recordFailure() above.
      if (allCompleted) {
        recordSuccess();
      }
      return out;
    } catch (Exception e) {
      if (m != null) {
        m.recordError();
      }
      recordFailure(e);
      LOG.error("Error in mget for {} keys", n, e);
      java.util.List<java.util.Optional<String>> out = new java.util.ArrayList<>(n);
      for (int i = 0; i < n; i++) {
        out.add(java.util.Optional.empty());
      }
      return out;
    } finally {
      stopReadTimer(m, sample);
      checkSlowRead(m, "mget(" + n + ")", startNanos);
    }
  }

  @Override
  public long scanDelete(String pattern) {
    if (!available || pattern == null || pattern.isEmpty()) {
      return 0L;
    }
    long deleted = 0L;
    try {
      io.lettuce.core.ScanArgs args = io.lettuce.core.ScanArgs.Builder.matches(pattern).limit(500);
      io.lettuce.core.KeyScanCursor<String> cursor = syncCommands.scan(args);
      while (true) {
        java.util.List<String> keys = cursor.getKeys();
        if (!keys.isEmpty()) {
          // UNLINK is async-delete on the Redis side — same effect as DEL but doesn't block the
          // event loop on large value reclamation. Falls back to DEL on Redis < 4.0, which we do
          // not target.
          deleted += syncCommands.unlink(keys.toArray(new String[0]));
          CacheMetrics m = metrics();
          if (m != null) {
            for (int i = 0; i < keys.size(); i++) m.recordEviction();
          }
        }
        if (cursor.isFinished()) break;
        cursor = syncCommands.scan(cursor, args);
      }
      return deleted;
    } catch (Exception e) {
      LOG.warn("scanDelete failed for pattern={}", pattern, e);
      CacheMetrics m = metrics();
      if (m != null) m.recordError();
      return deleted;
    }
  }

  @Override
  public void close() {
    try {
      if (healthChecker != null) {
        healthChecker.shutdownNow();
      }
      if (pipelineConnection != null) {
        pipelineConnection.close();
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
