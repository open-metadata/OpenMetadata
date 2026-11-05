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

import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import org.openmetadata.schema.api.data.RefreshFrequency;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSQualityRule;

/**
 * Freshness rules, which OpenMetadata runs as the contract SLA's refresh frequency instead of as a
 * test case. The SLA's own freshness property states the same frequency, and is what exports keep:
 * other ODCS tools read it, and imports that create no test cases leave freshness rules unapplied.
 */
final class ODCSFreshness {
  private static final Set<String> REFRESH_FREQUENCY_UNITS =
      Set.of("hour", "day", "week", "month", "year");

  private ODCSFreshness() {}

  static boolean isRefreshFrequencyUnit(String normalizedUnit) {
    return normalizedUnit != null && REFRESH_FREQUENCY_UNITS.contains(normalizedUnit);
  }

  /** The refresh frequency the rule asks for, when OpenMetadata can express it. */
  static Optional<RefreshFrequency> refreshFrequency(ODCSQualityRule rule) {
    String unit = ODCSTimeUnits.normalize(rule.getUnit());
    Double interval =
        rule.getMustBeLessOrEqualTo() != null ? rule.getMustBeLessOrEqualTo() : rule.getMustBe();
    return Optional.ofNullable(interval)
        .filter(
            value -> isRefreshFrequencyUnit(unit) && ODCSRuleOperators.isWhole(value) && value >= 1)
        .map(
            value ->
                new RefreshFrequency()
                    .withInterval(value.intValue())
                    .withUnit(RefreshFrequency.Unit.fromValue(unit)));
  }

  static boolean isSameFrequency(RefreshFrequency first, RefreshFrequency second) {
    return Objects.equals(first.getInterval(), second.getInterval())
        && first.getUnit() == second.getUnit();
  }

  static String describe(RefreshFrequency frequency) {
    return String.format("%d %s(s)", frequency.getInterval(), frequency.getUnit().value());
  }
}
