/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.cache;

import io.dropwizard.testing.ConfigOverride;
import java.time.Duration;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.TestInstance;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.utility.DockerImageName;

/**
 * Base test class that extends OpenMetadataApplicationTest with Redis cache support.
 * This class sets up a Redis container using Testcontainers and configures the
 * application to use the test Redis instance for caching.
 */
@Slf4j
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public abstract class CachedOpenMetadataApplicationResourceTest
    extends OpenMetadataApplicationTest {

  private static GenericContainer<?> REDIS_CONTAINER;

  // Redis configuration constants
  public static final String REDIS_IMAGE = "redis:7-alpine";
  public static final int REDIS_PORT = 6379;
  public static final String REDIS_PASSWORD = "test-password";
  public static final int REDIS_DATABASE = 0;
  public static final int REDIS_TTL_SECONDS = 3600;
  public static final int REDIS_CONNECTION_TIMEOUT_SECS = 5;
  public static final int REDIS_SOCKET_TIMEOUT_SECS = 60;
  public static final int REDIS_MAX_RETRIES = 3;

  @BeforeAll
  @Override
  public void createApplication() throws Exception {
    LOG.info("Starting Redis container for cache testing");
    startRedisContainer();
    addRedisConfigurationOverrides();
    super.createApplication();

    // After the application is created and cache is initialized,
    // replace the CollectionDAO with the cached version
    if (RelationshipCache.isAvailable()) {
      org.openmetadata.service.jdbi3.CollectionDAO currentDAO =
          org.openmetadata.service.Entity.getCollectionDAO();
      if (!(currentDAO instanceof CachedCollectionDAO)) {
        LOG.info("Replacing CollectionDAO with cached version for tests");
        org.openmetadata.service.Entity.setCollectionDAO(new CachedCollectionDAO(currentDAO));
      }
    }

    LOG.info("CachedOpenMetadataApplicationResourceTest setup completed");
  }

  @AfterAll
  @Override
  public void stopApplication() throws Exception {
    try {
      super.stopApplication();
    } finally {
      stopRedisContainer();
    }
  }

  /**
   * Start Redis container using Testcontainers
   */
  private void startRedisContainer() {
    REDIS_CONTAINER =
        new GenericContainer<>(DockerImageName.parse(REDIS_IMAGE))
            .withExposedPorts(REDIS_PORT)
            .withCommand("redis-server", "--requirepass", REDIS_PASSWORD)
            .withReuse(false)
            .withStartupTimeout(Duration.ofMinutes(2));

    REDIS_CONTAINER.start();

    LOG.info(
        "Redis container started at {}:{}",
        REDIS_CONTAINER.getHost(),
        REDIS_CONTAINER.getFirstMappedPort());
  }

  /**
   * Stop Redis container and cleanup
   */
  private void stopRedisContainer() {
    if (REDIS_CONTAINER != null) {
      try {
        REDIS_CONTAINER.stop();
        LOG.info("Redis container stopped successfully");
      } catch (Exception e) {
        LOG.error("Error stopping Redis container", e);
      }
    }
  }

  /**
   * Add Redis configuration overrides to enable caching
   */
  private void addRedisConfigurationOverrides() {
    configOverrides.add(ConfigOverride.config("cacheConfiguration.enabled", "true"));
    configOverrides.add(ConfigOverride.config("cacheConfiguration.provider", "REDIS_STANDALONE"));
    configOverrides.add(
        ConfigOverride.config("cacheConfiguration.host", REDIS_CONTAINER.getHost()));
    configOverrides.add(
        ConfigOverride.config(
            "cacheConfiguration.port", REDIS_CONTAINER.getFirstMappedPort().toString()));
    configOverrides.add(ConfigOverride.config("cacheConfiguration.authType", "PASSWORD"));
    configOverrides.add(ConfigOverride.config("cacheConfiguration.password", REDIS_PASSWORD));
    configOverrides.add(ConfigOverride.config("cacheConfiguration.useSsl", "false"));
    configOverrides.add(
        ConfigOverride.config("cacheConfiguration.database", String.valueOf(REDIS_DATABASE)));
    configOverrides.add(
        ConfigOverride.config("cacheConfiguration.ttlSeconds", String.valueOf(REDIS_TTL_SECONDS)));
    configOverrides.add(
        ConfigOverride.config(
            "cacheConfiguration.connectionTimeoutSecs",
            String.valueOf(REDIS_CONNECTION_TIMEOUT_SECS)));
    configOverrides.add(
        ConfigOverride.config(
            "cacheConfiguration.socketTimeoutSecs", String.valueOf(REDIS_SOCKET_TIMEOUT_SECS)));
    configOverrides.add(
        ConfigOverride.config("cacheConfiguration.maxRetries", String.valueOf(REDIS_MAX_RETRIES)));

    LOG.info(
        "Redis configuration overrides added - host: {}, port: {}",
        REDIS_CONTAINER.getHost(),
        REDIS_CONTAINER.getFirstMappedPort());
  }

  protected static GenericContainer<?> getRedisContainer() {
    return REDIS_CONTAINER;
  }

  protected static String getRedisHost() {
    return REDIS_CONTAINER != null ? REDIS_CONTAINER.getHost() : "localhost";
  }

  protected static Integer getRedisPort() {
    return REDIS_CONTAINER != null ? REDIS_CONTAINER.getFirstMappedPort() : REDIS_PORT;
  }

  protected boolean isCacheAvailable() {
    return RelationshipCache.isAvailable();
  }

  protected void clearCache() {
    if (RelationshipCache.isAvailable()) {
      RelationshipCache.clearAll();
    }
  }

  protected java.util.Map<String, Long> getCacheStats() {
    return RelationshipCache.getCacheStats();
  }

  @Override
  protected org.openmetadata.service.jdbi3.CollectionDAO getDao(org.jdbi.v3.core.Jdbi jdbi) {
    org.openmetadata.service.jdbi3.CollectionDAO originalDAO =
        jdbi.onDemand(org.openmetadata.service.jdbi3.CollectionDAO.class);

    // Wrap with caching decorator if cache is available
    if (RelationshipCache.isAvailable()) {
      LOG.info("Wrapping CollectionDAO with caching support for tests");
      return new CachedCollectionDAO(originalDAO);
    }

    LOG.info("Using original CollectionDAO without caching for tests");
    return originalDAO;
  }
}
