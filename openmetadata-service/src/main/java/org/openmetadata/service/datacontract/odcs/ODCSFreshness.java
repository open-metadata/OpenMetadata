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
import java.util.Set;
import org.openmetadata.schema.api.data.ContractSLA;
import org.openmetadata.schema.api.data.RefreshFrequency;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSDataContract;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSQualityRule;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSSlaProperty;

/**
 * Freshness rules, which OpenMetadata runs as the contract SLA's refresh frequency instead of as a
 * test case. An ODCS document can also state that frequency as an SLA property, so the two have to
 * agree.
 */
final class ODCSFreshness {
  private static final String SLA_PROPERTY = "freshness";
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

  /**
   * Leaves the SLA freshness property out of an export when one of the contract's freshness rules
   * already states it. Importing that rule sets the same frequency and column, and a document that
   * says it twice would let an edit to one be overridden by the other.
   */
  static void omitSlaPropertyStatedByRule(ODCSDataContract odcs, DataContract contract) {
    ContractSLA sla = contract.getSla();
    boolean statedByRule =
        sla != null
            && sla.getRefreshFrequency() != null
            && listOrEmpty(contract.getOdcsQualityRules()).stream()
                .anyMatch(rule -> statesTheSla(rule, sla));
    if (statedByRule && odcs.getSlaProperties() != null) {
      List<ODCSSlaProperty> others =
          odcs.getSlaProperties().stream()
              .filter(property -> !SLA_PROPERTY.equalsIgnoreCase(property.getProperty()))
              .toList();
      odcs.setSlaProperties(others.isEmpty() ? null : others);
    }
  }

  private static boolean statesTheSla(ODCSQualityRule rule, ContractSLA sla) {
    return ODCSRuleKind.of(rule) == ODCSRuleKind.FRESHNESS
        && refreshFrequency(rule)
            .filter(frequency -> isSameFrequency(frequency, sla.getRefreshFrequency()))
            .isPresent()
        && setsTheSlaColumn(rule, sla.getColumnName());
  }

  /** An SLA without a column loses nothing when its property is left out. */
  private static boolean setsTheSlaColumn(ODCSQualityRule rule, String slaColumn) {
    return nullOrEmpty(slaColumn)
        || ODCSSlaColumn.toElement(slaColumn).equalsIgnoreCase(rule.getColumn());
  }
}
