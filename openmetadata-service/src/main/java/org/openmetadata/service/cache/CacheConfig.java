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
