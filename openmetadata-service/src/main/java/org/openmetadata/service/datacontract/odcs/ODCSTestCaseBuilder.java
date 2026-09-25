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

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.datacontract.odcs.ODCSTestDefinitions.ALLOWED_VALUES;
import static org.openmetadata.service.datacontract.odcs.ODCSTestDefinitions.COLUMN_VALUES_MISSING_COUNT;
import static org.openmetadata.service.datacontract.odcs.ODCSTestDefinitions.COLUMN_VALUES_TO_BE_BETWEEN;
import static org.openmetadata.service.datacontract.odcs.ODCSTestDefinitions.COLUMN_VALUES_TO_BE_IN_SET;
import static org.openmetadata.service.datacontract.odcs.ODCSTestDefinitions.COLUMN_VALUES_TO_BE_NOT_NULL;
import static org.openmetadata.service.datacontract.odcs.ODCSTestDefinitions.COLUMN_VALUES_TO_BE_UNIQUE;
import static org.openmetadata.service.datacontract.odcs.ODCSTestDefinitions.COLUMN_VALUES_TO_MATCH_REGEX;
import static org.openmetadata.service.datacontract.odcs.ODCSTestDefinitions.COLUMN_VALUE_LENGTHS_TO_BE_BETWEEN;
import static org.openmetadata.service.datacontract.odcs.ODCSTestDefinitions.MATCH_ENUM;
import static org.openmetadata.service.datacontract.odcs.ODCSTestDefinitions.MAX_LENGTH;
import static org.openmetadata.service.datacontract.odcs.ODCSTestDefinitions.MAX_VALUE;
import static org.openmetadata.service.datacontract.odcs.ODCSTestDefinitions.MIN_LENGTH;
import static org.openmetadata.service.datacontract.odcs.ODCSTestDefinitions.MIN_VALUE;
import static org.openmetadata.service.datacontract.odcs.ODCSTestDefinitions.MISSING_COUNT_VALUE;
import static org.openmetadata.service.datacontract.odcs.ODCSTestDefinitions.MISSING_VALUE_MATCH;
import static org.openmetadata.service.datacontract.odcs.ODCSTestDefinitions.PERCENTAGE_UNIT;
import static org.openmetadata.service.datacontract.odcs.ODCSTestDefinitions.REGEX;
import static org.openmetadata.service.datacontract.odcs.ODCSTestDefinitions.TABLE_ROW_COUNT_TO_BE_BETWEEN;
import static org.openmetadata.service.datacontract.odcs.ODCSTestDefinitions.TABLE_ROW_COUNT_TO_EQUAL;
import static org.openmetadata.service.datacontract.odcs.ODCSTestDefinitions.THRESHOLD;
import static org.openmetadata.service.datacontract.odcs.ODCSTestDefinitions.THRESHOLD_UNIT;
import static org.openmetadata.service.datacontract.odcs.ODCSTestDefinitions.VALUE;
import static org.openmetadata.service.datacontract.odcs.ODCSTestDefinitions.parameter;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.openmetadata.schema.api.data.RefreshFrequency;
import org.openmetadata.schema.api.tests.CreateTestCase;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSQualityRule;
import org.openmetadata.schema.tests.TestCaseParameterValue;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.datacontract.odcs.ODCSRuleOperators.Range;
import org.openmetadata.service.datacontract.odcs.ODCSRuleOperators.Tolerance;
import org.openmetadata.service.datacontract.odcs.ODCSRuleOutcome.SlaOutcome;
import org.openmetadata.service.datacontract.odcs.ODCSRuleOutcome.TestCaseOutcome;
import org.openmetadata.service.datacontract.odcs.ODCSRuleOutcome.UnsupportedOutcome;

/**
 * Builds the OpenMetadata check for one ODCS rule on the target table. The test case it builds has no
 * name yet: names are unique per table or column, so {@link ODCSQualityRuleMapper} assigns them
 * once it has seen every rule.
 */
final class ODCSTestCaseBuilder {
  /** A rule together with the table it applies to and, for column rules, the column. */
  record RuleOnTarget(ODCSQualityRule rule, ODCSTableTarget target, String column) {
    String columnLink() {
      return target.columnLink(column);
    }

    String columnOrTableLink() {
      return column == null ? target.tableLink() : target.columnLink(column);
    }
  }

  private ODCSTestCaseBuilder() {}

  static ODCSRuleOutcome build(ODCSQualityRule rule, ODCSTableTarget target) {
    ODCSRuleKind kind = ODCSRuleKind.of(rule);
    Optional<String> column = target.resolveColumn(rule.getColumn());
    return kind.needsColumn() && column.isEmpty()
        ? unsupported(rule, missingColumnReason(rule, target))
        : buildKind(kind, new RuleOnTarget(rule, target, column.orElse(null)));
  }

  static TestCaseOutcome testCase(
      RuleOnTarget ruleOnTarget,
      String testDefinition,
      String entityLink,
      List<TestCaseParameterValue> parameters) {
    ODCSQualityRule rule = ruleOnTarget.rule();
    CreateTestCase testCase =
        new CreateTestCase()
            .withTestDefinition(testDefinition)
            .withEntityLink(entityLink)
            .withParameterValues(parameters)
            .withDisplayName(rule.getName())
            .withDescription(describe(rule));
    return new TestCaseOutcome(rule, testCase);
  }

  static UnsupportedOutcome unsupported(ODCSQualityRule rule, String reason) {
    return new UnsupportedOutcome(rule, reason);
  }

  static UnsupportedOutcome unsupportedComparison(ODCSQualityRule rule) {
    return unsupported(
        rule,
        String.format(
            "Its comparison (%s) has no equivalent in an OpenMetadata test.",
            ODCSRuleOperators.describe(rule)));
  }

  private static ODCSRuleOutcome buildKind(ODCSRuleKind kind, RuleOnTarget ruleOnTarget) {
    ODCSQualityRule rule = ruleOnTarget.rule();
    return switch (kind) {
      case NULL_VALUES -> failureCountTest(ruleOnTarget, COLUMN_VALUES_TO_BE_NOT_NULL, List.of());
      case DUPLICATE_VALUES -> failureCountTest(
          ruleOnTarget, COLUMN_VALUES_TO_BE_UNIQUE, List.of());
      case VALID_VALUES -> failureCountTest(
          ruleOnTarget, COLUMN_VALUES_TO_BE_IN_SET, inSetParameters(rule));
        // ODCSRuleKind only classifies a rule as PATTERN when it carries a pattern.
      case PATTERN -> failureCountTest(
          ruleOnTarget,
          COLUMN_VALUES_TO_MATCH_REGEX,
          List.of(parameter(REGEX, ODCSRuleArguments.pattern(rule).orElseThrow())));
      case COMPLETENESS -> completenessTest(ruleOnTarget);
      case MISSING_VALUES -> missingValuesTest(ruleOnTarget);
      case TEXT_LENGTH -> columnRangeTest(
          ruleOnTarget, COLUMN_VALUE_LENGTHS_TO_BE_BETWEEN, MIN_LENGTH, MAX_LENGTH);
      case VALUE_RANGE -> columnRangeTest(
          ruleOnTarget, COLUMN_VALUES_TO_BE_BETWEEN, MIN_VALUE, MAX_VALUE);
      case ROW_COUNT -> rowCountTest(ruleOnTarget);
      case SQL -> ODCSSqlRuleBuilder.build(ruleOnTarget);
      case FRESHNESS -> freshness(ruleOnTarget);
      case OPENMETADATA_TEST -> ODCSOpenMetadataRules.toTestCase(ruleOnTarget);
      case UNSUPPORTED -> unsupported(rule, ODCSRuleKind.unsupportedReason(rule));
    };
  }

  private static ODCSRuleOutcome failureCountTest(
      RuleOnTarget ruleOnTarget, String testDefinition, List<TestCaseParameterValue> parameters) {
    return ODCSRuleOperators.failureTolerance(ruleOnTarget.rule())
        .<ODCSRuleOutcome>map(
            tolerance ->
                testCase(
                    ruleOnTarget,
                    testDefinition,
                    ruleOnTarget.columnLink(),
                    withTolerance(parameters, tolerance)))
        .orElseGet(() -> unsupportedComparison(ruleOnTarget.rule()));
  }

  private static ODCSRuleOutcome completenessTest(RuleOnTarget ruleOnTarget) {
    return ODCSRuleOperators.completenessTolerance(ruleOnTarget.rule())
        .<ODCSRuleOutcome>map(
            tolerance ->
                testCase(
                    ruleOnTarget,
                    COLUMN_VALUES_TO_BE_NOT_NULL,
                    ruleOnTarget.columnLink(),
                    withTolerance(List.of(), tolerance)))
        .orElseGet(
            () ->
                unsupported(
                    ruleOnTarget.rule(),
                    String.format(
                        "Completeness must be a minimum share in percent; this rule has %s.",
                        ODCSRuleOperators.describe(ruleOnTarget.rule()))));
  }

  private static ODCSRuleOutcome missingValuesTest(RuleOnTarget ruleOnTarget) {
    ODCSQualityRule rule = ruleOnTarget.rule();
    return Optional.ofNullable(rule.getMustBe())
        .filter(ODCSRuleOperators::isWhole)
        .<ODCSRuleOutcome>map(
            count ->
                testCase(
                    ruleOnTarget,
                    COLUMN_VALUES_MISSING_COUNT,
                    ruleOnTarget.columnLink(),
                    missingValuesParameters(rule, count)))
        .orElseGet(() -> unsupportedComparison(rule));
  }

  private static ODCSRuleOutcome columnRangeTest(
      RuleOnTarget ruleOnTarget, String testDefinition, String minName, String maxName) {
    boolean wholeNumbers = COLUMN_VALUE_LENGTHS_TO_BE_BETWEEN.equals(testDefinition);
    return ODCSRuleOperators.range(ruleOnTarget.rule(), wholeNumbers)
        .<ODCSRuleOutcome>map(
            range ->
                testCase(
                    ruleOnTarget,
                    testDefinition,
                    ruleOnTarget.columnLink(),
                    rangeParameters(range, minName, maxName)))
        .orElseGet(() -> unsupportedComparison(ruleOnTarget.rule()));
  }

  private static ODCSRuleOutcome rowCountTest(RuleOnTarget ruleOnTarget) {
    ODCSQualityRule rule = ruleOnTarget.rule();
    String tableLink = ruleOnTarget.target().tableLink();
    Optional<ODCSRuleOutcome> exactCount =
        Optional.ofNullable(rule.getMustBe())
            .filter(ODCSRuleOperators::isWhole)
            .map(
                count ->
                    testCase(
                        ruleOnTarget,
                        TABLE_ROW_COUNT_TO_EQUAL,
                        tableLink,
                        List.of(parameter(VALUE, ODCSRuleOperators.format(count)))));
    return exactCount
        .or(
            () ->
                ODCSRuleOperators.range(rule, true)
                    .map(
                        range ->
                            testCase(
                                ruleOnTarget,
                                TABLE_ROW_COUNT_TO_BE_BETWEEN,
                                tableLink,
                                rangeParameters(range, MIN_VALUE, MAX_VALUE))))
        .orElseGet(() -> unsupportedComparison(rule));
  }

  private static ODCSRuleOutcome freshness(RuleOnTarget ruleOnTarget) {
    ODCSQualityRule rule = ruleOnTarget.rule();
    String unit = ODCSTimeUnits.normalize(rule.getUnit());
    Optional<RefreshFrequency> frequency = ODCSFreshness.refreshFrequency(rule);
    ODCSRuleOutcome outcome;
    if (!ODCSFreshness.isRefreshFrequencyUnit(unit)) {
      outcome =
          unsupported(
              rule,
              String.format(
                  "OpenMetadata measures refresh frequency in hours or longer; the rule uses '%s'.",
                  unit == null ? "no unit" : unit));
    } else if (frequency.isEmpty()) {
      outcome = unsupportedComparison(rule);
    } else {
      String column = ruleOnTarget.column();
      outcome =
          new SlaOutcome(
              rule,
              frequency.get(),
              column == null ? null : ruleOnTarget.target().columnFqn(column));
    }
    return outcome;
  }

  private static List<TestCaseParameterValue> inSetParameters(ODCSQualityRule rule) {
    return List.of(
        parameter(ALLOWED_VALUES, JsonUtils.pojoToJson(ODCSRuleArguments.validValues(rule))),
        parameter(MATCH_ENUM, Boolean.TRUE.toString()));
  }

  private static List<TestCaseParameterValue> missingValuesParameters(
      ODCSQualityRule rule, double count) {
    List<TestCaseParameterValue> parameters = new ArrayList<>();
    parameters.add(parameter(MISSING_COUNT_VALUE, ODCSRuleOperators.format(count)));
    List<String> missingValues = ODCSRuleArguments.missingValues(rule);
    if (!missingValues.isEmpty()) {
      parameters.add(parameter(MISSING_VALUE_MATCH, JsonUtils.pojoToJson(missingValues)));
    }
    return parameters;
  }

  private static List<TestCaseParameterValue> rangeParameters(
      Range range, String minName, String maxName) {
    List<TestCaseParameterValue> parameters = new ArrayList<>();
    if (range.min() != null) {
      parameters.add(parameter(minName, ODCSRuleOperators.format(range.min())));
    }
    if (range.max() != null) {
      parameters.add(parameter(maxName, ODCSRuleOperators.format(range.max())));
    }
    return parameters;
  }

  private static List<TestCaseParameterValue> withTolerance(
      List<TestCaseParameterValue> parameters, Tolerance tolerance) {
    List<TestCaseParameterValue> all = new ArrayList<>(parameters);
    if (tolerance.value() > 0) {
      all.add(parameter(THRESHOLD, ODCSRuleOperators.format(tolerance.value())));
      if (tolerance.percentage()) {
        all.add(parameter(THRESHOLD_UNIT, PERCENTAGE_UNIT));
      }
    }
    return all;
  }

  private static String describe(ODCSQualityRule rule) {
    String description = rule.getDescription();
    String impact = rule.getBusinessImpact();
    String text;
    if (nullOrEmpty(impact)) {
      text = description;
    } else {
      String impactLine = "**Business impact:** " + impact;
      text = nullOrEmpty(description) ? impactLine : description + "\n\n" + impactLine;
    }
    return text;
  }

  private static String missingColumnReason(ODCSQualityRule rule, ODCSTableTarget target) {
    return nullOrEmpty(rule.getColumn())
        ? "The rule checks column values but is not attached to a column."
        : String.format(
            "'%s' is not a column of table %s.", rule.getColumn(), target.fullyQualifiedName());
  }
}
