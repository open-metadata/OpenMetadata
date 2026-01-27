/*
 *  Copyright 2024 Collate
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

package org.openmetadata.service.apps.bundles.searchIndex.distributed;

import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.cache.CacheConfig;
import org.openmetadata.service.jdbi3.CollectionDAO;

/**
 * Factory for creating the appropriate DistributedJobNotifier based on configuration.
 *
 * <p>Uses Redis Pub/Sub when Redis is configured and available, otherwise falls back to database
 * polling.
 */
@Slf4j
public class DistributedJobNotifierFactory {

  private DistributedJobNotifierFactory() {
    // Utility class
  }

  /**
   * Create a DistributedJobNotifier based on the current configuration.
   *
   * @param cacheConfig The cache configuration (contains Redis settings)
   * @param collectionDAO The DAO for database access
   * @param serverId The current server's ID
   * @return The appropriate notifier implementation
   */
  public static DistributedJobNotifier create(
      CacheConfig cacheConfig, CollectionDAO collectionDAO, String serverId) {

    if (cacheConfig != null && cacheConfig.provider == CacheConfig.Provider.redis) {
      // Redis is configured - try to use Redis Pub/Sub
      if (isRedisConfigValid(cacheConfig)) {
        LOG.info(
            "Redis is configured - using Redis Pub/Sub for distributed job notifications (instant discovery)");
        return new RedisJobNotifier(cacheConfig, serverId);
      } else {
        LOG.warn(
            "Redis is configured but URL is missing - falling back to database polling for job notifications");
      }
    }

    LOG.info(
        "Redis not configured - using database polling for distributed job notifications (30s discovery delay)");
    return new PollingJobNotifier(collectionDAO, serverId);
  }

  /**
   * Check if Redis configuration is valid and complete.
   *
   * @param cacheConfig The cache configuration
   * @return true if Redis can be used
   */
  private static boolean isRedisConfigValid(CacheConfig cacheConfig) {
    return cacheConfig.redis != null
        && cacheConfig.redis.url != null
        && !cacheConfig.redis.url.isEmpty();
  }
}
