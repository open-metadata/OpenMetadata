package org.openmetadata.service.search.lineage;

import com.google.common.cache.Cache;
import com.google.common.cache.CacheBuilder;
import com.google.common.cache.CacheStats;
import com.google.common.cache.RemovalCause;
import com.google.common.cache.RemovalListener;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.TimeUnit;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.lineage.SearchLineageResult;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * Guava-based implementation of LineageGraphCache.
 * Uses in-memory LoadingCache with LRU eviction and TTL expiration.
 *
 * <p>Features:
 * - TTL-based expiration (default: 5 minutes)
 * - LRU eviction when max size reached (default: 100 graphs)
 * - Thread-safe for concurrent access
 * - Cache statistics for monitoring
 * - Automatic cleanup of expired entries
 *
 * <p>Configuration from LineageGraphConfiguration:
 * - cacheTTLSeconds: Time-to-live in seconds (default: 300)
 * - maxCachedGraphs: Maximum number of cached graphs (default: 100)
 *
 * <p>Cache eligibility (caller's responsibility):
 * - Small graphs (< 5K nodes): Should cache
 * - Medium graphs (5K-50K nodes): Should cache
 * - Large graphs (50K-100K nodes): Should NOT cache
 * - Streaming graphs (> 100K nodes): Should NOT cache
 */
@Slf4j
public class GuavaLineageGraphCache implements LineageGraphCache {

  /**
   * A graph is stored serialized and read back as a new object on every hit, so no caller ever
   * holds the stored graph: each request filters its own copy for its caller
   * (ADR:2026-10-30-search-lineage-returns-only-assets-the-caller-can-view). The FQNs the graph
   * references are kept beside it so invalidation does not have to read the graph back.
   */
  private record CachedGraph(byte[] json, int nodeCount, Set<String> fqns) {}

  private final Cache<LineageCacheKey, CachedGraph> cache;
  private final LineageGraphConfiguration config;

  /**
   * Creates Guava-based lineage cache with configuration.
   *
   * @param config Lineage graph configuration containing cache settings
   */
  public GuavaLineageGraphCache(LineageGraphConfiguration config) {
    this.config = config;

    // Build cache with TTL, max size, and removal listener
    this.cache =
        CacheBuilder.newBuilder()
            .maximumSize(config.getMaxCachedGraphs())
            .expireAfterWrite(config.getCacheTTLSeconds(), TimeUnit.SECONDS)
            .recordStats() // Enable statistics collection
            .removalListener(
                (RemovalListener<LineageCacheKey, CachedGraph>)
                    notification -> {
                      // Log evictions for monitoring
                      if (notification.getCause() == RemovalCause.SIZE) {
                        LOG.debug(
                            "Cache eviction (SIZE): key={}, cause={}",
                            notification.getKey(),
                            notification.getCause());
                      } else if (notification.getCause() == RemovalCause.EXPIRED) {
                        LOG.debug(
                            "Cache eviction (EXPIRED): key={}, ttl={}s",
                            notification.getKey(),
                            config.getCacheTTLSeconds());
                      }
                    })
            .build();

    LOG.info(
        "Initialized GuavaLineageGraphCache: maxSize={}, ttlSeconds={}",
        config.getMaxCachedGraphs(),
        config.getCacheTTLSeconds());
  }

  @Override
  public Optional<SearchLineageResult> get(LineageCacheKey key) {
    if (key == null) {
      return Optional.empty();
    }

    CachedGraph cached = cache.getIfPresent(key);

    if (cached != null) {
      LOG.debug("Cache HIT: key={}, size={} nodes", key, cached.nodeCount());
      return Optional.of(
          JsonUtils.readValue(
              new String(cached.json(), StandardCharsets.UTF_8), SearchLineageResult.class));
    } else {
      LOG.debug("Cache MISS: key={}", key);
      return Optional.empty();
    }
  }

  @Override
  public void put(LineageCacheKey key, SearchLineageResult result) {
    if (key == null || result == null) {
      LOG.warn("Attempted to cache null key or result, ignoring");
      return;
    }

    int nodeCount = result.getNodes() != null ? result.getNodes().size() : 0;

    // Verify caller is following cache eligibility rules
    if (nodeCount > config.getMediumGraphThreshold()) {
      LOG.warn(
          "Attempted to cache large graph ({} nodes > {} threshold). "
              + "Only small/medium graphs should be cached. Ignoring.",
          nodeCount,
          config.getMediumGraphThreshold());
      return;
    }

    cache.put(
        key,
        new CachedGraph(
            JsonUtils.pojoToJson(result).getBytes(StandardCharsets.UTF_8),
            nodeCount,
            referencedFqns(result)));
    LOG.debug("Cache PUT: key={}, size={} nodes", key, nodeCount);
  }

  @Override
  public void invalidate(LineageCacheKey key) {
    if (key != null) {
      cache.invalidate(key);
      LOG.debug("Cache INVALIDATE: key={}", key);
    }
  }

  @Override
  public void invalidateAll() {
    cache.invalidateAll();
    LOG.info("Cache INVALIDATE_ALL: Cleared all {} entries", cache.size());
  }

  @Override
  public void invalidateIfGraphContains(String fqn) {
    if (fqn == null || fqn.isEmpty() || cache.size() == 0) {
      return;
    }
    java.util.List<LineageCacheKey> toEvict = new java.util.ArrayList<>();
    for (java.util.Map.Entry<LineageCacheKey, CachedGraph> entry : cache.asMap().entrySet()) {
      if (fqn.equals(entry.getKey().getFqn()) || entry.getValue().fqns().contains(fqn)) {
        toEvict.add(entry.getKey());
      }
    }
    if (!toEvict.isEmpty()) {
      cache.invalidateAll(toEvict);
      LOG.debug("Cache INVALIDATE_FQN fqn={} evicted {} entries", fqn, toEvict.size());
    }
  }

  private static Set<String> referencedFqns(SearchLineageResult result) {
    Set<String> fqns = new HashSet<>();
    if (result.getNodes() != null) {
      fqns.addAll(result.getNodes().keySet());
    }
    addEdgeEndpoints(result.getUpstreamEdges(), fqns);
    addEdgeEndpoints(result.getDownstreamEdges(), fqns);
    return Set.copyOf(fqns);
  }

  private static void addEdgeEndpoints(
      java.util.Map<String, org.openmetadata.schema.api.lineage.EsLineageData> edges,
      Set<String> fqns) {
    if (edges == null) {
      return;
    }
    for (org.openmetadata.schema.api.lineage.EsLineageData edge : edges.values()) {
      if (edge.getFromEntity() != null && edge.getFromEntity().getFullyQualifiedName() != null) {
        fqns.add(edge.getFromEntity().getFullyQualifiedName());
      }
      if (edge.getToEntity() != null && edge.getToEntity().getFullyQualifiedName() != null) {
        fqns.add(edge.getToEntity().getFullyQualifiedName());
      }
    }
  }

  @Override
  public CacheStats getStats() {
    return cache.stats();
  }

  @Override
  public long size() {
    return cache.size();
  }

  @Override
  public void cleanUp() {
    cache.cleanUp();
  }

  /**
   * Gets cache hit ratio for monitoring.
   *
   * @return Hit ratio (0.0 to 1.0), or 0.0 if no requests yet
   */
  public double getHitRatio() {
    CacheStats stats = cache.stats();
    long totalRequests = stats.requestCount();
    if (totalRequests == 0) {
      return 0.0;
    }
    return (double) stats.hitCount() / totalRequests;
  }

  /**
   * Logs cache statistics for monitoring and debugging.
   */
  public void logStats() {
    CacheStats stats = cache.stats();
    LOG.info(
        "Cache Statistics: size={}, hits={}, misses={}, hitRatio={}, evictions={}, loadTime={}ms",
        cache.size(),
        stats.hitCount(),
        stats.missCount(),
        String.format("%.2f", getHitRatio()),
        stats.evictionCount(),
        stats.totalLoadTime() / 1_000_000); // Convert nanos to millis
  }
}
