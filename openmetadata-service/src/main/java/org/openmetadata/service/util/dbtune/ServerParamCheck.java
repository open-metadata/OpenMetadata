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

public record ServerParamCheck(
    String parameter, String currentValue, String recommendedValue, String status, String note) {

  public static final String STATUS_OK = "OK";

  /**
   * Direction-agnostic. Some recommended values (e.g. {@code random_page_cost = 1.1},
   * {@code autovacuum_*_scale_factor}) are deliberately lower than the engine default — labelling
   * those mismatches as "undersized" would be wrong. Operators see the actual current vs
   * recommended values in the report and can judge direction themselves.
   */
  public static final String STATUS_MISMATCH = "MISMATCH";

  public static final String STATUS_UNTUNED = "UNTUNED";
  public static final String STATUS_UNKNOWN = "UNKNOWN";
}
