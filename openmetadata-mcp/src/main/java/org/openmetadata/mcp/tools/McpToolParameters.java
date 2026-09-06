/*
 *  Copyright 2026 Collate
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

package org.openmetadata.mcp.tools;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.Map;
import java.util.Objects;
import org.openmetadata.mcp.util.McpParams;

final class McpToolParameters {

  private final Map<String, Object> values;

  private McpToolParameters(Map<String, Object> values) {
    this.values = Objects.requireNonNull(values);
  }

  static McpToolParameters from(Map<String, Object> values) {
    return new McpToolParameters(values);
  }

  String requiredString(String key) {
    String value = optionalString(key);
    if (isBlank(value)) {
      throw new IllegalArgumentException("'" + key + "' parameter is required");
    }
    return value;
  }

  String optionalString(String key) {
    Object value = values.get(key);
    return value instanceof String text ? text : null;
  }

  int integer(String key, int defaultValue) {
    return McpParams.getInt(values, key, defaultValue);
  }

  boolean booleanValue(String key) {
    return McpParams.getBoolean(values, key, false);
  }

  static boolean isBlank(String value) {
    return nullOrEmpty(value) || value.isBlank();
  }
}
