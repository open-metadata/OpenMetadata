package org.openmetadata.service.cache;

import com.codahale.metrics.health.HealthCheck;
import io.dropwizard.core.ConfiguredBundle;
import io.dropwizard.core.setup.Bootstrap;
import io.dropwizard.core.setup.Environment;
import io.dropwizard.lifecycle.Managed;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;

@Slf4j
public class CacheBundle implements ConfiguredBundle<OpenMetadataApplicationConfig> {

  private static CacheBundle instance;
  private static CacheProvider cacheProvider;
  private static CachedEntityDao cachedEntityDao;
  private static CachedRelationshipDao cachedRelationshipDao;
  private static CachedTagUsageDao cachedTagUsageDao;

  public CacheBundle() {
    instance = this;
  }

  public static CacheBundle getInstance() {
    return instance;
  }

  @Override
  public void initialize(Bootstrap<?> bootstrap) {}

  @Override
  public void run(OpenMetadataApplicationConfig configuration, Environment environment) {
    CacheConfig cacheConfig = configuration.getCacheConfig();

    LOG.info("CacheBundle.run() called with cacheConfig: {}", cacheConfig);

    if (cacheConfig == null || cacheConfig.provider == CacheConfig.Provider.none) {
      LOG.info("Cache is disabled. Using NoopCacheProvider.");
      cacheProvider = new NoopCacheProvider();
      return;
    }

    try {
      LOG.info("Initializing cache with provider: {}", cacheConfig.provider);

      switch (cacheConfig.provider) {
        case redis:
          cacheProvider = new RedisCacheProvider(cacheConfig);
          break;
        default:
          LOG.warn("Unknown cache provider: {}. Using NoopCacheProvider.", cacheConfig.provider);
          cacheProvider = new NoopCacheProvider();
          return;
      }

      CacheKeys keys = new CacheKeys(cacheConfig.redis.keyspace);
      cachedEntityDao =
          new CachedEntityDao(Entity.getCollectionDAO(), cacheProvider, keys, cacheConfig);
      cachedRelationshipDao =
          new CachedRelationshipDao(Entity.getCollectionDAO(), cacheProvider, keys, cacheConfig);
      cachedTagUsageDao =
          new CachedTagUsageDao(Entity.getCollectionDAO(), cacheProvider, keys, cacheConfig);

      environment.lifecycle().manage(new CacheLifecycleManager());
      environment.healthChecks().register("cache", new CacheHealthCheck());

      LOG.info("Cache bundle initialized successfully");

    } catch (Exception e) {
      LOG.error("Failed to initialize cache bundle", e);
      cacheProvider = new NoopCacheProvider();
    }
  }

  public static CacheProvider getCacheProvider() {
    return cacheProvider != null ? cacheProvider : new NoopCacheProvider();
  }

  public static CachedEntityDao getCachedEntityDao() {
    return cachedEntityDao;
  }

  public static CachedRelationshipDao getCachedRelationshipDao() {
    return cachedRelationshipDao;
  }

  public static CachedTagUsageDao getCachedTagUsageDao() {
    return cachedTagUsageDao;
  }

  private static class CacheLifecycleManager implements Managed {
    @Override
    public void start() {
      LOG.debug("Cache lifecycle started");
    }

    @Override
    public void stop() {
      try {
        if (cacheProvider != null) {
          cacheProvider.close();
        }
        LOG.info("Cache provider closed successfully");
      } catch (Exception e) {
        LOG.error("Error closing cache provider", e);
      }
    }
  }

  private static class CacheHealthCheck extends HealthCheck {
    @Override
    protected Result check() {
      try {
        if (cacheProvider == null) {
          return Result.unhealthy("Cache provider not initialized");
        }

        if (!cacheProvider.available()) {
          return Result.unhealthy("Cache provider not available");
        }

        String testKey = "health:check:" + System.currentTimeMillis();
        cacheProvider.set(testKey, "test", java.time.Duration.ofSeconds(5));
        var result = cacheProvider.get(testKey);
        cacheProvider.del(testKey);

        if (result.isPresent() && "test".equals(result.get())) {
          return Result.healthy("Cache is responding");
        } else {
          return Result.unhealthy("Cache read/write test failed");
        }
      } catch (Exception e) {
        return Result.unhealthy("Cache health check failed: " + e.getMessage());
      }
    }
  }
}
