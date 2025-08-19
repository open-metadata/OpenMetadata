package org.openmetadata.service.cache;

import io.lettuce.core.api.StatefulRedisConnection;
import io.lettuce.core.api.sync.RedisCommands;
import io.lettuce.core.cluster.api.StatefulRedisClusterConnection;
import io.lettuce.core.cluster.api.sync.RedisAdvancedClusterCommands;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * Thin static façade over Redis Hash + tagUsage counter for caching entity relationships.
 * Supports both standalone and cluster Redis configurations.
 */
@Slf4j
public final class RelationshipCache {

  private static volatile boolean initialized = false;
  private static volatile boolean clusterMode = false;
  private static StatefulRedisConnection<String, String> redisConnection;
  private static StatefulRedisClusterConnection<String, String> clusterConnection;

  private static int defaultTtlSeconds;
  private static int maxRetries;

  private static final ScheduledExecutorService retryExecutor = Executors.newScheduledThreadPool(2);

  private static final String RELATIONSHIP_KEY_PREFIX = "rel:";
  private static final String TAG_USAGE_KEY = "tagUsage";
  private static final String CACHE_STATS_KEY = "cache:stats";

  private RelationshipCache() {
    // Utility class - prevent instantiation
  }

  /**
   * Initialize cache with standalone Redis connection
   */
  public static synchronized void initialize(
      StatefulRedisConnection<String, String> connection, int ttlSeconds, int retries) {
    if (initialized) {
      LOG.warn("RelationshipCache already initialized. Skipping re-initialization.");
      return;
    }

    redisConnection = connection;
    defaultTtlSeconds = ttlSeconds;
    maxRetries = retries;
    clusterMode = false;
    initialized = true;

    LOG.info(
        "RelationshipCache initialized with standalone Redis (TTL: {}s, MaxRetries: {})",
        ttlSeconds,
        retries);
  }

  /**
   * Initialize cache with cluster Redis connection
   */
  public static synchronized void initializeCluster(
      StatefulRedisClusterConnection<String, String> connection, int ttlSeconds, int retries) {
    if (initialized) {
      LOG.warn("RelationshipCache already initialized. Skipping re-initialization.");
      return;
    }

    clusterConnection = connection;
    defaultTtlSeconds = ttlSeconds;
    maxRetries = retries;
    clusterMode = true;
    initialized = true;

    LOG.info(
        "RelationshipCache initialized with Redis cluster (TTL: {}s, MaxRetries: {})",
        ttlSeconds,
        retries);
  }

  /**
   * Check if cache is initialized and available
   */
  public static boolean isAvailable() {
    return initialized
        && ((clusterMode && clusterConnection != null)
            || (!clusterMode && redisConnection != null));
  }

  /**
   * Get all relationships for an entity
   */
  public static Map<String, Object> get(String entityId) {
    if (!isAvailable()) {
      LOG.debug("Cache not available, returning empty map for entity: {}", entityId);
      return Collections.emptyMap();
    }

    String key = RELATIONSHIP_KEY_PREFIX + entityId;

    try {
      Map<String, String> rawData =
          executeWithRetry(
              () -> {
                try {
                  if (clusterMode) {
                    return clusterConnection.sync().hgetall(key);
                  } else {
                    return redisConnection.sync().hgetall(key);
                  }
                } catch (Exception e) {
                  throw new RedisCacheException("Failed to get relationships", e);
                }
              });

      if (rawData == null || rawData.isEmpty()) {
        incrementCacheMiss();
        return Collections.emptyMap();
      }

      Map<String, Object> relationships = new HashMap<>();
      for (Map.Entry<String, String> entry : rawData.entrySet()) {
        Object value = deserializeValue(entry.getValue());
        if (value != null) {
          relationships.put(entry.getKey(), value);
        }
      }

      incrementCacheHit();
      LOG.debug("Cache hit for entity: {}, relationships: {}", entityId, relationships.size());
      return relationships;

    } catch (RedisCacheException e) {
      LOG.error("Error retrieving relationships from cache for entity: {}", entityId, e);
      incrementCacheError();
      return Collections.emptyMap();
    }
  }

  /**
   * Store all relationships for an entity
   */
  public static void put(String entityId, Map<String, Object> relationships) {
    if (!isAvailable() || relationships == null || relationships.isEmpty()) {
      return;
    }

    String key = RELATIONSHIP_KEY_PREFIX + entityId;

    try {
      Map<String, String> serializedData = serializeRelationships(relationships);

      if (!serializedData.isEmpty()) {
        storeInRedis(key, serializedData);
        LOG.debug("Cached relationships for entity: {}, count: {}", entityId, relationships.size());
      }

    } catch (RedisCacheException e) {
      LOG.error("Error storing relationships to cache for entity: {}", entityId, e);
      incrementCacheError();
    }
  }

  /**
   * Serialize relationships to Redis-compatible format
   */
  private static Map<String, String> serializeRelationships(Map<String, Object> relationships) {
    Map<String, String> serializedData = new HashMap<>();
    for (Map.Entry<String, Object> entry : relationships.entrySet()) {
      String serializedValue = serializeValue(entry.getValue());
      if (serializedValue != null) {
        serializedData.put(entry.getKey(), serializedValue);
      }
    }
    return serializedData;
  }

  /**
   * Store serialized data in Redis with TTL
   */
  private static void storeInRedis(String key, Map<String, String> data)
      throws RedisCacheException {
    executeWithRetry(
        () -> {
          try {
            if (clusterMode) {
              RedisAdvancedClusterCommands<String, String> commands = clusterConnection.sync();
              commands.hset(key, data);
              if (defaultTtlSeconds > 0) {
                commands.expire(key, defaultTtlSeconds);
              }
            } else {
              RedisCommands<String, String> commands = redisConnection.sync();
              commands.hset(key, data);
              if (defaultTtlSeconds > 0) {
                commands.expire(key, defaultTtlSeconds);
              }
            }
            return null;
          } catch (Exception e) {
            throw new RedisCacheException("Failed to store in Redis", e);
          }
        });
  }

  /**
   * Evict relationships for an entity
   */
  public static void evict(String entityId) {
    if (!isAvailable()) {
      return;
    }

    String key = RELATIONSHIP_KEY_PREFIX + entityId;

    try {
      executeWithRetry(
          () -> {
            try {
              if (clusterMode) {
                return clusterConnection.sync().del(key);
              } else {
                return redisConnection.sync().del(key);
              }
            } catch (Exception e) {
              throw new RedisCacheException("Failed to evict cache for entity: " + entityId, e);
            }
          });

      LOG.debug("Evicted cache for entity: {}", entityId);

    } catch (RedisCacheException e) {
      LOG.error("Error evicting cache for entity: {}", entityId, e);
    }
  }

  /**
   * Evict all keys matching a pattern
   * @param pattern The pattern to match (e.g., "tags:prefix:*")
   */
  public static void evictPattern(String pattern) {
    if (!isAvailable()) {
      return;
    }

    String fullPattern = RELATIONSHIP_KEY_PREFIX + pattern;

    try {
      executeWithRetry(
          () -> {
            try {
              if (clusterMode) {
                // In cluster mode, use KEYS command (SCAN is complex across nodes)
                RedisAdvancedClusterCommands<String, String> commands = clusterConnection.sync();
                List<String> keysToDelete = commands.keys(fullPattern);
                if (!keysToDelete.isEmpty()) {
                  return commands.del(keysToDelete.toArray(new String[0]));
                }
              } else {
                RedisCommands<String, String> commands = redisConnection.sync();
                // For non-cluster mode, use KEYS command for simplicity
                // Note: KEYS can be slow on large datasets, but cache keys are limited
                List<String> keysToDelete = commands.keys(fullPattern);
                if (!keysToDelete.isEmpty()) {
                  return commands.del(keysToDelete.toArray(new String[0]));
                }
              }
              return 0L;
            } catch (Exception e) {
              throw new RedisCacheException("Failed to evict pattern: " + pattern, e);
            }
          });

      LOG.debug("Evicted cache keys matching pattern: {}", pattern);

    } catch (RedisCacheException e) {
      LOG.error("Error evicting pattern {}: {}", pattern, e.getMessage());
    }
  }

  /**
   * Increment tag usage counter
   */
  public static void bumpTag(String tagId, long delta) {
    if (!isAvailable()) {
      return;
    }

    try {
      executeWithRetry(
          () -> {
            try {
              if (clusterMode) {
                return clusterConnection.sync().hincrby(TAG_USAGE_KEY, tagId, delta);
              } else {
                return redisConnection.sync().hincrby(TAG_USAGE_KEY, tagId, delta);
              }
            } catch (Exception e) {
              throw new RedisCacheException("Failed to bump tag usage for tag: " + tagId, e);
            }
          });

    } catch (RedisCacheException e) {
      LOG.error("Error updating tag usage for tag: {}", tagId, e);
    }
  }

  /**
   * Get tag usage count
   */
  public static long getTagUsage(String tagId) {
    if (!isAvailable()) {
      return 0L;
    }

    try {
      String value =
          executeWithRetry(
              () -> {
                try {
                  if (clusterMode) {
                    return clusterConnection.sync().hget(TAG_USAGE_KEY, tagId);
                  } else {
                    return redisConnection.sync().hget(TAG_USAGE_KEY, tagId);
                  }
                } catch (Exception e) {
                  throw new RedisCacheException("Failed to get tag usage for tag: " + tagId, e);
                }
              });

      return value != null ? Long.parseLong(value) : 0L;

    } catch (RedisCacheException e) {
      LOG.error("Error retrieving tag usage for tag: {}", tagId, e);
      return 0L;
    }
  }

  /**
   * Get cache statistics
   */
  public static Map<String, Long> getCacheStats() {
    if (!isAvailable()) {
      return Collections.emptyMap();
    }

    try {
      Map<String, String> rawStats =
          executeWithRetry(
              () -> {
                try {
                  if (clusterMode) {
                    return clusterConnection.sync().hgetall(CACHE_STATS_KEY);
                  } else {
                    return redisConnection.sync().hgetall(CACHE_STATS_KEY);
                  }
                } catch (Exception e) {
                  throw new RedisCacheException("Failed to get cache statistics", e);
                }
              });

      return parseStatsMap(rawStats);

    } catch (RedisCacheException e) {
      LOG.error("Error retrieving cache statistics", e);
      return Collections.emptyMap();
    }
  }

  /**
   * Parse raw stats map to Long values
   */
  private static Map<String, Long> parseStatsMap(Map<String, String> rawStats) {
    Map<String, Long> stats = new HashMap<>();
    for (Map.Entry<String, String> entry : rawStats.entrySet()) {
      parseSingleStat(entry, stats);
    }
    return stats;
  }

  /**
   * Parse a single stat entry
   */
  private static void parseSingleStat(Map.Entry<String, String> entry, Map<String, Long> stats) {
    try {
      stats.put(entry.getKey(), Long.parseLong(entry.getValue()));
    } catch (NumberFormatException e) {
      LOG.warn("Invalid stat value for {}: {}", entry.getKey(), entry.getValue());
    }
  }

  /**
   * Clear all cache data (use with caution)
   */
  public static void clearAll() {
    if (!isAvailable()) {
      return;
    }

    try {
      executeWithRetry(
          () -> {
            try {
              if (clusterMode) {
                // For cluster mode, we'd need to iterate through all nodes
                // This is a simplified implementation
                LOG.warn("clearAll() in cluster mode requires careful implementation");
                return null;
              } else {
                return redisConnection.sync().flushdb();
              }
            } catch (Exception e) {
              throw new RedisCacheException("Failed to clear all cache data", e);
            }
          });

      LOG.info("Cleared all cache data");

    } catch (RedisCacheException e) {
      LOG.error("Error clearing cache", e);
    }
  }

  /**
   * Execute Redis command with retry logic using non-blocking approach
   */
  private static <T> T executeWithRetry(RedisOperation<T> operation) throws RedisCacheException {
    CompletableFuture<T> future = executeWithRetryAsync(operation, 0);

    try {
      return future.get();
    } catch (CompletionException e) {
      Throwable cause = e.getCause();
      if (cause instanceof Exception exception) {
        throw new RedisCacheException("Redis operation failed", exception);
      }
      throw new RedisCacheException("Redis operation failed", cause);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new RedisCacheException("Redis operation interrupted", e);
    } catch (Exception e) {
      throw new RedisCacheException("Unexpected error during Redis operation", e);
    }
  }

  /**
   * Execute Redis command with async retry logic
   */
  private static <T> CompletableFuture<T> executeWithRetryAsync(
      RedisOperation<T> operation, int attempt) {

    return CompletableFuture.supplyAsync(
            () -> {
              try {
                return operation.execute();
              } catch (RedisCacheException e) {
                throw new CompletionException(e);
              }
            })
        .exceptionally(
            throwable -> {
              if (attempt >= maxRetries) {
                LOG.error(
                    "Redis operation failed after {} attempts: {}",
                    maxRetries + 1,
                    throwable.getMessage());
                throw new CompletionException(
                    "Redis operation failed after " + (maxRetries + 1) + " attempts", throwable);
              }

              long backoffMs = (long) Math.pow(2, attempt) * 100;
              LOG.warn(
                  "Redis operation failed, scheduling retry (attempt {}/{}): {}",
                  attempt + 1,
                  maxRetries + 1,
                  throwable.getMessage());

              CompletableFuture<T> retryFuture = new CompletableFuture<>();
              retryExecutor.schedule(
                  () ->
                      executeWithRetryAsync(operation, attempt + 1)
                          .whenComplete(
                              (result, error) -> {
                                if (error != null) {
                                  retryFuture.completeExceptionally(error);
                                } else {
                                  retryFuture.complete(result);
                                }
                              }),
                  backoffMs,
                  TimeUnit.MILLISECONDS);

              return retryFuture.join();
            });
  }

  /**
   * Serialize object to JSON string
   */
  private static String serializeValue(Object value) {
    if (value == null) {
      return null;
    }

    try {
      return JsonUtils.pojoToJson(value);
    } catch (Exception e) {
      LOG.error("Error serializing value: {}", value, e);
      return null;
    }
  }

  /**
   * Deserialize JSON string to object
   */
  private static Object deserializeValue(String json) {
    if (json == null || json.trim().isEmpty()) {
      return null;
    }

    try {
      // Try to deserialize as a generic object
      return JsonUtils.readValue(json, Object.class);
    } catch (Exception e) {
      LOG.error("Error deserializing value: {}", json, e);
      return null;
    }
  }

  /**
   * Increment cache hit counter
   */
  private static void incrementCacheHit() {
    incrementStat("hits");
  }

  /**
   * Increment cache miss counter
   */
  private static void incrementCacheMiss() {
    incrementStat("misses");
  }

  /**
   * Increment cache error counter
   */
  private static void incrementCacheError() {
    incrementStat("errors");
  }

  /**
   * Increment a statistic counter
   */
  private static void incrementStat(String statName) {
    try {
      executeWithRetry(
          () -> {
            try {
              if (clusterMode) {
                return clusterConnection.sync().hincrby(CACHE_STATS_KEY, statName, 1);
              } else {
                return redisConnection.sync().hincrby(CACHE_STATS_KEY, statName, 1);
              }
            } catch (Exception e) {
              throw new RedisCacheException("Failed to increment stat: " + statName, e);
            }
          });
    } catch (RedisCacheException e) {
      LOG.debug("Error incrementing stat {}: {}", statName, e.getMessage());
    }
  }

  /**
   * Functional interface for Redis operations
   */
  @FunctionalInterface
  private interface RedisOperation<T> {
    T execute() throws RedisCacheException;
  }

  /**
   * Shutdown the retry executor (call during application shutdown)
   */
  public static void shutdown() {
    retryExecutor.shutdown();
    try {
      if (!retryExecutor.awaitTermination(5, TimeUnit.SECONDS)) {
        retryExecutor.shutdownNow();
      }
    } catch (InterruptedException e) {
      retryExecutor.shutdownNow();
      Thread.currentThread().interrupt();
    }
  }
}
