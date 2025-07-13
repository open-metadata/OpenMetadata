package org.openmetadata.service.cache;

import com.codahale.metrics.health.HealthCheck;
import io.dropwizard.core.ConfiguredBundle;
import io.dropwizard.core.setup.Bootstrap;
import io.dropwizard.core.setup.Environment;
import io.dropwizard.lifecycle.Managed;
import io.lettuce.core.RedisClient;
import io.lettuce.core.RedisURI;
import io.lettuce.core.api.StatefulRedisConnection;
import io.lettuce.core.cluster.RedisClusterClient;
import io.lettuce.core.cluster.api.StatefulRedisClusterConnection;
import java.util.concurrent.CompletableFuture;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.config.CacheConfiguration;

@Slf4j
public class RedisCacheBundle implements ConfiguredBundle<OpenMetadataApplicationConfig> {

  @Override
  public void initialize(Bootstrap<?> bootstrap) {
    // No initialization required
  }

  @Override
  public void run(OpenMetadataApplicationConfig configuration, Environment environment) {
    CacheConfiguration cacheConfig = configuration.getCacheConfiguration();

    if (cacheConfig == null || !cacheConfig.isEnabled()) {
      LOG.info("Cache is disabled. Skipping Redis bundle initialization.");
      return;
    }

    try {
      LOG.info("Initializing Redis cache with provider: {}", cacheConfig.getProvider());

      switch (cacheConfig.getProvider()) {
        case REDIS_STANDALONE:
        case ELASTICACHE_STANDALONE:
          initializeStandaloneRedis(cacheConfig, environment);
          break;
        case REDIS_CLUSTER:
        case ELASTICACHE_CLUSTER:
          initializeClusterRedis(cacheConfig, environment);
          break;
        case AZURE_REDIS:
          initializeAzureRedis(cacheConfig, environment);
          break;
        default:
          throw new IllegalArgumentException(
              "Unsupported cache provider: " + cacheConfig.getProvider());
      }

    } catch (Exception e) {
      LOG.error("Failed to initialize Redis cache", e);
      throw new RuntimeException("Failed to initialize Redis cache", e);
    }
  }

  private void initializeStandaloneRedis(CacheConfiguration config, Environment environment) {
    RedisURI.Builder uriBuilder =
        RedisURI.builder()
            .withHost(config.getHost())
            .withPort(config.getPort())
            .withDatabase(config.getDatabase())
            .withTimeout(java.time.Duration.ofSeconds(config.getConnectionTimeoutSecs()));

    if (config.isUseSsl()) {
      uriBuilder.withSsl(true);
    }

    if (config.getAuthType() == CacheConfiguration.AuthType.PASSWORD
        && config.getPassword() != null) {
      uriBuilder.withPassword(config.getPassword().toCharArray());
    } else if (config.getAuthType() == CacheConfiguration.AuthType.IAM
        && config.getAwsConfig() != null) {
      LOG.warn(
          "IAM authentication for ElastiCache requires token refresh mechanism - using password fallback");
      if (config.getPassword() != null) {
        uriBuilder.withPassword(config.getPassword().toCharArray());
      }
    }

    RedisClient client = RedisClient.create(uriBuilder.build());
    StatefulRedisConnection<String, String> connection = client.connect();

    environment.lifecycle().manage(new RedisConnectionManaged(client, connection));
    environment.healthChecks().register("redis-cache", new RedisHealthCheck(connection));

    RelationshipCache.initialize(connection, config.getTtlSeconds(), config.getMaxRetries());
    LOG.info("Redis standalone cache initialized successfully");

    // Start cache warmup asynchronously
    startCacheWarmup(config, environment);
  }

  private void initializeClusterRedis(CacheConfiguration config, Environment environment) {
    RedisURI.Builder uriBuilder =
        RedisURI.builder()
            .withHost(config.getHost())
            .withPort(config.getPort())
            .withTimeout(java.time.Duration.ofSeconds(config.getConnectionTimeoutSecs()));

    if (config.isUseSsl()) {
      uriBuilder.withSsl(true);
    }

    if (config.getAuthType() == CacheConfiguration.AuthType.PASSWORD
        && config.getPassword() != null) {
      uriBuilder.withPassword(config.getPassword().toCharArray());
    }

    RedisClusterClient client = RedisClusterClient.create(uriBuilder.build());
    StatefulRedisClusterConnection<String, String> connection = client.connect();

    environment.lifecycle().manage(new RedisClusterConnectionManaged(client, connection));
    environment
        .healthChecks()
        .register("redis-cluster-cache", new RedisClusterHealthCheck(connection));

    RelationshipCache.initializeCluster(connection, config.getTtlSeconds(), config.getMaxRetries());
    LOG.info("Redis cluster cache initialized successfully");

    // Start cache warmup asynchronously
    startCacheWarmup(config, environment);
  }

  private void initializeAzureRedis(CacheConfiguration config, Environment environment) {
    RedisURI.Builder uriBuilder =
        RedisURI.builder()
            .withHost(config.getHost())
            .withPort(config.getPort())
            .withDatabase(config.getDatabase())
            .withSsl(true)
            .withTimeout(java.time.Duration.ofSeconds(config.getConnectionTimeoutSecs()));

    if (config.getAuthType() == CacheConfiguration.AuthType.PASSWORD
        && config.getPassword() != null) {
      uriBuilder.withPassword(config.getPassword().toCharArray());
    } else if (config.getAuthType() == CacheConfiguration.AuthType.AZURE_MANAGED_IDENTITY) {
      LOG.warn(
          "Azure Managed Identity authentication requires token refresh mechanism - using password fallback");
      if (config.getPassword() != null) {
        uriBuilder.withPassword(config.getPassword().toCharArray());
      }
    }

    RedisClient client = RedisClient.create(uriBuilder.build());
    StatefulRedisConnection<String, String> connection = client.connect();

    environment.lifecycle().manage(new RedisConnectionManaged(client, connection));
    environment.healthChecks().register("azure-redis-cache", new RedisHealthCheck(connection));

    RelationshipCache.initialize(connection, config.getTtlSeconds(), config.getMaxRetries());
    LOG.info("Azure Redis cache initialized successfully");

    // Start cache warmup asynchronously
    startCacheWarmup(config, environment);
  }

  /**
   * Start cache warmup service asynchronously
   */
  private void startCacheWarmup(CacheConfiguration config, Environment environment) {
    if (!config.isWarmupEnabled()) {
      LOG.info("Cache warmup is disabled");
      return;
    }

    try {
      CacheWarmupService warmupService = new CacheWarmupService(config, Entity.getCollectionDAO());

      // Register warmup service for lifecycle management
      environment
          .lifecycle()
          .manage(
              new Managed() {
                @Override
                public void start() {
                  // Start warmup asynchronously after a short delay to allow application to fully
                  // start
                  CompletableFuture.delayedExecutor(5, java.util.concurrent.TimeUnit.SECONDS)
                      .execute(warmupService::startWarmup);
                }

                @Override
                public void stop() {
                  warmupService.shutdown();
                }
              });

      // Register health check for warmup service
      environment
          .healthChecks()
          .register(
              "cache-warmup",
              new HealthCheck() {
                @Override
                protected Result check() {
                  try {
                    CacheWarmupService.WarmupStats stats = warmupService.getWarmupStats();
                    if (stats.inProgress) {
                      return Result.healthy("Cache warmup in progress: " + stats.toString());
                    } else {
                      return Result.healthy("Cache warmup completed: " + stats.toString());
                    }
                  } catch (Exception e) {
                    return Result.unhealthy("Cache warmup check failed: " + e.getMessage());
                  }
                }
              });

      LOG.info("Cache warmup service initialized");

    } catch (Exception e) {
      LOG.error("Failed to initialize cache warmup service: {}", e.getMessage(), e);
      // Don't fail the entire cache initialization due to warmup issues
    }
  }

  /**
   * Managed wrapper for standalone Redis connection
   */
  private static class RedisConnectionManaged implements Managed {
    private final RedisClient client;
    private final StatefulRedisConnection<String, String> connection;

    public RedisConnectionManaged(
        RedisClient client, StatefulRedisConnection<String, String> connection) {
      this.client = client;
      this.connection = connection;
    }

    @Override
    public void start() {
      // Connection is already established
      LOG.debug("Redis connection started");
    }

    @Override
    public void stop() {
      try {
        if (connection != null) {
          connection.close();
        }
        if (client != null) {
          client.shutdown();
        }
        LOG.info("Redis connection closed successfully");
      } catch (Exception e) {
        LOG.error("Error closing Redis connection", e);
      }
    }
  }

  private static class RedisClusterConnectionManaged implements Managed {
    private final RedisClusterClient client;
    private final StatefulRedisClusterConnection<String, String> connection;

    public RedisClusterConnectionManaged(
        RedisClusterClient client, StatefulRedisClusterConnection<String, String> connection) {
      this.client = client;
      this.connection = connection;
    }

    @Override
    public void start() {
      LOG.debug("Redis cluster connection started");
    }

    @Override
    public void stop() {
      try {
        if (connection != null) {
          connection.close();
        }
        if (client != null) {
          client.shutdown();
        }
        LOG.info("Redis cluster connection closed successfully");
      } catch (Exception e) {
        LOG.error("Error closing Redis cluster connection", e);
      }
    }
  }

  /**
   * Health check for standalone Redis connection
   */
  private static class RedisHealthCheck extends HealthCheck {
    private final StatefulRedisConnection<String, String> connection;

    public RedisHealthCheck(StatefulRedisConnection<String, String> connection) {
      this.connection = connection;
    }

    @Override
    protected Result check() {
      try {
        String pong = connection.sync().ping();
        if ("PONG".equals(pong)) {
          return Result.healthy("Redis is responding");
        } else {
          return Result.unhealthy("Redis ping returned: " + pong);
        }
      } catch (Exception e) {
        return Result.unhealthy("Redis ping failed: " + e.getMessage());
      }
    }
  }

  /**
   * Health check for cluster Redis connection
   */
  private static class RedisClusterHealthCheck extends HealthCheck {
    private final StatefulRedisClusterConnection<String, String> connection;

    public RedisClusterHealthCheck(StatefulRedisClusterConnection<String, String> connection) {
      this.connection = connection;
    }

    @Override
    protected Result check() {
      try {
        String pong = connection.sync().ping();
        if ("PONG".equals(pong)) {
          return Result.healthy("Redis cluster is responding");
        } else {
          return Result.unhealthy("Redis cluster ping returned: " + pong);
        }
      } catch (Exception e) {
        return Result.unhealthy("Redis cluster ping failed: " + e.getMessage());
      }
    }
  }
}
