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
import static org.openmetadata.service.datacontract.odcs.ODCSTestDefinitions.COUNT_STRATEGY;
import static org.openmetadata.service.datacontract.odcs.ODCSTestDefinitions.OPERATOR;
import static org.openmetadata.service.datacontract.odcs.ODCSTestDefinitions.ROWS_STRATEGY;
import static org.openmetadata.service.datacontract.odcs.ODCSTestDefinitions.SQL_EXPRESSION;
import static org.openmetadata.service.datacontract.odcs.ODCSTestDefinitions.STRATEGY;
import static org.openmetadata.service.datacontract.odcs.ODCSTestDefinitions.TABLE_CUSTOM_SQL_QUERY;
import static org.openmetadata.service.datacontract.odcs.ODCSTestDefinitions.THRESHOLD;
import static org.openmetadata.service.datacontract.odcs.ODCSTestDefinitions.parameter;

import java.util.List;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSQualityRule;
import org.openmetadata.schema.tests.TestCaseParameterValue;
import org.openmetadata.service.datacontract.odcs.ODCSRuleOperators.Comparison;
import org.openmetadata.service.datacontract.odcs.ODCSTestCaseBuilder.RuleOnTarget;

/**
 * Turns an ODCS {@code type: sql} rule into a {@code tableCustomSQLQuery} test. ODCS queries refer
 * to the table and the property through placeholders, written {@code {object}} in ODCS 3.1.0
 * documents and {@code ${object}} in many others; OpenMetadata runs the query as written, so both are
 * replaced with real names here.
 */
final class ODCSSqlRuleBuilder {
  private static final Pattern OBJECT_PLACEHOLDER = Pattern.compile("\\$?\\{\\s*object\\s*}");
  private static final Pattern PROPERTY_PLACEHOLDER = Pattern.compile("\\$?\\{\\s*property\\s*}");
  private static final Pattern GROUP_BY =
      Pattern.compile("\\bgroup\\s+by\\b", Pattern.CASE_INSENSITIVE);
  private static final Pattern INNERMOST_PARENTHESES = Pattern.compile("\\([^()]*\\)");

  private ODCSSqlRuleBuilder() {}

  static ODCSRuleOutcome build(RuleOnTarget ruleOnTarget) {
    ODCSQualityRule rule = ruleOnTarget.rule();
    Optional<Comparison> comparison =
        ODCSRuleOperators.singleComparison(rule)
            .filter(candidate -> ODCSRuleOperators.isWhole(candidate.value()));
    ODCSRuleOutcome outcome;
    if (nullOrEmpty(rule.getQuery())) {
      outcome = ODCSTestCaseBuilder.unsupported(rule, "The SQL rule has no query.");
    } else if (usesPropertyWithoutColumn(ruleOnTarget)) {
      outcome =
          ODCSTestCaseBuilder.unsupported(
              rule, "The query refers to {property} but the rule is not attached to a column.");
    } else if (comparison.isEmpty()) {
      outcome = unsupportedComparison(rule);
    } else {
      outcome =
          ODCSTestCaseBuilder.testCase(
              ruleOnTarget,
              TABLE_CUSTOM_SQL_QUERY,
              ruleOnTarget.target().tableLink(),
              parameters(resolvePlaceholders(ruleOnTarget), comparison.get()));
    }
    return outcome;
  }

  /**
   * Whether the outer query groups its rows. A GROUP BY in a subquery or CTE does not count: {@code
   * SELECT COUNT(*) FROM (SELECT id ... GROUP BY id HAVING COUNT(*) > 1) d} still returns one value.
   */
  static boolean groupsRows(String query) {
    return GROUP_BY.matcher(withoutParenthesizedParts(query)).find();
  }

  /**
   * An ODCS SQL rule compares the value its query returns. A grouped query returns one row per
   * offending group instead, so for those OpenMetadata counts the rows.
   */
  private static List<TestCaseParameterValue> parameters(String query, Comparison comparison) {
    String strategy = groupsRows(query) ? ROWS_STRATEGY : COUNT_STRATEGY;
    return List.of(
        parameter(SQL_EXPRESSION, query),
        parameter(STRATEGY, strategy),
        parameter(OPERATOR, comparison.operator()),
        parameter(THRESHOLD, ODCSRuleOperators.format(comparison.value())));
  }

  private static String resolvePlaceholders(RuleOnTarget ruleOnTarget) {
    String query =
        replace(
            ruleOnTarget.rule().getQuery(), OBJECT_PLACEHOLDER, ruleOnTarget.target().sqlName());
    return ruleOnTarget.column() == null
        ? query
        : replace(
            query,
            PROPERTY_PLACEHOLDER,
            ruleOnTarget.target().sqlColumnName(ruleOnTarget.column()));
  }

  private static String withoutParenthesizedParts(String query) {
    String outer = query;
    String previous = null;
    while (!outer.equals(previous)) {
      previous = outer;
      outer = INNERMOST_PARENTHESES.matcher(outer).replaceAll(" ");
    }
    return outer;
  }

  private static String replace(String query, Pattern placeholder, String value) {
    return placeholder.matcher(query).replaceAll(Matcher.quoteReplacement(value));
  }

  private static boolean usesPropertyWithoutColumn(RuleOnTarget ruleOnTarget) {
    return ruleOnTarget.column() == null
        && PROPERTY_PLACEHOLDER.matcher(ruleOnTarget.rule().getQuery()).find();
  }

  private static ODCSRuleOutcome unsupportedComparison(ODCSQualityRule rule) {
    return ODCSTestCaseBuilder.unsupported(
        rule,
        String.format(
            "A SQL rule needs exactly one comparison of the query result with a whole number,"
                + " as OpenMetadata compares counts; this one has %s.",
            ODCSRuleOperators.describe(rule)));
  }
}
