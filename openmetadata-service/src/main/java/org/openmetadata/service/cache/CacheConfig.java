package org.openmetadata.service.cache;

import com.fasterxml.jackson.annotation.JsonSetter;
import java.util.Arrays;
import java.util.Collection;
import java.util.Set;
import java.util.stream.Collectors;

public class CacheConfig {
  public enum Provider {
    none,
    redis
  }

  public enum AuthType {
    PASSWORD,
    IAM,
    NONE
  }

  public enum SessionStoreMode {
    auto,
    jdbc,
    redis
  }

  public Provider provider = Provider.none;

  // TTL settings in seconds
  public int entityTtlSeconds = 3600; // 1 hour
  public int relationshipTtlSeconds = 3600; // 1 hour
  public int tagTtlSeconds = 3600; // 1 hour

  // Compress cached entity and read-bundle JSON at/above this UTF-8 byte threshold using
  // GZIP+Base64. Defaults to 0 (disabled) on 2.1 patch releases for silent rolling upgrades and
  // rollbacks; set to e.g. 2048 via CACHE_COMPRESSION_THRESHOLD_BYTES once all pods are upgraded.
  public int compressionThresholdBytes = 0;

  // Maximum post-compression byte length for a single cached entity or read-bundle entry.
  // Entries exceeding this limit are not written to Redis. Set to 0 for unlimited.
  public int maxEntrySizeBytes = 0;

  // Whether pre-write lookup misses during createOrUpdate (e.g. ingestion sweeps) populate Redis.
  // Default false so bulk ingestion does not fill Redis with cold entities that nobody reads.
  public boolean populateOnUpsert = false;

  // Controls which SessionStore backend is used when Redis caching is configured:
  // auto (default): Redis when provider=redis, else JDBC;
  // jdbc: always store sessions in JDBC so Redis eviction policies cannot evict user sessions;
  // redis: require Redis for sessions.
  // Changing this setting switches to an empty store, so change all pods together and expect one
  // forced sign-in for active users.
  public SessionStoreMode sessionStore = SessionStoreMode.auto;

  // Additional entity types excluded from Redis caching (appended to UNCACHED_ENTITY_TYPES).
  // Applies to entity JSON, read bundles, tags, owners, domains, CONTAINS parent lookups, and
  // CacheWarmupApp. Accepts a YAML list or comma-separated string (CACHE_EXCLUDED_ENTITY_TYPES).
  private Set<String> excludedEntityTypes = Set.of();

  public Set<String> getExcludedEntityTypes() {
    return excludedEntityTypes;
  }

  @JsonSetter("excludedEntityTypes")
  public void setExcludedEntityTypes(final Object raw) {
    this.excludedEntityTypes = parseExcludedEntityTypes(raw);
  }

  public boolean isEntityTypeExcluded(final String entityType) {
    return entityType != null && excludedEntityTypes.contains(entityType);
  }

  private static Set<String> parseExcludedEntityTypes(final Object raw) {
    if (raw == null) {
      return Set.of();
    }
    if (raw instanceof String csv) {
      return Arrays.stream(csv.split(","))
          .map(String::trim)
          .filter(value -> !value.isEmpty())
          .collect(Collectors.toUnmodifiableSet());
    }
    if (raw instanceof Collection<?> items) {
      return items.stream()
          .filter(item -> item != null)
          .map(item -> item.toString().trim())
          .filter(value -> !value.isEmpty())
          .collect(Collectors.toUnmodifiableSet());
    }
    throw new IllegalArgumentException(
        "excludedEntityTypes must be a list or comma-separated string, got: "
            + raw.getClass().getSimpleName());
  }

  // /api/v1/search/query response cache. Very short TTL because search results must
  // reflect entity writes promptly: user creates X → searches for X → expects to find X.
  // The integration suite caught this with a 30s TTL: tests that create an entity and
  // wait for it in search timed out because the cache served the pre-create empty
  // result for the full 30s. 2s caps that staleness while still catching the typical
  // UI pattern where multiple components in the same render frame fire identical search
  // queries (those happen within milliseconds, well inside any reasonable TTL). Set to
  // 0 to disable.
  public int searchTtlSeconds = 2;

  // /api/v1/lineage/* response cache. Hybrid TTL + direct-invalidation strategy: a 60s TTL
  // backstops cases where a transitive change (an entity deep in the cached graph) wasn't
  // explicitly invalidated. Direct edits (entity rename/delete, lineage edge add/remove)
  // still invalidate the affected root cache entries immediately. Set to 0 to disable —
  // the read path falls through to LineageRepository.computeLineage as if no cache existed.
  public int lineageTtlSeconds = 60;

  // Threshold (ms) above which a cache read is logged as slow. A healthy local Redis returns
  // in <2ms; production Redis under load runs ~5ms; sustained reads >50ms typically mean
  // network glitch, Redis pressure, or a hot key. Set to 0 to disable slow-read logging.
  public int slowReadThresholdMs = 50;

  // Negative cache TTL (seconds). When an entity isn't found, we cache that fact for this
  // long so repeated lookups of stale FQNs / typo'd IDs don't hammer the DB. Short window
  // because entities CAN be created at any time — we don't want to cache absence for too
  // long. Invalidated on entity create. Set to 0 to disable.
  public int notFoundTtlSeconds = 30;

  // Listing total-row counts. Short TTL because counts are best-effort: a freshly created
  // entity may not show up in paging.total for up to listCountTtlSeconds, but the list
  // itself is always live. Keeps repeated /containers, /tables, /dashboards listings
  // from each paying for a fresh count(*) on heavy tables.
  public int listCountTtlSeconds = 60;

  // Single-flight bundle load uses an in-process Striped<Lock> keyed by (type, id). The
  // stripe count caps concurrent independent loads — more stripes = less collision between
  // unrelated entities. 512 suits a typical OM instance; bump if you see lock contention
  // across unrelated entity IDs on a large workload.
  public int bundleLoadLockStripes = 512;

  public Redis redis = new Redis();

  public static class Redis {
    // Basic connection
    public String url;
    public AuthType authType;

    public String username;
    public String passwordRef;
    public boolean useSSL;

    public int database;

    // Key namespace
    public String keyspace = "om:prod";

    // Connection pool
    public int poolSize = 64;
    public int connectTimeoutMs = 2000;
    public int commandTimeoutMs = 300;

    // Background PING cadence. Flips the provider back to available once Redis recovers after a
    // command failure tripped it to unavailable. Kept short so multi-instance readers stop serving
    // per-instance cached data within a few seconds of the outage.
    public int healthCheckIntervalMs = 5000;

    // AWS ElastiCache IAM authentication
    public AwsConfig aws = new AwsConfig();
  }

  public static class AwsConfig {
    public boolean enabled = false;
    public String region;
    public boolean useInstanceProfile = true;
    public String accessKeyId;
    public String secretAccessKey;
    public int tokenRefreshIntervalSeconds = 900; // 15 minutes
  }
}
