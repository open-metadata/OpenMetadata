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
package org.openmetadata.service.util.dbtune;

import java.util.Map;

public record TableRecommendation(
    String tableName,
    Action action,
    long rowCount,
    long totalBytes,
    Map<String, String> currentSettings,
    Map<String, String> recommendedSettings,
    String reason) {

  public TableRecommendation {
    currentSettings = currentSettings == null ? Map.of() : Map.copyOf(currentSettings);
    recommendedSettings = recommendedSettings == null ? Map.of() : Map.copyOf(recommendedSettings);
  }
}
