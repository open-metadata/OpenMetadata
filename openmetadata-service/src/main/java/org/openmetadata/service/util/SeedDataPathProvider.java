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

/**
 * Provider interface for seed data path resolution across different entity types.
 * This enables clean separation between OpenMetadata and commercial versions
 * by allowing different implementations to provide custom seed data paths
 * without polluting the repository layer.
 */
public interface SeedDataPathProvider {
  /**
   * Returns the seed data path pattern for a given entity type
   *
   * @param entityType The entity type (e.g., "notificationTemplate", "document")
   * @return regex pattern for seed data files, or null if default should be used
   */
  String getSeedDataPath(String entityType);

  /**
   * Returns the priority of this provider. Higher priority providers
   * are selected over lower priority ones.
   *
   * @return priority value (higher = more important)
   */
  int getPriority();

  /**
   * Indicates if this provider is available and should be considered
   * for seed data path resolution.
   *
   * @return true if available, false otherwise
   */
  boolean isAvailable();
}
