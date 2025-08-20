package org.openmetadata.service.config;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.Getter;
import lombok.Setter;
import org.apache.commons.lang3.StringUtils;

@Getter
@Setter
public class CacheConfiguration {

  public enum CacheProvider {
    REDIS_STANDALONE,
    REDIS_CLUSTER,
    ELASTICACHE_STANDALONE,
    ELASTICACHE_CLUSTER,
    AZURE_REDIS
  }

  public enum AuthType {
    NONE,
    PASSWORD,
    IAM,
    AZURE_MANAGED_IDENTITY
  }

  @JsonProperty("enabled")
  private boolean enabled = false;

  @JsonProperty("provider")
  private CacheProvider provider = CacheProvider.REDIS_STANDALONE;

  @JsonProperty("host")
  private String host;

  @JsonProperty("port")
  @Min(value = 1, message = "Port must be greater than 0")
  @Max(value = 65535, message = "Port must be less than 65536")
  private int port = 6379;

  @JsonProperty("authType")
  private AuthType authType = AuthType.NONE;

  @JsonProperty("password")
  private String password;

  @JsonProperty("useSsl")
  private boolean useSsl = false;

  @JsonProperty("database")
  @Min(value = 0, message = "Database must be between 0 and 15")
  @Max(value = 15, message = "Database must be between 0 and 15")
  private int database = 0;

  @JsonProperty("ttlSeconds")
  @Min(value = 0, message = "TTL must be non-negative")
  private int ttlSeconds = 3600;

  @JsonProperty("connectionTimeoutSecs")
  @Min(value = 1, message = "Connection timeout must be positive")
  private int connectionTimeoutSecs = 5;

  @JsonProperty("socketTimeoutSecs")
  @Min(value = 1, message = "Socket timeout must be positive")
  private int socketTimeoutSecs = 60;

  @JsonProperty("maxRetries")
  @Min(value = 0, message = "Max retries must be non-negative")
  private int maxRetries = 3;

  @JsonProperty("warmupEnabled")
  private boolean warmupEnabled = true;

  @JsonProperty("warmupBatchSize")
  @Min(value = 1, message = "Warmup batch size must be positive")
  private int warmupBatchSize = 100;

  @JsonProperty("warmupThreads")
  @Min(value = 1, message = "Warmup threads must be positive")
  private int warmupThreads = 2;

  @JsonProperty("warmupRateLimit")
  @Min(value = 1, message = "Warmup rate limit must be positive")
  private double warmupRateLimit = 100.0; // operations per second

  @JsonProperty("awsConfig")
  private AwsConfig awsConfig;

  @JsonProperty("azureConfig")
  private AzureConfig azureConfig;

  @Getter
  @Setter
  public static class AwsConfig {
    @JsonProperty("region")
    private String region;

    @JsonProperty("accessKey")
    private String accessKey;

    @JsonProperty("secretKey")
    private String secretKey;

    @JsonProperty("useIamRole")
    private boolean useIamRole = false;

    @AssertTrue(
        message = "Either useIamRole must be true or both accessKey and secretKey must be provided")
    public boolean isValidCredentials() {
      if (useIamRole) {
        return true;
      } else {
        return StringUtils.isNotBlank(accessKey) && StringUtils.isNotBlank(secretKey);
      }
    }
  }

  @Getter
  @Setter
  public static class AzureConfig {
    @JsonProperty("resourceGroup")
    private String resourceGroup;

    @JsonProperty("subscriptionId")
    private String subscriptionId;

    @JsonProperty("useManagedIdentity")
    private boolean useManagedIdentity = false;
  }

  @AssertTrue(message = "Host must be provided when cache is enabled")
  public boolean isValidHost() {
    return !enabled || StringUtils.isNotBlank(host);
  }

  @AssertTrue(message = "Password must be provided when authType is PASSWORD")
  public boolean isValidPasswordAuth() {
    return !enabled || authType != AuthType.PASSWORD || StringUtils.isNotBlank(password);
  }

  @AssertTrue(message = "AWS config must be provided for ElastiCache providers")
  public boolean isValidAwsConfig() {
    boolean isElastiCacheProvider =
        provider == CacheProvider.ELASTICACHE_STANDALONE
            || provider == CacheProvider.ELASTICACHE_CLUSTER;
    return !enabled || !isElastiCacheProvider || awsConfig != null;
  }

  @AssertTrue(message = "Azure config must be provided for Azure Redis provider")
  public boolean isValidAzureConfig() {
    return !enabled || provider != CacheProvider.AZURE_REDIS || azureConfig != null;
  }

  @AssertTrue(message = "Database selection not supported in cluster mode")
  public boolean isValidDatabaseForCluster() {
    boolean isClusterMode =
        provider == CacheProvider.REDIS_CLUSTER || provider == CacheProvider.ELASTICACHE_CLUSTER;
    return !enabled || !isClusterMode || database == 0;
  }
}
