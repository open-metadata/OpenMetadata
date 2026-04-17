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

  // Single-flight lock TTLs (milliseconds).
  // loadLockTtlMs: short ceiling - if the holder crashes, a waiter takes over after this.
  // loadLockWaitMs: total time a waiter polls for the concurrent load before giving up
  //                 and doing its own DB load.
  public int loadLockTtlMs = 3000;
  public int loadLockWaitMs = 200;

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
