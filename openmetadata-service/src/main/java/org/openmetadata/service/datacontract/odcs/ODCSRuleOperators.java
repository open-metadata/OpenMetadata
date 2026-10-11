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
import static org.openmetadata.service.datacontract.odcs.ODCSTestDefinitions.EQUAL;
import static org.openmetadata.service.datacontract.odcs.ODCSTestDefinitions.GREATER;
import static org.openmetadata.service.datacontract.odcs.ODCSTestDefinitions.GREATER_OR_EQUAL;
import static org.openmetadata.service.datacontract.odcs.ODCSTestDefinitions.LESS;
import static org.openmetadata.service.datacontract.odcs.ODCSTestDefinitions.LESS_OR_EQUAL;
import static org.openmetadata.service.datacontract.odcs.ODCSTestDefinitions.NOT_EQUAL;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSQualityRule;

/**
 * Translates the ODCS comparison operators ({@code mustBe}, {@code mustBeLessOrEqualTo}, …) into
 * the thresholds, ranges and comparisons OpenMetadata test definitions take.
 */
final class ODCSRuleOperators {
  private static final Set<String> PERCENT_UNITS = Set.of("percent", "percentage", "%");
  private static final double ONE_HUNDRED_PERCENT = 100;

  /** Failing rows a check tolerates, as an absolute count or a share of the rows. */
  record Tolerance(double value, boolean percentage) {}

  /** Inclusive bounds on the measured value; either side may be open. */
  record Range(Double min, Double max) {}

  /** A single comparison, with the operator spelled the way {@code tableCustomSQLQuery} expects. */
  record Comparison(String operator, double value) {}

  private ODCSRuleOperators() {}

  static boolean hasLowerBound(ODCSQualityRule rule) {
    return rule.getMustBeGreaterThan() != null || rule.getMustBeGreaterOrEqualTo() != null;
  }

  static boolean isPercentage(ODCSQualityRule rule) {
    return rule.getUnit() != null
        && PERCENT_UNITS.contains(rule.getUnit().toLowerCase(Locale.ROOT));
  }

  /**
   * For metrics that count failing rows (null values, invalid values, duplicates): how many
   * failures the rule allows. A rule with no comparison at all allows none, which is what every
   * such rule without one means in practice.
   */
  static Optional<Tolerance> failureTolerance(ODCSQualityRule rule) {
    boolean percentage = isPercentage(rule);
    return upperFailureBound(rule, percentage)
        .filter(value -> isValidTolerance(value, percentage))
        .map(value -> new Tolerance(value, percentage));
  }

  /**
   * For completeness, which ODCS measures as the share of rows that are set: the share of rows
   * that may be missing, e.g. "at least 95% complete" tolerates 5% nulls.
   */
  static Optional<Tolerance> completenessTolerance(ODCSQualityRule rule) {
    Double required =
        rule.getMustBeGreaterOrEqualTo() != null
            ? rule.getMustBeGreaterOrEqualTo()
            : rule.getMustBe();
    return Optional.ofNullable(required)
        .filter(value -> isPercentage(rule) && isValidTolerance(value, true))
        .map(value -> new Tolerance(ONE_HUNDRED_PERCENT - value, true));
  }

  /**
   * Bounds on a measured value. Strict bounds only translate for whole-number measures, where
   * {@code > 5} is {@code >= 6}.
   */
  static Optional<Range> range(ODCSQualityRule rule, boolean wholeNumbers) {
    List<Double> between = listOrEmpty(rule.getMustBeBetween());
    Range range =
        between.size() == 2
            ? new Range(between.get(0), between.get(1))
            : new Range(lowerBound(rule, wholeNumbers), upperBound(rule, wholeNumbers));
    return Optional.of(range).filter(candidate -> isUsableRange(candidate, rule, wholeNumbers));
  }

  /** The single comparison of a SQL rule, when it has exactly one. */
  static Optional<Comparison> singleComparison(ODCSQualityRule rule) {
    List<Comparison> comparisons = new ArrayList<>();
    addComparison(comparisons, EQUAL, rule.getMustBe());
    addComparison(comparisons, NOT_EQUAL, rule.getMustNotBe());
    addComparison(comparisons, GREATER, rule.getMustBeGreaterThan());
    addComparison(comparisons, GREATER_OR_EQUAL, rule.getMustBeGreaterOrEqualTo());
    addComparison(comparisons, LESS, rule.getMustBeLessThan());
    addComparison(comparisons, LESS_OR_EQUAL, rule.getMustBeLessOrEqualTo());
    return comparisons.size() == 1 && !hasBetween(rule)
        ? Optional.of(comparisons.getFirst())
        : Optional.empty();
  }

  /** The rule's comparisons as written, for explaining why they could not be translated. */
  static String describe(ODCSQualityRule rule) {
    List<String> parts = new ArrayList<>();
    addDescription(parts, "mustBe", rule.getMustBe());
    addDescription(parts, "mustNotBe", rule.getMustNotBe());
    addDescription(parts, "mustBeGreaterThan", rule.getMustBeGreaterThan());
    addDescription(parts, "mustBeGreaterOrEqualTo", rule.getMustBeGreaterOrEqualTo());
    addDescription(parts, "mustBeLessThan", rule.getMustBeLessThan());
    addDescription(parts, "mustBeLessOrEqualTo", rule.getMustBeLessOrEqualTo());
    addDescription(parts, "mustBeBetween", rule.getMustBeBetween());
    addDescription(parts, "mustNotBeBetween", rule.getMustNotBeBetween());
    return parts.isEmpty() ? "no comparison" : String.join(", ", parts);
  }

  static boolean isWhole(Double value) {
    return value != null && value == Math.rint(value) && !value.isInfinite();
  }

  /** Numbers as OpenMetadata stores parameter values: {@code 5} rather than {@code 5.0}. */
  static String format(double value) {
    return BigDecimal.valueOf(value).stripTrailingZeros().toPlainString();
  }

  private static Optional<Double> upperFailureBound(ODCSQualityRule rule, boolean percentage) {
    return Optional.<Double>empty()
        .or(() -> hasNoComparison(rule) ? Optional.of(0.0) : Optional.empty())
        .or(() -> Optional.ofNullable(rule.getMustBe()).filter(value -> value == 0))
        .or(() -> Optional.ofNullable(rule.getMustBeLessOrEqualTo()))
        .or(() -> strictUpperFailureBound(rule, percentage));
  }

  private static Optional<Double> strictUpperFailureBound(
      ODCSQualityRule rule, boolean percentage) {
    return Optional.ofNullable(rule.getMustBeLessThan())
        .filter(value -> !percentage && isWhole(value) && value >= 1)
        .map(value -> value - 1);
  }

  private static boolean isValidTolerance(double value, boolean percentage) {
    return value >= 0 && (!percentage || value <= ONE_HUNDRED_PERCENT);
  }

  private static Double lowerBound(ODCSQualityRule rule, boolean wholeNumbers) {
    Double strict = rule.getMustBeGreaterThan();
    return rule.getMustBeGreaterOrEqualTo() != null
        ? rule.getMustBeGreaterOrEqualTo()
        : wholeStep(strict, wholeNumbers, 1);
  }

  private static Double upperBound(ODCSQualityRule rule, boolean wholeNumbers) {
    Double strict = rule.getMustBeLessThan();
    return rule.getMustBeLessOrEqualTo() != null
        ? rule.getMustBeLessOrEqualTo()
        : wholeStep(strict, wholeNumbers, -1);
  }

  private static Double wholeStep(Double strictBound, boolean wholeNumbers, int step) {
    return wholeNumbers && isWhole(strictBound) ? strictBound + step : null;
  }

  private static boolean isUsableRange(Range range, ODCSQualityRule rule, boolean wholeNumbers) {
    boolean hasBound = range.min() != null || range.max() != null;
    boolean ordered = range.min() == null || range.max() == null || range.min() <= range.max();
    boolean strictBoundLost =
        !wholeNumbers && (rule.getMustBeGreaterThan() != null || rule.getMustBeLessThan() != null);
    boolean wholeWhenRequired =
        !wholeNumbers || (isWholeOrNull(range.min()) && isWholeOrNull(range.max()));
    return hasBound && ordered && !strictBoundLost && wholeWhenRequired && rule.getMustBe() == null;
  }

  private static boolean isWholeOrNull(Double value) {
    return value == null || isWhole(value);
  }

  private static boolean hasNoComparison(ODCSQualityRule rule) {
    return rule.getMustBe() == null
        && rule.getMustNotBe() == null
        && rule.getMustBeGreaterThan() == null
        && rule.getMustBeGreaterOrEqualTo() == null
        && rule.getMustBeLessThan() == null
        && rule.getMustBeLessOrEqualTo() == null
        && !hasBetween(rule);
  }

  private static boolean hasBetween(ODCSQualityRule rule) {
    return !listOrEmpty(rule.getMustBeBetween()).isEmpty()
        || !listOrEmpty(rule.getMustNotBeBetween()).isEmpty();
  }

  private static void addComparison(List<Comparison> comparisons, String operator, Double value) {
    if (value != null) {
      comparisons.add(new Comparison(operator, value));
    }
  }

  private static void addDescription(List<String> parts, String operator, Object value) {
    if (value instanceof Double number) {
      parts.add(operator + " " + format(number));
    } else if (value instanceof List<?> bounds && !bounds.isEmpty()) {
      parts.add(operator + " " + bounds);
    }
  }
}
