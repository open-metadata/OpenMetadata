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

package org.openmetadata.service.datacontract.odcs;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.List;
import java.util.Objects;
import java.util.Optional;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSQualityRule;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSQualityRuleArguments;

/**
 * Reads metric arguments from both places ODCS has put them: under {@code arguments} (3.1.0) and
 * directly on the rule (3.0.x, e.g. {@code rule: validValues} next to a {@code validValues} list).
 */
final class ODCSRuleArguments {
  private static final String LEGACY_PATTERN_KEY = "pattern";

  private ODCSRuleArguments() {}

  static List<String> validValues(ODCSQualityRule rule) {
    List<String> fromArguments = listOrEmpty(arguments(rule).getValidValues());
    return fromArguments.isEmpty() ? listOrEmpty(rule.getValidValues()) : fromArguments;
  }

  static Optional<String> pattern(ODCSQualityRule rule) {
    String fromArguments = arguments(rule).getPattern();
    Object legacy = rule.getAdditionalProperties().get(LEGACY_PATTERN_KEY);
    String pattern =
        nullOrEmpty(fromArguments) && legacy instanceof String text ? text : fromArguments;
    return Optional.ofNullable(pattern).filter(value -> !value.isEmpty());
  }

  /** Extra values that count as missing; null is always missing, so it is not listed. */
  static List<String> missingValues(ODCSQualityRule rule) {
    return listOrEmpty(arguments(rule).getMissingValues()).stream()
        .filter(Objects::nonNull)
        .toList();
  }

  private static ODCSQualityRuleArguments arguments(ODCSQualityRule rule) {
    return rule.getArguments() == null ? new ODCSQualityRuleArguments() : rule.getArguments();
  }
}
