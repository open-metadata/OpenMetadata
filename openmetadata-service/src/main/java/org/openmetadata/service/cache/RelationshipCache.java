package org.openmetadata.service.cache;

import io.lettuce.core.api.StatefulRedisConnection;
import io.lettuce.core.api.sync.RedisCommands;
import io.lettuce.core.cluster.api.StatefulRedisClusterConnection;
import io.lettuce.core.cluster.api.sync.RedisAdvancedClusterCommands;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.util.JsonUtils;

/**
 * Thin static façade over Redis Hash + tagUsage counter for caching entity relationships.
 * Supports both standalone and cluster Redis configurations.
 */
@Slf4j
public final class RelationshipCache {

  private static volatile boolean initialized = false;
  private static volatile boolean clusterMode = false;

  // Standalone Redis connection
  private static StatefulRedisConnection<String, String> redisConnection;

  // Cluster Redis connection
  private static StatefulRedisClusterConnection<String, String> clusterConnection;

  private static int defaultTtlSeconds;
  private static int maxRetries;

  // Cache key prefixes
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
      LOG.debug("Cache not available, returning null for entity: {}", entityId);
      return null;
    }

    String key = RELATIONSHIP_KEY_PREFIX + entityId;

    try {
      Map<String, String> rawData =
          executeWithRetry(
              () -> {
                if (clusterMode) {
                  return clusterConnection.sync().hgetall(key);
                } else {
                  return redisConnection.sync().hgetall(key);
                }
              });

      if (rawData == null || rawData.isEmpty()) {
        incrementCacheMiss();
        return null;
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

    } catch (Exception e) {
      LOG.error("Error retrieving relationships from cache for entity: {}", entityId, e);
      incrementCacheError();
      return null;
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
      Map<String, String> serializedData = new HashMap<>();
      for (Map.Entry<String, Object> entry : relationships.entrySet()) {
        String serializedValue = serializeValue(entry.getValue());
        if (serializedValue != null) {
          serializedData.put(entry.getKey(), serializedValue);
        }
      }

      if (!serializedData.isEmpty()) {
        executeWithRetry(
            () -> {
              if (clusterMode) {
                RedisAdvancedClusterCommands<String, String> commands = clusterConnection.sync();
                commands.hset(key, serializedData);
                if (defaultTtlSeconds > 0) {
                  commands.expire(key, defaultTtlSeconds);
                }
              } else {
                RedisCommands<String, String> commands = redisConnection.sync();
                commands.hset(key, serializedData);
                if (defaultTtlSeconds > 0) {
                  commands.expire(key, defaultTtlSeconds);
                }
              }
              return null;
            });

        LOG.debug("Cached relationships for entity: {}, count: {}", entityId, relationships.size());
      }

    } catch (Exception e) {
      LOG.error("Error storing relationships to cache for entity: {}", entityId, e);
      incrementCacheError();
    }
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
            if (clusterMode) {
              return clusterConnection.sync().del(key);
            } else {
              return redisConnection.sync().del(key);
            }
          });

      LOG.debug("Evicted cache for entity: {}", entityId);

    } catch (Exception e) {
      LOG.error("Error evicting cache for entity: {}", entityId, e);
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
            if (clusterMode) {
              return clusterConnection.sync().hincrby(TAG_USAGE_KEY, tagId, delta);
            } else {
              return redisConnection.sync().hincrby(TAG_USAGE_KEY, tagId, delta);
            }
          });

    } catch (Exception e) {
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
                if (clusterMode) {
                  return clusterConnection.sync().hget(TAG_USAGE_KEY, tagId);
                } else {
                  return redisConnection.sync().hget(TAG_USAGE_KEY, tagId);
                }
              });

      return value != null ? Long.parseLong(value) : 0L;

    } catch (Exception e) {
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
                if (clusterMode) {
                  return clusterConnection.sync().hgetall(CACHE_STATS_KEY);
                } else {
                  return redisConnection.sync().hgetall(CACHE_STATS_KEY);
                }
              });

      Map<String, Long> stats = new HashMap<>();
      for (Map.Entry<String, String> entry : rawStats.entrySet()) {
        try {
          stats.put(entry.getKey(), Long.parseLong(entry.getValue()));
        } catch (NumberFormatException e) {
          LOG.warn("Invalid stat value for {}: {}", entry.getKey(), entry.getValue());
        }
      }

      return stats;

    } catch (Exception e) {
      LOG.error("Error retrieving cache statistics", e);
      return Collections.emptyMap();
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
            if (clusterMode) {
              // For cluster mode, we'd need to iterate through all nodes
              // This is a simplified implementation
              LOG.warn("clearAll() in cluster mode requires careful implementation");
              return null;
            } else {
              return redisConnection.sync().flushdb();
            }
          });

      LOG.info("Cleared all cache data");

    } catch (Exception e) {
      LOG.error("Error clearing cache", e);
    }
  }

  /**
   * Execute Redis command with retry logic
   */
  private static <T> T executeWithRetry(RedisOperation<T> operation) throws Exception {
    Exception lastException = null;

    for (int attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return operation.execute();
      } catch (Exception e) {
        lastException = e;
        if (attempt < maxRetries) {
          long backoffMs = (long) Math.pow(2, attempt) * 100; // Exponential backoff
          try {
            Thread.sleep(backoffMs);
          } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
            throw e;
          }
          LOG.warn(
              "Redis operation failed, retrying (attempt {}/{}): {}",
              attempt + 1,
              maxRetries + 1,
              e.getMessage());
        }
      }
    }

    throw new RuntimeException(
        "Redis operation failed after " + (maxRetries + 1) + " attempts", lastException);
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
            if (clusterMode) {
              return clusterConnection.sync().hincrby(CACHE_STATS_KEY, statName, 1);
            } else {
              return redisConnection.sync().hincrby(CACHE_STATS_KEY, statName, 1);
            }
          });
    } catch (Exception e) {
      LOG.debug("Error incrementing stat {}: {}", statName, e.getMessage());
    }
  }

  /**
   * Functional interface for Redis operations
   */
  @FunctionalInterface
  private interface RedisOperation<T> {
    T execute() throws Exception;
  }
}
