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

package org.openmetadata.service.util;

import java.util.Comparator;
import java.util.ServiceLoader;
import java.util.stream.StreamSupport;
import lombok.extern.slf4j.Slf4j;

/**
 * Centralized utility for resolving seed data paths across different entity types.
 * Uses Java ServiceLoader pattern to find the appropriate SeedDataPathProvider
 * implementation, enabling clean separation between OpenMetadata and commercial versions.
 */
@Slf4j
public final class SeedDataPathResolver {
  private static final SeedDataPathProvider provider;

  static {
    provider = loadProvider();
  }

  /**
   * Private constructor to prevent instantiation of utility class
   */
  private SeedDataPathResolver() {
    // Utility class - no instances allowed
  }

  /**
   * Loads the highest priority available SeedDataPathProvider implementation
   * using the Java ServiceLoader pattern.
   *
   * @return the selected provider implementation
   */
  private static SeedDataPathProvider loadProvider() {
    ServiceLoader<SeedDataPathProvider> loader = ServiceLoader.load(SeedDataPathProvider.class);

    return StreamSupport.stream(loader.spliterator(), false)
        .filter(SeedDataPathProvider::isAvailable)
        .max(Comparator.comparingInt(SeedDataPathProvider::getPriority))
        .orElseGet(
            () -> {
              LOG.debug("No SeedDataPathProvider found via ServiceLoader, using default");
              return new DefaultSeedDataPathProvider();
            });
  }

  /**
   * Gets the seed data path pattern for the specified entity type.
   *
   * @param entityType the entity type to get seed data path for
   * @return regex pattern for matching seed data files
   */
  public static String getSeedDataPath(String entityType) {
    String path = provider.getSeedDataPath(entityType);
    LOG.debug("Using seed data path for {}: {}", entityType, path);
    return path;
  }
}
