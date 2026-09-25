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
import static org.openmetadata.service.datacontract.odcs.ODCSTestDefinitions.ALLOWED_VALUES;
import static org.openmetadata.service.datacontract.odcs.ODCSTestDefinitions.COLUMN_VALUES_MISSING_COUNT;
import static org.openmetadata.service.datacontract.odcs.ODCSTestDefinitions.COLUMN_VALUES_TO_BE_IN_SET;
import static org.openmetadata.service.datacontract.odcs.ODCSTestDefinitions.COLUMN_VALUES_TO_BE_NOT_NULL;
import static org.openmetadata.service.datacontract.odcs.ODCSTestDefinitions.COLUMN_VALUES_TO_BE_UNIQUE;
import static org.openmetadata.service.datacontract.odcs.ODCSTestDefinitions.COLUMN_VALUES_TO_MATCH_REGEX;
import static org.openmetadata.service.datacontract.odcs.ODCSTestDefinitions.COUNT_STRATEGY;
import static org.openmetadata.service.datacontract.odcs.ODCSTestDefinitions.EQUAL;
import static org.openmetadata.service.datacontract.odcs.ODCSTestDefinitions.GREATER;
import static org.openmetadata.service.datacontract.odcs.ODCSTestDefinitions.GREATER_OR_EQUAL;
import static org.openmetadata.service.datacontract.odcs.ODCSTestDefinitions.LESS;
import static org.openmetadata.service.datacontract.odcs.ODCSTestDefinitions.LESS_OR_EQUAL;
import static org.openmetadata.service.datacontract.odcs.ODCSTestDefinitions.MATCH_ENUM;
import static org.openmetadata.service.datacontract.odcs.ODCSTestDefinitions.MAX_VALUE;
import static org.openmetadata.service.datacontract.odcs.ODCSTestDefinitions.MIN_VALUE;
import static org.openmetadata.service.datacontract.odcs.ODCSTestDefinitions.MISSING_COUNT_VALUE;
import static org.openmetadata.service.datacontract.odcs.ODCSTestDefinitions.MISSING_VALUE_MATCH;
import static org.openmetadata.service.datacontract.odcs.ODCSTestDefinitions.NOT_EQUAL;
import static org.openmetadata.service.datacontract.odcs.ODCSTestDefinitions.OPERATOR;
import static org.openmetadata.service.datacontract.odcs.ODCSTestDefinitions.PERCENTAGE_UNIT;
import static org.openmetadata.service.datacontract.odcs.ODCSTestDefinitions.REGEX;
import static org.openmetadata.service.datacontract.odcs.ODCSTestDefinitions.SQL_EXPRESSION;
import static org.openmetadata.service.datacontract.odcs.ODCSTestDefinitions.STRATEGY;
import static org.openmetadata.service.datacontract.odcs.ODCSTestDefinitions.TABLE_CUSTOM_SQL_QUERY;
import static org.openmetadata.service.datacontract.odcs.ODCSTestDefinitions.TABLE_ROW_COUNT_TO_BE_BETWEEN;
import static org.openmetadata.service.datacontract.odcs.ODCSTestDefinitions.TABLE_ROW_COUNT_TO_EQUAL;
import static org.openmetadata.service.datacontract.odcs.ODCSTestDefinitions.THRESHOLD;
import static org.openmetadata.service.datacontract.odcs.ODCSTestDefinitions.THRESHOLD_UNIT;
import static org.openmetadata.service.datacontract.odcs.ODCSTestDefinitions.VALUE;

import com.fasterxml.jackson.core.type.TypeReference;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.BiConsumer;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSQualityRule;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSQualityRuleArguments;
import org.openmetadata.schema.exception.JsonParsingException;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestCaseParameterValue;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.resources.feeds.MessageParser.EntityLink;

/**
 * Writes an OpenMetadata test case as an ODCS quality rule. Tests with an ODCS metric equivalent become
 * library or SQL rules; every other test becomes an {@code openmetadata} custom rule so no test is
 * lost on export. The test case name becomes the rule {@code id} when it is a valid ODCS id, so
 * importing the exported file updates the same test case.
 */
@Slf4j
public final class ODCSTestCaseExporter {
  private static final Pattern ODCS_STABLE_ID = Pattern.compile("^[^\\s.#/\\\\@!%&^]+$");
  private static final String PERCENT_UNIT = "percent";
  private static final Map<String, BiConsumer<ODCSQualityRule, Double>> COMPARISON_SETTERS =
      Map.of(
          EQUAL, ODCSQualityRule::setMustBe,
          NOT_EQUAL, ODCSQualityRule::setMustNotBe,
          GREATER, ODCSQualityRule::setMustBeGreaterThan,
          GREATER_OR_EQUAL, ODCSQualityRule::setMustBeGreaterOrEqualTo,
          LESS, ODCSQualityRule::setMustBeLessThan,
          LESS_OR_EQUAL, ODCSQualityRule::setMustBeLessOrEqualTo);

  private ODCSTestCaseExporter() {}

  /**
   * @param tableAnchor name that places table-level rules on the exported schema object, i.e. the
   *     name of the object the contract's columns are exported under
   */
  public static ODCSQualityRule toRule(TestCase testCase, String tableAnchor) {
    ODCSQualityRule base = baseRule(testCase, tableAnchor);
    Map<String, String> parameters = parameters(testCase);
    Optional<ODCSQualityRule> standardRule =
        switch (definitionName(testCase)) {
          case COLUMN_VALUES_TO_BE_NOT_NULL -> Optional.of(
              failureRule(base, ODCSQualityRule.OdcsQualityMetric.NULL_VALUES, parameters));
          case COLUMN_VALUES_TO_BE_UNIQUE -> Optional.of(
              failureRule(base, ODCSQualityRule.OdcsQualityMetric.DUPLICATE_VALUES, parameters));
          case COLUMN_VALUES_TO_BE_IN_SET -> validValuesRule(base, parameters);
          case COLUMN_VALUES_TO_MATCH_REGEX -> patternRule(base, parameters);
          case COLUMN_VALUES_MISSING_COUNT -> missingValuesRule(base, parameters);
          case TABLE_ROW_COUNT_TO_BE_BETWEEN -> Optional.of(rowCountRangeRule(base, parameters));
          case TABLE_ROW_COUNT_TO_EQUAL -> exactRowCountRule(base, parameters);
          case TABLE_CUSTOM_SQL_QUERY -> sqlRule(base, parameters);
          default -> Optional.empty();
        };
    return standardRule.orElseGet(() -> openMetadataRule(base, testCase));
  }

  private static ODCSQualityRule baseRule(TestCase testCase, String tableAnchor) {
    String column = EntityLink.parse(testCase.getEntityLink()).getArrayFieldName();
    String name = testCase.getName();
    return new ODCSQualityRule()
        .withId(ODCS_STABLE_ID.matcher(name).matches() ? name : null)
        .withName(nullOrEmpty(testCase.getDisplayName()) ? name : testCase.getDisplayName())
        .withDescription(testCase.getDescription())
        .withColumn(column == null ? tableAnchor : column);
  }

  private static ODCSQualityRule failureRule(
      ODCSQualityRule base,
      ODCSQualityRule.OdcsQualityMetric metric,
      Map<String, String> parameters) {
    double threshold = number(parameters.get(THRESHOLD)).orElse(0.0);
    ODCSQualityRule rule = base.withType(ODCSQualityRule.Type.LIBRARY).withMetric(metric);
    if (threshold == 0) {
      rule.setMustBe(0.0);
    } else {
      rule.setMustBeLessOrEqualTo(threshold);
    }
    if (PERCENTAGE_UNIT.equals(parameters.get(THRESHOLD_UNIT))) {
      rule.setUnit(PERCENT_UNIT);
    }
    return rule;
  }

  private static Optional<ODCSQualityRule> validValuesRule(
      ODCSQualityRule base, Map<String, String> parameters) {
    return stringList(parameters.get(ALLOWED_VALUES))
        .filter(values -> Boolean.parseBoolean(parameters.get(MATCH_ENUM)))
        .map(
            values ->
                failureRule(base, ODCSQualityRule.OdcsQualityMetric.INVALID_VALUES, parameters)
                    .withArguments(new ODCSQualityRuleArguments().withValidValues(values)));
  }

  private static Optional<ODCSQualityRule> patternRule(
      ODCSQualityRule base, Map<String, String> parameters) {
    return Optional.ofNullable(parameters.get(REGEX))
        .map(
            pattern ->
                failureRule(base, ODCSQualityRule.OdcsQualityMetric.INVALID_VALUES, parameters)
                    .withArguments(new ODCSQualityRuleArguments().withPattern(pattern)));
  }

  private static Optional<ODCSQualityRule> missingValuesRule(
      ODCSQualityRule base, Map<String, String> parameters) {
    Optional<List<String>> missingValues =
        parameters.containsKey(MISSING_VALUE_MATCH)
            ? stringList(parameters.get(MISSING_VALUE_MATCH))
            : Optional.of(List.of());
    return number(parameters.get(MISSING_COUNT_VALUE))
        .filter(count -> missingValues.isPresent() && !parameters.containsKey(THRESHOLD))
        .map(
            count ->
                base.withType(ODCSQualityRule.Type.LIBRARY)
                    .withMetric(ODCSQualityRule.OdcsQualityMetric.MISSING_VALUES)
                    .withMustBe(count)
                    .withArguments(missingValuesArguments(missingValues.get())));
  }

  private static ODCSQualityRule rowCountRangeRule(
      ODCSQualityRule base, Map<String, String> parameters) {
    Optional<Double> min = number(parameters.get(MIN_VALUE));
    Optional<Double> max = number(parameters.get(MAX_VALUE));
    ODCSQualityRule rule =
        base.withType(ODCSQualityRule.Type.LIBRARY)
            .withMetric(ODCSQualityRule.OdcsQualityMetric.ROW_COUNT);
    if (min.isPresent() && max.isPresent()) {
      rule.setMustBeBetween(List.of(min.get(), max.get()));
    } else {
      min.ifPresent(rule::setMustBeGreaterOrEqualTo);
      max.ifPresent(rule::setMustBeLessOrEqualTo);
    }
    return rule;
  }

  private static Optional<ODCSQualityRule> exactRowCountRule(
      ODCSQualityRule base, Map<String, String> parameters) {
    return number(parameters.get(VALUE))
        .map(
            count ->
                base.withType(ODCSQualityRule.Type.LIBRARY)
                    .withMetric(ODCSQualityRule.OdcsQualityMetric.ROW_COUNT)
                    .withMustBe(count));
  }

  /**
   * Only the COUNT strategy compares a value the query returns, which is what an ODCS SQL rule
   * does; ROWS counts returned rows and so stays an OpenMetadata rule. So does any test the SQL
   * rule would not import back as: a grouped query, or a comparison with a fraction.
   */
  private static Optional<ODCSQualityRule> sqlRule(
      ODCSQualityRule base, Map<String, String> parameters) {
    BiConsumer<ODCSQualityRule, Double> comparison =
        COMPARISON_SETTERS.get(parameters.getOrDefault(OPERATOR, LESS_OR_EQUAL));
    double threshold = number(parameters.get(THRESHOLD)).orElse(0.0);
    return Optional.ofNullable(parameters.get(SQL_EXPRESSION))
        .filter(
            query ->
                comparison != null
                    && ODCSRuleOperators.isWhole(threshold)
                    && comparesTheReturnedValue(query, parameters))
        .map(
            query -> {
              ODCSQualityRule rule = base.withType(ODCSQualityRule.Type.SQL).withQuery(query);
              comparison.accept(rule, threshold);
              return rule;
            });
  }

  private static boolean comparesTheReturnedValue(String query, Map<String, String> parameters) {
    return COUNT_STRATEGY.equals(parameters.get(STRATEGY)) && !ODCSSqlRuleBuilder.groupsRows(query);
  }

  private static ODCSQualityRule openMetadataRule(ODCSQualityRule base, TestCase testCase) {
    return base.withId(null)
        .withType(ODCSQualityRule.Type.CUSTOM)
        .withEngine(ODCSRuleKind.OPENMETADATA_ENGINE)
        .withImplementation(
            ODCSOpenMetadataRules.implementation(
                testCase.getName(),
                definitionName(testCase),
                listOrEmpty(testCase.getParameterValues())));
  }

  private static ODCSQualityRuleArguments missingValuesArguments(List<String> missingValues) {
    return missingValues.isEmpty()
        ? null
        : new ODCSQualityRuleArguments().withMissingValues(missingValues);
  }

  private static String definitionName(TestCase testCase) {
    return testCase.getTestDefinition() == null
        ? ""
        : testCase.getTestDefinition().getFullyQualifiedName();
  }

  private static Map<String, String> parameters(TestCase testCase) {
    return listOrEmpty(testCase.getParameterValues()).stream()
        .filter(parameter -> parameter.getName() != null && parameter.getValue() != null)
        .collect(
            Collectors.toMap(
                TestCaseParameterValue::getName,
                TestCaseParameterValue::getValue,
                (first, second) -> second));
  }

  private static Optional<Double> number(String value) {
    Optional<Double> parsed = Optional.empty();
    if (!nullOrEmpty(value)) {
      try {
        parsed = Optional.of(Double.parseDouble(value.trim()));
      } catch (NumberFormatException e) {
        LOG.debug("Test case parameter '{}' is not a number", value);
      }
    }
    return parsed;
  }

  private static Optional<List<String>> stringList(String json) {
    Optional<List<String>> values = Optional.empty();
    if (!nullOrEmpty(json)) {
      try {
        List<Object> raw = JsonUtils.readValue(json, new TypeReference<List<Object>>() {});
        values = Optional.of(raw.stream().map(String::valueOf).toList());
      } catch (JsonParsingException e) {
        LOG.debug("Test case parameter '{}' is not a JSON list", json);
      }
    }
    return values;
  }
}
