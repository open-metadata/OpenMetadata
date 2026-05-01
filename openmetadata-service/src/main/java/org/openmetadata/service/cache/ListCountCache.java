package org.openmetadata.service.cache;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.util.HexFormat;
import java.util.Map;
import java.util.Optional;
import java.util.function.IntSupplier;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.jdbi3.ListFilter;

/**
 * Read-through cache for paginated entity listing counts (e.g. {@code paging.total} for
 * {@code GET /api/v1/<entity>}). Entity-list endpoints recompute {@code count(*) WHERE ...}
 * on every call before returning even a single-row page; on tables in the hundreds of
 * thousands of rows that one count dominates listing latency, especially when the planner
 * falls back to a parallel seq scan (no index-only scan, stale stats).
 *
 * <p>Storage: a single Redis hash per entity type keyed at {@code <ns>:lc:<entityType>}, with
 * one field per distinct {@link ListFilter} variant (SHA-1 of the filter's WHERE clause + bound
 * params). Reads are HGET, writes are HSET, and {@link #invalidate(String)} is a single DEL on
 * the hash key — every filter variant is dropped atomically. That makes lifecycle invalidation
 * (create / delete / restore) precise rather than letting filtered totals age out via TTL while
 * the unfiltered total looked fresh.
 *
 * <p>Best-effort: a stale total can be returned for up to {@link CacheConfig#listCountTtlSeconds}
 * after a write only if the lifecycle hook didn't fire (e.g. a direct DB modification outside the
 * repository). Correctness of the listing itself is unaffected — only the {@code paging.total}
 * field. Falls back transparently to the supplier when Redis is disabled or unavailable.
 */
@Slf4j
public final class ListCountCache {

  private ListCountCache() {}

  /**
   * Returns the cached count for {@code (entityType, filter)}, or computes via {@code supplier}
   * and populates the cache on a miss. Any cache I/O failure logs at debug and degrades to a
   * direct compute — listing must not fail because Redis is down.
   */
  public static int getOrCompute(String entityType, ListFilter filter, IntSupplier supplier) {
    CacheProvider provider = CacheBundle.getCacheProvider();
    CacheConfig config = CacheBundle.getCacheConfig();
    if (provider == null || !provider.available() || config == null || config.redis == null) {
      return supplier.getAsInt();
    }

    String hashKey = buildHashKey(entityType, config);
    String filterHash = hashFilter(filter);

    try {
      Optional<String> cached = provider.hget(hashKey, filterHash);
      if (cached.isPresent()) {
        return Integer.parseInt(cached.get());
      }
    } catch (NumberFormatException e) {
      LOG.debug("listCount cache had non-integer value for {}: {}", entityType, e.getMessage());
    } catch (Exception e) {
      LOG.debug("listCount cache read failed for {}: {}", entityType, e.getMessage());
    }

    int count = supplier.getAsInt();

    try {
      provider.hset(
          hashKey,
          Map.of(filterHash, String.valueOf(count)),
          Duration.ofSeconds(config.listCountTtlSeconds));
    } catch (Exception e) {
      LOG.debug("listCount cache write failed for {}: {}", entityType, e.getMessage());
    }
    return count;
  }

  /**
   * Drop every cached filter variant for an entity type in one DEL. Wired into
   * {@code postCreate}, {@code postDelete}, and {@code restoreEntity} on {@link
   * org.openmetadata.service.jdbi3.EntityRepository EntityRepository} so {@code paging.total}
   * reflects state changes within a round-trip rather than waiting out the TTL window. Routine
   * updates (description, tags, owners) deliberately do not invalidate — they don't change the
   * count, and over-invalidation would defeat the cache on heavy editing workloads.
   */
  public static void invalidate(String entityType) {
    CacheProvider provider = CacheBundle.getCacheProvider();
    CacheConfig config = CacheBundle.getCacheConfig();
    if (provider == null || !provider.available() || config == null || config.redis == null) {
      return;
    }
    String hashKey = buildHashKey(entityType, config);
    try {
      provider.del(hashKey);
    } catch (Exception e) {
      LOG.debug("listCount cache invalidate failed for {}: {}", entityType, e.getMessage());
    }
  }

  private static String buildHashKey(String entityType, CacheConfig config) {
    return new CacheKeys(config.redis.keyspace).listCount(entityType);
  }

  private static String hashFilter(ListFilter filter) {
    StringBuilder canonical = new StringBuilder(filter.getCondition());
    Map<String, String> params = filter.getQueryParams();
    if (params != null && !params.isEmpty()) {
      params.entrySet().stream()
          .sorted(Map.Entry.comparingByKey())
          .forEach(e -> canonical.append('|').append(e.getKey()).append('=').append(e.getValue()));
    }
    try {
      byte[] digest = MessageDigest.getInstance("SHA-1").digest(canonical.toString().getBytes());
      return HexFormat.of().formatHex(digest).substring(0, 16);
    } catch (NoSuchAlgorithmException e) {
      return Integer.toHexString(canonical.toString().hashCode());
    }
  }
}
