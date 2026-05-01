package org.openmetadata.service.cache;

import java.nio.charset.StandardCharsets;
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
 * one field per distinct {@link ListFilter} variant. The field name is the first 16 hex chars
 * of a SHA-1 over the canonicalized filter (sorted query params + Include enum value, see
 * {@link #hashFilter}). 16 hex chars = 64 bits — birthday collision around 2^32 distinct filter
 * variants per entity type, which is well above any realistic load. Reads are HGET, writes are
 * HSET, and {@link #invalidate(String)} is a single DEL on the hash key — every filter variant
 * is dropped atomically.
 *
 * <p>Best-effort consistency: invalidation runs from
 * {@link org.openmetadata.service.jdbi3.EntityRepository EntityRepository} lifecycle hooks
 * (postCreate / postDelete / restoreEntity) which fire <i>inside</i> the JDBI {@code @Transaction}
 * boundary, not after commit. A concurrent reader can therefore observe the pre-write state, miss
 * the cache (because the writer just did a DEL), recompute against the still-uncommitted DB, and
 * cache the pre-write count for up to {@link CacheConfig#listCountTtlSeconds}. The actual listing
 * data is unaffected — {@code dao.listAfter} always reads live state — only the {@code paging.total}
 * field can be briefly stale. The TTL bounds the staleness; tighten it if your workload shows the
 * race in practice. Falls back transparently to the supplier when Redis is disabled or unavailable.
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
        try {
          return Integer.parseInt(cached.get());
        } catch (NumberFormatException e) {
          // Corrupt value (truncation, manual edit, version skew). Drop the bad field so
          // the next caller writes a clean value instead of failing to parse it forever.
          LOG.debug(
              "listCount cache had non-integer value for {} field {}; evicting",
              entityType,
              filterHash);
          try {
            provider.hdel(hashKey, filterHash);
          } catch (Exception evictFail) {
            LOG.debug(
                "listCount cache hdel after parse failure failed for {}: {}",
                entityType,
                evictFail.getMessage());
          }
        }
      }
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
   * count, and over-invalidation would defeat the cache on heavy editing workloads. Note the
   * commit-ordering trade-off documented at the class level.
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

  /**
   * Build a deterministic 16-hex-char field key for a filter. Two filters that hit the same SQL
   * count must produce the same key; two that hit different counts must not.
   *
   * <p>Canonicalization is intentionally NOT {@link ListFilter#getCondition()} — that string is
   * built by iterating an unordered {@code HashMap} and is not guaranteed stable across JVM
   * iterations. Instead we use {@link ListFilter#getInclude()} (the Include enum drives the
   * deleted predicate) and the {@code queryParams} map sorted by key. Same-shaped filter
   * regardless of {@code addQueryParam} call order produces the same key.
   *
   * <p>Bytes are hashed under {@link StandardCharsets#UTF_8} so cross-environment / cross-JVM
   * deployments produce identical keys regardless of platform default charset.
   *
   * <p>Returned value is the first 16 hex chars of the SHA-1 digest (64 bits). Truncation keeps
   * the Redis hash field short; collision probability is negligible for any realistic number of
   * filter variants per entity type.
   */
  // Package-private for test access.
  static String hashFilter(ListFilter filter) {
    StringBuilder canonical = new StringBuilder();
    canonical.append("include=").append(filter.getInclude());
    Map<String, String> params = filter.getQueryParams();
    if (params != null && !params.isEmpty()) {
      params.entrySet().stream()
          .sorted(Map.Entry.comparingByKey())
          .forEach(e -> canonical.append('|').append(e.getKey()).append('=').append(e.getValue()));
    }
    byte[] input = canonical.toString().getBytes(StandardCharsets.UTF_8);
    try {
      byte[] digest = MessageDigest.getInstance("SHA-1").digest(input);
      return HexFormat.of().formatHex(digest).substring(0, 16);
    } catch (NoSuchAlgorithmException e) {
      return Integer.toHexString(canonical.toString().hashCode());
    }
  }
}
