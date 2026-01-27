package org.openmetadata.service.search.lineage;

import com.google.common.cache.CacheStats;
import java.util.Optional;
import org.openmetadata.schema.api.lineage.SearchLineageResult;

/**
 * Cache interface for lineage graph results.
 * Provides abstraction over different cache implementations (Guava, Redis, etc.).
 *
 * <p>Implementations must:
 * - Support TTL-based expiration
 * - Implement LRU or similar eviction policy
 * - Provide cache statistics (hits, misses, evictions)
 * - Be thread-safe for concurrent access
 *
 * <p>Cache eligibility (should cache):
 * - Small graphs (< 5K nodes): Always
 * - Medium graphs (5K-50K nodes): Always
 * - Large graphs (50K-100K nodes): Never
 * - Streaming graphs (> 100K nodes): Never
 */
public interface LineageGraphCache {

  /**
   * Retrieves cached lineage result for the given key.
   *
   * @param key Cache key containing request parameters
   * @return Optional containing cached result if present, empty otherwise
   */
  Optional<SearchLineageResult> get(LineageCacheKey key);

  /**
   * Stores lineage result in cache with the given key.
   * Result will expire based on configured TTL.
   *
   * @param key Cache key containing request parameters
   * @param result Lineage result to cache
   */
  void put(LineageCacheKey key, SearchLineageResult result);

  /**
   * Invalidates (removes) cached entry for the given key.
   *
   * @param key Cache key to invalidate
   */
  void invalidate(LineageCacheKey key);

  /**
   * Invalidates all cached entries.
   * Use with caution - clears entire cache.
   */
  void invalidateAll();

  /**
   * Gets cache statistics for monitoring and metrics.
   *
   * @return Cache statistics including hits, misses, evictions, etc.
   */
  CacheStats getStats();

  /**
   * Gets current number of entries in cache.
   *
   * @return Cache size (number of entries)
   */
  long size();

  /**
   * Performs cleanup of expired entries if needed.
   * Some implementations (like Guava) do this automatically.
   */
  default void cleanUp() {
    // Default no-op, implementations can override if needed
  }
}
