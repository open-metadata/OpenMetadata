package org.openmetadata.service.cache;

import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.testcontainers.containers.GenericContainer;

/**
 * Base class for cache-related tests that automatically starts Redis container.
 * No need to pass -DenableCache=true -DcacheType=redis when running tests.
 */
@Slf4j
public abstract class CacheTestBase extends OpenMetadataApplicationTest {

  protected static GenericContainer<?> REDIS_CONTAINER;
  protected static String REDIS_URL;

  @BeforeAll
  @Override
  public void createApplication() throws Exception {
    // Set system properties to enable Redis for cache tests
    System.setProperty("enableCache", "true");
    System.setProperty("cacheType", "redis");

    // Call parent setup which will start Redis via setupRedisIfEnabled()
    super.createApplication();

    // Get Redis container reference for cleanup
    try {
      java.lang.reflect.Field field =
          OpenMetadataApplicationTest.class.getDeclaredField("REDIS_CONTAINER");
      field.setAccessible(true);
      REDIS_CONTAINER = (GenericContainer<?>) field.get(null);

      if (REDIS_CONTAINER != null && REDIS_CONTAINER.isRunning()) {
        String redisHost = REDIS_CONTAINER.getHost();
        Integer redisPort = REDIS_CONTAINER.getFirstMappedPort();
        REDIS_URL = String.format("%s:%d", redisHost, redisPort);
        LOG.info("Using Redis container at: {}", REDIS_URL);
      }
    } catch (Exception e) {
      LOG.warn("Could not get Redis container reference: {}", e.getMessage());
    }
  }

  @AfterAll
  @Override
  public void stopApplication() throws Exception {
    // Parent will handle Redis container cleanup
    super.stopApplication();

    // Clear system properties
    System.clearProperty("enableCache");
    System.clearProperty("cacheType");
  }
}
