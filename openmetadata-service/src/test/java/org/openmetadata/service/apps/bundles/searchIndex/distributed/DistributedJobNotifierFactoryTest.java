package org.openmetadata.service.apps.bundles.searchIndex.distributed;

import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.Mockito.mock;

import java.lang.reflect.Constructor;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.cache.CacheConfig;
import org.openmetadata.service.jdbi3.CollectionDAO;

class DistributedJobNotifierFactoryTest {

  private final CollectionDAO collectionDAO = mock(CollectionDAO.class);

  @Test
  void createUsesRedisNotifierWhenRedisConfigIsComplete() {
    CacheConfig cacheConfig = new CacheConfig();
    cacheConfig.provider = CacheConfig.Provider.redis;
    cacheConfig.redis.url = "redis://cache:6379";

    DistributedJobNotifier notifier =
        DistributedJobNotifierFactory.create(cacheConfig, collectionDAO, "server-1");

    assertInstanceOf(RedisJobNotifier.class, notifier);
  }

  @Test
  void createFallsBackToPollingWhenRedisConfigIsMissingOrInvalid() {
    CacheConfig missingUrlConfig = new CacheConfig();
    missingUrlConfig.provider = CacheConfig.Provider.redis;

    DistributedJobNotifier missingUrlNotifier =
        DistributedJobNotifierFactory.create(missingUrlConfig, collectionDAO, "server-1");
    DistributedJobNotifier nullConfigNotifier =
        DistributedJobNotifierFactory.create(null, collectionDAO, "server-1");

    assertInstanceOf(PollingJobNotifier.class, missingUrlNotifier);
    assertInstanceOf(PollingJobNotifier.class, nullConfigNotifier);
  }

  @Test
  void utilityConstructorIsAccessibleForCoverage() throws Exception {
    Constructor<DistributedJobNotifierFactory> constructor =
        DistributedJobNotifierFactory.class.getDeclaredConstructor();
    constructor.setAccessible(true);

    assertNotNull(constructor.newInstance());
  }
}
