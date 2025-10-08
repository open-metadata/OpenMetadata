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

package org.openmetadata.service.util;

import java.util.HashMap;
import java.util.Map;

/**
 * Utility class for handling pagination of fields in entity responses.
 *
 * <p>This allows entities to paginate their collections (e.g., assets in domains) without
 * loading all data at once, preventing API timeouts in large clusters.
 *
 * <p>Example usage: GET /api/v1/domains?fields=assets&assetsLimit=10&assetsOffset=0
 */
public class FieldPagination {
  private final Map<String, Integer> limits = new HashMap<>();
  private final Map<String, Integer> offsets = new HashMap<>();

  public static final int DEFAULT_LIMIT = 10;
  public static final int DEFAULT_OFFSET = 0;

  /**
   * Add pagination for a specific nested field
   *
   * @param fieldName The name of the nested field (e.g., "assets")
   * @param limit Maximum number of items to return
   * @param offset Starting offset for pagination
   */
  public void addFieldPagination(String fieldName, int limit, int offset) {
    limits.put(fieldName, limit);
    offsets.put(fieldName, offset);
  }

  /**
   * Get the limit for a specific field
   *
   * @param fieldName The field name
   * @return The limit, or DEFAULT_LIMIT if not set
   */
  public int getLimit(String fieldName) {
    return limits.getOrDefault(fieldName, DEFAULT_LIMIT);
  }

  /**
   * Get the offset for a specific field
   *
   * @param fieldName The field name
   * @return The offset, or DEFAULT_OFFSET if not set
   */
  public int getOffset(String fieldName) {
    return offsets.getOrDefault(fieldName, DEFAULT_OFFSET);
  }

  /** Check if pagination is set for a specific field */
  public boolean hasPagination(String fieldName) {
    return limits.containsKey(fieldName) || offsets.containsKey(fieldName);
  }
}
