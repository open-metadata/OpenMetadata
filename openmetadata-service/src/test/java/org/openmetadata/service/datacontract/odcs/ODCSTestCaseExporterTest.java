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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.schema.api.tests.CreateTestCase;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSQualityRule;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestCaseParameterValue;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.datacontract.odcs.ODCSRuleOutcome.TestCaseOutcome;

class ODCSTestCaseExporterTest {

  private static final String TABLE_FQN = "snowflake.SALES.PUBLIC.orders";
  private static final ODCSTableTarget TARGET =
      new ODCSTableTarget(TABLE_FQN, List.of("id", "status", "amount"));
  private static final String TABLE_ANCHOR = "orders";

  @Test
  void notNullTestBecomesNullValuesRuleOnItsColumn() {
    ODCSQualityRule rule =
        ODCSTestCaseExporter.toRule(
            columnTest("status_not_null", "status", "columnValuesToBeNotNull"), TABLE_ANCHOR);

    assertEquals(ODCSQualityRule.OdcsQualityMetric.NULL_VALUES, rule.getMetric());
    assertEquals("status", rule.getColumn());
    assertEquals("status_not_null", rule.getId());
    assertEquals(0.0, rule.getMustBe());
  }

  @Test
  void percentageThresholdBecomesUpperBoundInPercent() {
    ODCSQualityRule rule =
        ODCSTestCaseExporter.toRule(
            columnTest(
                "few_nulls",
                "status",
                "columnValuesToBeNotNull",
                parameter("threshold", "5"),
                parameter("thresholdUnit", "PERCENTAGE")),
            TABLE_ANCHOR);

    assertNull(rule.getMustBe());
    assertEquals(5.0, rule.getMustBeLessOrEqualTo());
    assertEquals("percent", rule.getUnit());
  }

  @Test
  void strictInSetTestBecomesInvalidValuesWithValidValues() {
    ODCSQualityRule rule =
        ODCSTestCaseExporter.toRule(
            columnTest(
                "known_status",
                "status",
                "columnValuesToBeInSet",
                parameter("allowedValues", "[\"open\",\"closed\"]"),
                parameter("matchEnum", "true")),
            TABLE_ANCHOR);

    assertEquals(ODCSQualityRule.OdcsQualityMetric.INVALID_VALUES, rule.getMetric());
    assertEquals(List.of("open", "closed"), rule.getArguments().getValidValues());
  }

  @Test
  void lenientInSetTestHasNoOdcsMetricSoItTravelsAsAnOpenMetadataRule() {
    ODCSQualityRule rule =
        ODCSTestCaseExporter.toRule(
            columnTest(
                "any_known_status",
                "status",
                "columnValuesToBeInSet",
                parameter("allowedValues", "[\"open\"]")),
            TABLE_ANCHOR);

    assertEquals(ODCSQualityRule.Type.CUSTOM, rule.getType());
    assertEquals("openmetadata", rule.getEngine());
  }

  @Test
  void rowCountBetweenTestBecomesRowCountRuleOnTheTable() {
    ODCSQualityRule rule =
        ODCSTestCaseExporter.toRule(
            tableTest(
                "row_count",
                "tableRowCountToBeBetween",
                parameter("minValue", "1"),
                parameter("maxValue", "10")),
            TABLE_ANCHOR);

    assertEquals(ODCSQualityRule.OdcsQualityMetric.ROW_COUNT, rule.getMetric());
    assertEquals(TABLE_ANCHOR, rule.getColumn());
    assertEquals(List.of(1.0, 10.0), rule.getMustBeBetween());
  }

  @Test
  void countingSqlTestBecomesSqlRule() {
    ODCSQualityRule rule =
        ODCSTestCaseExporter.toRule(
            tableTest(
                "no_orphans",
                "tableCustomSQLQuery",
                parameter("sqlExpression", "SELECT COUNT(*) FROM SALES.PUBLIC.orders"),
                parameter("strategy", "COUNT"),
                parameter("operator", ">="),
                parameter("threshold", "3")),
            TABLE_ANCHOR);

    assertEquals(ODCSQualityRule.Type.SQL, rule.getType());
    assertEquals("SELECT COUNT(*) FROM SALES.PUBLIC.orders", rule.getQuery());
    assertEquals(3.0, rule.getMustBeGreaterOrEqualTo());
  }

  @Test
  void countingSqlTestWhoseQueryGroupsRowsStaysAnOpenMetadataRule() {
    ODCSQualityRule rule =
        ODCSTestCaseExporter.toRule(
            tableTest(
                "first_group_count",
                "tableCustomSQLQuery",
                parameter(
                    "sqlExpression", "SELECT COUNT(*) FROM SALES.PUBLIC.orders GROUP BY status"),
                parameter("strategy", "COUNT"),
                parameter("threshold", "10")),
            TABLE_ANCHOR);

    assertEquals(ODCSQualityRule.Type.CUSTOM, rule.getType());
    assertEquals("openmetadata", rule.getEngine());
  }

  @Test
  void nameThatIsNotAValidOdcsIdIsNotUsedAsId() {
    ODCSQualityRule rule =
        ODCSTestCaseExporter.toRule(
            columnTest("status not null", "status", "columnValuesToBeNotNull"), TABLE_ANCHOR);

    assertNull(rule.getId());
    assertEquals("status not null", rule.getName());
  }

  @ParameterizedTest
  @MethodSource("roundTripCases")
  void exportedRuleImportsBackAsTheSameTestCase(TestCase original) {
    ODCSQualityRule rule = ODCSTestCaseExporter.toRule(original, TABLE_ANCHOR);

    CreateTestCase reimported =
        assertInstanceOf(
                TestCaseOutcome.class, ODCSQualityRuleMapper.map(List.of(rule), TARGET).getFirst())
            .testCase();

    assertEquals(original.getName(), reimported.getName());
    assertEquals(original.getEntityLink(), reimported.getEntityLink());
    assertEquals(
        original.getTestDefinition().getFullyQualifiedName(), reimported.getTestDefinition());
    assertEquals(
        parameters(original.getParameterValues()), parameters(reimported.getParameterValues()));
  }

  static List<TestCase> roundTripCases() {
    return List.of(
        columnTest("status_not_null", "status", "columnValuesToBeNotNull"),
        columnTest(
            "few_nulls",
            "status",
            "columnValuesToBeNotNull",
            parameter("threshold", "5"),
            parameter("thresholdUnit", "PERCENTAGE")),
        columnTest("unique_id", "id", "columnValuesToBeUnique", parameter("threshold", "2")),
        columnTest(
            "known_status",
            "status",
            "columnValuesToBeInSet",
            parameter("allowedValues", "[\"open\",\"closed\"]"),
            parameter("matchEnum", "true")),
        columnTest("id_format", "id", "columnValuesToMatchRegex", parameter("regex", "^[0-9]+$")),
        columnTest(
            "no_blanks",
            "status",
            "columnValuesMissingCount",
            parameter("missingCountValue", "0"),
            parameter("missingValueMatch", "[\"N/A\"]")),
        tableTest(
            "row_count",
            "tableRowCountToBeBetween",
            parameter("minValue", "1"),
            parameter("maxValue", "10")),
        tableTest("exact_rows", "tableRowCountToEqual", parameter("value", "100")),
        tableTest(
            "no_orphans",
            "tableCustomSQLQuery",
            parameter("sqlExpression", "SELECT COUNT(*) FROM SALES.PUBLIC.orders"),
            parameter("strategy", "COUNT"),
            parameter("operator", "=="),
            parameter("threshold", "0")),
        tableTest(
            "grouped_rows",
            "tableCustomSQLQuery",
            parameter("sqlExpression", "SELECT id FROM SALES.PUBLIC.orders"),
            parameter("strategy", "ROWS")),
        tableTest(
            "counted_duplicates",
            "tableCustomSQLQuery",
            parameter(
                "sqlExpression",
                "SELECT COUNT(*) FROM (SELECT id FROM SALES.PUBLIC.orders GROUP BY id"
                    + " HAVING COUNT(*) > 1) dups"),
            parameter("strategy", "COUNT"),
            parameter("operator", "=="),
            parameter("threshold", "0")),
        tableTest(
            "first_group_count",
            "tableCustomSQLQuery",
            parameter("sqlExpression", "SELECT COUNT(*) FROM SALES.PUBLIC.orders GROUP BY status"),
            parameter("strategy", "COUNT"),
            parameter("operator", "<="),
            parameter("threshold", "10")),
        tableTest(
            "fractional_threshold",
            "tableCustomSQLQuery",
            parameter("sqlExpression", "SELECT COUNT(*) FROM SALES.PUBLIC.orders"),
            parameter("strategy", "COUNT"),
            parameter("operator", "<"),
            parameter("threshold", "0.5")),
        columnTest(
            "amount_range",
            "amount",
            "columnValuesToBeBetween",
            parameter("minValue", "0"),
            parameter("maxValue", "10")),
        tableTest("column_count", "tableColumnCountToEqual", parameter("columnCount", "3")));
  }

  private static TestCase columnTest(
      String name, String column, String definition, TestCaseParameterValue... parameters) {
    return testCase(
        name, "<#E::table::" + TABLE_FQN + "::columns::" + column + ">", definition, parameters);
  }

  private static TestCase tableTest(
      String name, String definition, TestCaseParameterValue... parameters) {
    return testCase(name, "<#E::table::" + TABLE_FQN + ">", definition, parameters);
  }

  private static TestCase testCase(
      String name, String entityLink, String definition, TestCaseParameterValue... parameters) {
    return new TestCase()
        .withName(name)
        .withEntityLink(entityLink)
        .withTestDefinition(
            new EntityReference().withType("testDefinition").withFullyQualifiedName(definition))
        .withParameterValues(List.of(parameters));
  }

  private static TestCaseParameterValue parameter(String name, String value) {
    return new TestCaseParameterValue().withName(name).withValue(value);
  }

  private static Map<String, String> parameters(List<TestCaseParameterValue> values) {
    return values.stream()
        .collect(
            Collectors.toMap(TestCaseParameterValue::getName, TestCaseParameterValue::getValue));
  }
}
