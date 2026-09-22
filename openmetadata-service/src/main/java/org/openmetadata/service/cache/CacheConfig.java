package org.openmetadata.service.cache;

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

  public Provider provider = Provider.none;

  // TTL settings in seconds
  public int entityTtlSeconds = 3600; // 1 hour
  public int relationshipTtlSeconds = 3600; // 1 hour
  public int tagTtlSeconds = 3600; // 1 hour

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
