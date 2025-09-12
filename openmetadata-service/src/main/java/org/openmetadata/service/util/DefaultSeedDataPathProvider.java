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
 * Default implementation of SeedDataPathProvider that provides
 * the standard OpenMetadata seed data path pattern.
 */
public class DefaultSeedDataPathProvider implements SeedDataPathProvider {

  @Override
  public String getSeedDataPath(String entityType) {
    // Return the default OpenMetadata seed data path pattern
    return String.format(".*json/data/%s/.*\\.json$", entityType);
  }

  @Override
  public int getPriority() {
    return 0; // Lowest priority - other implementations can override
  }

  @Override
  public boolean isAvailable() {
    return true; // Always available as the fallback option
  }
}
