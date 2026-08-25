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

/**
 * Base SPI interface for resource path resolution.
 * This enables clean separation between OpenMetadata and commercial versions
 * by allowing different implementations to provide custom resource paths.
 *
 * Specific resource types should extend this interface as marker interfaces
 * for type safety and organization.
 */
public interface ResourcePathProvider {
  /**
   * Returns the resource path pattern
   *
   * @return regex pattern for resource files
   */
  String getResourcePath();

  /**
   * Returns the priority of this provider. Higher priority providers
   * are selected over lower priority ones.
   *
   * @return priority value (higher = more important)
   */
  int getPriority();
}
