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

package org.openmetadata.service.util.resourcepath;

import java.util.Comparator;
import java.util.ServiceLoader;
import java.util.stream.StreamSupport;
import lombok.extern.slf4j.Slf4j;

/**
 * Utility for resolving resource paths using SPI pattern.
 * Commercial versions can override by providing higher priority implementations.
 * Uses a single generic method that works with any ResourcePathProvider type.
 */
@Slf4j
public final class ResourcePathResolver {

  /**
   * Private constructor to prevent instantiation of utility class
   */
  private ResourcePathResolver() {
    // Utility class - no instances allowed
  }

  /**
   * Generic method for resolving resource paths for any ResourcePathProvider type.
   * This single method eliminates the need for type-specific resolver methods.
   * Uses ServiceLoader SPI pattern - no need to import concrete implementations.
   *
   * @param providerClass The specific provider interface class
   * @return regex pattern for matching resource files
   * @throws IllegalStateException if no provider is available for the resource type
   */
  public static <T extends ResourcePathProvider> String getResourcePath(Class<T> providerClass) {

    ServiceLoader<T> loader = ServiceLoader.load(providerClass);

    T provider =
        StreamSupport.stream(loader.spliterator(), false)
            .max(Comparator.comparingInt(ResourcePathProvider::getPriority))
            .orElseThrow(
                () ->
                    new IllegalStateException(
                        "No "
                            + providerClass.getSimpleName()
                            + " found via ServiceLoader. "
                            + "Ensure META-INF/services/"
                            + providerClass.getName()
                            + " is properly configured."));

    String path = provider.getResourcePath();
    LOG.debug("Using resource path for {}: {}", providerClass.getSimpleName(), path);
    return path;
  }
}
