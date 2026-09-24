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
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.api.data.RefreshFrequency;
import org.openmetadata.schema.api.tests.CreateTestCase;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSQualityRule;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSQualityRuleArguments;
import org.openmetadata.schema.tests.TestCaseParameterValue;
import org.openmetadata.service.datacontract.odcs.ODCSRuleOutcome.SlaOutcome;
import org.openmetadata.service.datacontract.odcs.ODCSRuleOutcome.TestCaseOutcome;
import org.openmetadata.service.datacontract.odcs.ODCSRuleOutcome.UnsupportedOutcome;

class ODCSQualityRuleMapperTest {

  private static final String TABLE_FQN = "snowflake.SALES.PUBLIC.orders";
  private static final ODCSTableTarget TARGET =
      new ODCSTableTarget(TABLE_FQN, List.of("id", "status", "Account Region", "updated_at"));
  private static final String TABLE_LINK = "<#E::table::" + TABLE_FQN + ">";

  @Test
  void nullValuesBecomesNotNullTestOnTheColumn() {
    CreateTestCase test =
        mapToTestCase(
            library("Status is set", ODCSQualityRule.OdcsQualityMetric.NULL_VALUES, "status")
                .withMustBe(0.0));

    assertEquals("columnValuesToBeNotNull", test.getTestDefinition());
    assertEquals(columnLink("status"), test.getEntityLink());
    assertEquals("odcs_status_is_set", test.getName());
    assertEquals("Status is set", test.getDisplayName());
    assertTrue(test.getParameterValues().isEmpty());
  }

  @Test
  void percentageToleranceBecomesPercentageThreshold() {
    CreateTestCase test =
        mapToTestCase(
            library("Few nulls", ODCSQualityRule.OdcsQualityMetric.NULL_VALUES, "status")
                .withMustBeLessOrEqualTo(5.0)
                .withUnit("percent"));

    assertEquals("5", parameter(test, "threshold"));
    assertEquals("PERCENTAGE", parameter(test, "thresholdUnit"));
  }

  @Test
  void strictLessThanOnRowsToleratesOneFewerFailure() {
    CreateTestCase test =
        mapToTestCase(
            library("Few nulls", ODCSQualityRule.OdcsQualityMetric.NULL_VALUES, "status")
                .withMustBeLessThan(10.0)
                .withUnit("rows"));

    assertEquals("9", parameter(test, "threshold"));
    assertNull(parameter(test, "thresholdUnit"));
  }

  @Test
  void legacyNullCountRuleIsTreatedAsNullValues() {
    CreateTestCase test =
        mapToTestCase(legacy("Territory ID not null", "nullCount", "id").withMustBe(0.0));

    assertEquals("columnValuesToBeNotNull", test.getTestDefinition());
  }

  @Test
  void completenessUsesNotNullWithTheComplementAsPercentageThreshold() {
    CreateTestCase test =
        mapToTestCase(
            legacy("Account director completeness", "notNull", "status")
                .withMustBeGreaterOrEqualTo(95.0)
                .withUnit("percent"));

    assertEquals("columnValuesToBeNotNull", test.getTestDefinition());
    assertEquals("5", parameter(test, "threshold"));
    assertEquals("PERCENTAGE", parameter(test, "thresholdUnit"));
  }

  @Test
  void completenessMetricOfOneHundredPercentToleratesNoNulls() {
    CreateTestCase test =
        mapToTestCase(
            library("Always set", ODCSQualityRule.OdcsQualityMetric.COMPLETENESS, "status")
                .withMustBe(100.0)
                .withUnit("percent"));

    assertNull(parameter(test, "threshold"));
  }

  @Test
  void invalidValuesWithValidValuesArgumentBecomesStrictInSetTest() {
    CreateTestCase test =
        mapToTestCase(
            library("Known status", ODCSQualityRule.OdcsQualityMetric.INVALID_VALUES, "status")
                .withArguments(
                    new ODCSQualityRuleArguments().withValidValues(List.of("open", "closed")))
                .withMustBe(0.0));

    assertEquals("columnValuesToBeInSet", test.getTestDefinition());
    assertEquals("[\"open\",\"closed\"]", parameter(test, "allowedValues"));
    assertEquals("true", parameter(test, "matchEnum"));
  }

  @Test
  void legacyValidValuesRuleWithoutOperatorToleratesNoFailures() {
    CreateTestCase test =
        mapToTestCase(
            legacy("Region allowed values", "validValues", "Account Region")
                .withValidValues(List.of("Northeast", "West")));

    assertEquals("columnValuesToBeInSet", test.getTestDefinition());
    assertEquals(columnLink("Account Region"), test.getEntityLink());
    assertEquals("[\"Northeast\",\"West\"]", parameter(test, "allowedValues"));
    assertNull(parameter(test, "threshold"));
  }

  @Test
  void invalidValuesWithPatternArgumentBecomesRegexTest() {
    CreateTestCase test =
        mapToTestCase(
            library("Id format", ODCSQualityRule.OdcsQualityMetric.INVALID_VALUES, "id")
                .withArguments(new ODCSQualityRuleArguments().withPattern("^[0-9]+$"))
                .withMustBe(0.0));

    assertEquals("columnValuesToMatchRegex", test.getTestDefinition());
    assertEquals("^[0-9]+$", parameter(test, "regex"));
  }

  @Test
  void legacyRegexRuleReadsThePatternKey() {
    ODCSQualityRule rule = legacy("Id format", "regex", "id");
    rule.setAdditionalProperty("pattern", "^[A-Z]{2}$");

    CreateTestCase test = mapToTestCase(rule);

    assertEquals("columnValuesToMatchRegex", test.getTestDefinition());
    assertEquals("^[A-Z]{2}$", parameter(test, "regex"));
  }

  @Test
  void duplicateValuesBecomesUniqueTest() {
    CreateTestCase test =
        mapToTestCase(
            library("Unique id", ODCSQualityRule.OdcsQualityMetric.DUPLICATE_VALUES, "id")
                .withMustBe(0.0));

    assertEquals("columnValuesToBeUnique", test.getTestDefinition());
  }

  @Test
  void missingValuesBecomesMissingCountTestWithExtraMissingMarkers() {
    CreateTestCase test =
        mapToTestCase(
            library("No blanks", ODCSQualityRule.OdcsQualityMetric.MISSING_VALUES, "status")
                .withArguments(
                    new ODCSQualityRuleArguments()
                        .withMissingValues(Arrays.asList(null, "N/A", "")))
                .withMustBe(0.0));

    assertEquals("columnValuesMissingCount", test.getTestDefinition());
    assertEquals("0", parameter(test, "missingCountValue"));
    assertEquals("[\"N/A\",\"\"]", parameter(test, "missingValueMatch"));
  }

  @ParameterizedTest
  @ValueSource(strings = {"regex", "pattern"})
  void patternRuleWithoutAPatternIsNotRun(String ruleName) {
    ODCSRuleOutcome outcome =
        ODCSQualityRuleMapper.map(
                List.of(
                    new ODCSQualityRule()
                        .withName("Codes")
                        .withRule(ruleName)
                        .withColumn("status")
                        .withMustBe(0.0)),
                TARGET)
            .getFirst();

    UnsupportedOutcome unsupported = assertInstanceOf(UnsupportedOutcome.class, outcome);
    assertEquals(
        String.format("A '%s' rule needs a pattern argument.", ruleName), unsupported.reason());
  }

  @Test
  void validValuesRuleWithoutValuesIsNotRun() {
    ODCSRuleOutcome outcome =
        ODCSQualityRuleMapper.map(
                List.of(
                    new ODCSQualityRule()
                        .withName("Known status")
                        .withRule("validValues")
                        .withColumn("status")),
                TARGET)
            .getFirst();

    UnsupportedOutcome unsupported = assertInstanceOf(UnsupportedOutcome.class, outcome);
    assertEquals("A 'validValues' rule needs a validValues argument.", unsupported.reason());
  }

  /** Whatever a document leaves out, mapping a rule reports it instead of failing the import. */
  @ParameterizedTest
  @ValueSource(
      strings = {
        "nullValues",
        "nullCount",
        "notNull",
        "completeness",
        "validValues",
        "invalidValues",
        "regex",
        "pattern",
        "duplicateValues",
        "duplicateCount",
        "missingValues",
        "missingCount",
        "textLength",
        "valuesBetween",
        "rowCount",
        "freshness",
        "somethingElse"
      })
  void everyRuleNameMapsWithoutArgumentsOrComparisons(String ruleName) {
    List<ODCSRuleOutcome> outcomes =
        ODCSQualityRuleMapper.map(
            List.of(
                new ODCSQualityRule().withName("On a column").withRule(ruleName).withColumn("id"),
                new ODCSQualityRule().withName("On the table").withRule(ruleName)),
            TARGET);

    assertEquals(2, outcomes.size());
  }

  @Test
  void rowCountBetweenBecomesTableRowCountTestOnTheTable() {
    CreateTestCase test =
        mapToTestCase(
            library("Row count range", ODCSQualityRule.OdcsQualityMetric.ROW_COUNT, "orders")
                .withMustBeBetween(List.of(1.0, 50000000.0)));

    assertEquals("tableRowCountToBeBetween", test.getTestDefinition());
    assertEquals(TABLE_LINK, test.getEntityLink());
    assertEquals("1", parameter(test, "minValue"));
    assertEquals("50000000", parameter(test, "maxValue"));
  }

  @Test
  void rowCountGreaterThanBecomesInclusiveMinimum() {
    CreateTestCase test =
        mapToTestCase(
            library("Not empty", ODCSQualityRule.OdcsQualityMetric.ROW_COUNT, null)
                .withMustBeGreaterThan(0.0));

    assertEquals("1", parameter(test, "minValue"));
    assertNull(parameter(test, "maxValue"));
  }

  @Test
  void exactRowCountBecomesRowCountToEqual() {
    CreateTestCase test =
        mapToTestCase(
            library("Exactly 100", ODCSQualityRule.OdcsQualityMetric.ROW_COUNT, null)
                .withMustBe(100.0));

    assertEquals("tableRowCountToEqual", test.getTestDefinition());
    assertEquals("100", parameter(test, "value"));
  }

  @Test
  void legacyTextLengthBecomesValueLengthsTest() {
    CreateTestCase test =
        mapToTestCase(
            legacy("Short status", "textLength", "status").withMustBeLessOrEqualTo(500.0));

    assertEquals("columnValueLengthsToBeBetween", test.getTestDefinition());
    assertEquals("500", parameter(test, "maxLength"));
    assertNull(parameter(test, "minLength"));
  }

  @Test
  void legacyValuesBetweenBecomesValuesToBeBetweenTest() {
    CreateTestCase test =
        mapToTestCase(
            legacy("Factor range", "valuesBetween", "id").withMustBeBetween(List.of(0.0, 0.5)));

    assertEquals("columnValuesToBeBetween", test.getTestDefinition());
    assertEquals("0", parameter(test, "minValue"));
    assertEquals("0.5", parameter(test, "maxValue"));
  }

  @Test
  void sqlRuleBecomesCustomSqlTestWithPlaceholdersResolved() {
    CreateTestCase test =
        mapToTestCase(
            sql("No orphan orders", "SELECT COUNT(*) FROM ${object} WHERE status IS NULL", "orders")
                .withMustBe(0.0));

    assertEquals("tableCustomSQLQuery", test.getTestDefinition());
    assertEquals(TABLE_LINK, test.getEntityLink());
    assertEquals(
        "SELECT COUNT(*) FROM SALES.PUBLIC.orders WHERE status IS NULL",
        parameter(test, "sqlExpression"));
    assertEquals("COUNT", parameter(test, "strategy"));
    assertEquals("==", parameter(test, "operator"));
    assertEquals("0", parameter(test, "threshold"));
  }

  @Test
  void propertyLevelSqlRuleResolvesThePropertyPlaceholder() {
    CreateTestCase test =
        mapToTestCase(
            sql(
                    "Not in the future",
                    "SELECT COUNT(*) FROM {object} WHERE {property} > CURRENT_DATE()",
                    "updated_at")
                .withMustBeLessOrEqualTo(3.0));

    assertEquals(
        "SELECT COUNT(*) FROM SALES.PUBLIC.orders WHERE updated_at > CURRENT_DATE()",
        parameter(test, "sqlExpression"));
    assertEquals("<=", parameter(test, "operator"));
    assertEquals("3", parameter(test, "threshold"));
  }

  @Test
  void groupedSqlRuleCountsReturnedRows() {
    CreateTestCase test =
        mapToTestCase(
            sql(
                    "No duplicates",
                    "SELECT id, COUNT(*) FROM ${object} GROUP BY 1 HAVING COUNT(*) > 1",
                    null)
                .withMustBe(0.0));

    assertEquals("ROWS", parameter(test, "strategy"));
  }

  @Test
  void sqlRuleWithBetweenComparisonIsNotExecutable() {
    UnsupportedOutcome outcome =
        mapToUnsupported(
            sql("Range", "SELECT COUNT(*) FROM ${object}", null)
                .withMustBeBetween(List.of(1.0, 5.0)));

    assertTrue(outcome.reason().contains("mustBeBetween"));
  }

  @Test
  void textRuleIsNotExecutable() {
    UnsupportedOutcome outcome =
        mapToUnsupported(
            new ODCSQualityRule().withType(ODCSQualityRule.Type.TEXT).withName("Steward review"));

    assertTrue(outcome.reason().contains("text"));
  }

  @Test
  void customRuleForAnotherEngineIsNotExecutable() {
    UnsupportedOutcome outcome =
        mapToUnsupported(
            new ODCSQualityRule()
                .withType(ODCSQualityRule.Type.CUSTOM)
                .withName("GX check")
                .withEngine("greatExpectations")
                .withImplementation("type: expect_column_values_to_not_be_null"));

    assertTrue(outcome.reason().contains("greatExpectations"));
  }

  @Test
  void ruleOnAColumnTheTableDoesNotHaveIsNotExecutable() {
    UnsupportedOutcome outcome =
        mapToUnsupported(
            library("Ghost", ODCSQualityRule.OdcsQualityMetric.NULL_VALUES, "ghost")
                .withMustBe(0.0));

    assertTrue(outcome.reason().contains("ghost"));
  }

  @Test
  void toleranceOtherThanZeroOrAnUpperBoundIsNotExecutable() {
    UnsupportedOutcome outcome =
        mapToUnsupported(
            library("Exactly three nulls", ODCSQualityRule.OdcsQualityMetric.NULL_VALUES, "status")
                .withMustBe(3.0));

    assertTrue(outcome.reason().contains("mustBe"));
  }

  @Test
  void freshnessBecomesTheContractRefreshFrequency() {
    ODCSRuleOutcome outcome =
        ODCSQualityRuleMapper.map(
                List.of(
                    library("Fresh", ODCSQualityRule.OdcsQualityMetric.FRESHNESS, "updated_at")
                        .withMustBeLessOrEqualTo(24.0)
                        .withUnit("hours")),
                TARGET)
            .getFirst();

    SlaOutcome sla = assertInstanceOf(SlaOutcome.class, outcome);
    assertEquals(24, sla.refreshFrequency().getInterval());
    assertEquals(RefreshFrequency.Unit.HOUR, sla.refreshFrequency().getUnit());
    assertEquals(TABLE_FQN + ".updated_at", sla.columnName());
  }

  @Test
  void freshnessInMinutesCannotBeExpressedAsARefreshFrequency() {
    UnsupportedOutcome outcome =
        mapToUnsupported(
            library("Fresh", ODCSQualityRule.OdcsQualityMetric.FRESHNESS, "updated_at")
                .withMustBeLessOrEqualTo(30.0)
                .withUnit("minutes"));

    assertTrue(outcome.reason().contains("minute"));
  }

  @Test
  void ruleIdBecomesTheTestCaseName() {
    CreateTestCase test =
        mapToTestCase(
            library("Status is set", ODCSQualityRule.OdcsQualityMetric.NULL_VALUES, "status")
                .withId("status_not_null")
                .withMustBe(0.0));

    assertEquals("status_not_null", test.getName());
  }

  @Test
  void rulesSharingANameOnTheSameColumnGetDistinctTestCaseNames() {
    List<ODCSRuleOutcome> outcomes =
        ODCSQualityRuleMapper.map(
            List.of(
                library("Check", ODCSQualityRule.OdcsQualityMetric.NULL_VALUES, "status")
                    .withMustBe(0.0),
                library("Check", ODCSQualityRule.OdcsQualityMetric.DUPLICATE_VALUES, "status")
                    .withMustBe(0.0),
                library("Check", ODCSQualityRule.OdcsQualityMetric.NULL_VALUES, "id")
                    .withMustBe(0.0)),
            TARGET);

    assertEquals("odcs_check", testCaseOf(outcomes.get(0)).getName());
    assertEquals("odcs_check_2", testCaseOf(outcomes.get(1)).getName());
    assertEquals("odcs_check", testCaseOf(outcomes.get(2)).getName());
  }

  @Test
  void ruleDescriptionAndBusinessImpactBecomeTheTestDescription() {
    CreateTestCase test =
        mapToTestCase(
            library("Status is set", ODCSQualityRule.OdcsQualityMetric.NULL_VALUES, "status")
                .withDescription("Every order has a status.")
                .withBusinessImpact("Unrouted orders.")
                .withMustBe(0.0));

    assertEquals(
        "Every order has a status.\n\n**Business impact:** Unrouted orders.",
        test.getDescription());
  }

  @Test
  void openMetadataEngineRuleRecreatesTheOriginalTestCase() {
    ODCSQualityRule rule =
        new ODCSQualityRule()
            .withType(ODCSQualityRule.Type.CUSTOM)
            .withName("Amount range")
            .withEngine("openmetadata")
            .withColumn("id")
            .withImplementation(
                "{\"name\":\"amount_range\",\"testDefinition\":\"columnValueMaxToBeBetween\","
                    + "\"parameterValues\":[{\"name\":\"maxValueForMaxInCol\",\"value\":\"10\"}]}");

    CreateTestCase test = mapToTestCase(rule);

    assertEquals("amount_range", test.getName());
    assertEquals("columnValueMaxToBeBetween", test.getTestDefinition());
    assertEquals(columnLink("id"), test.getEntityLink());
    assertEquals("10", parameter(test, "maxValueForMaxInCol"));
  }

  @Test
  void openMetadataEngineRuleWithUnreadableImplementationIsNotExecutable() {
    UnsupportedOutcome outcome =
        mapToUnsupported(
            new ODCSQualityRule()
                .withType(ODCSQualityRule.Type.CUSTOM)
                .withName("Broken")
                .withEngine("openmetadata")
                .withImplementation("not json"));

    assertTrue(outcome.reason().contains("implementation"));
  }

  @Test
  void ruleWithoutAMetricIsNotExecutable() {
    UnsupportedOutcome outcome =
        mapToUnsupported(new ODCSQualityRule().withName("Nothing").withColumn("id"));

    assertTrue(outcome.reason().contains("no metric"));
  }

  @Test
  void metricWithoutAnOpenMetadataEquivalentIsNotExecutable() {
    UnsupportedOutcome outcome =
        mapToUnsupported(
            library("Distinct ids", ODCSQualityRule.OdcsQualityMetric.DISTINCT_VALUES, "id")
                .withMustBe(10.0));

    assertTrue(outcome.reason().contains("distinctValues"));
  }

  @Test
  void invalidValuesWithoutValidValuesOrPatternIsNotExecutable() {
    UnsupportedOutcome outcome =
        mapToUnsupported(
            library("Invalid", ODCSQualityRule.OdcsQualityMetric.INVALID_VALUES, "status")
                .withMustBe(0.0));

    assertTrue(outcome.reason().contains("validValues or a pattern"));
  }

  @Test
  void customRuleWithoutAnEngineIsNotExecutable() {
    UnsupportedOutcome outcome =
        mapToUnsupported(
            new ODCSQualityRule().withType(ODCSQualityRule.Type.CUSTOM).withName("Custom"));

    assertTrue(outcome.reason().contains("unspecified"));
  }

  private static CreateTestCase mapToTestCase(ODCSQualityRule rule) {
    return testCaseOf(ODCSQualityRuleMapper.map(List.of(rule), TARGET).getFirst());
  }

  private static CreateTestCase testCaseOf(ODCSRuleOutcome outcome) {
    return assertInstanceOf(TestCaseOutcome.class, outcome).testCase();
  }

  private static UnsupportedOutcome mapToUnsupported(ODCSQualityRule rule) {
    return assertInstanceOf(
        UnsupportedOutcome.class, ODCSQualityRuleMapper.map(List.of(rule), TARGET).getFirst());
  }

  private static ODCSQualityRule library(
      String name, ODCSQualityRule.OdcsQualityMetric metric, String column) {
    return new ODCSQualityRule()
        .withType(ODCSQualityRule.Type.LIBRARY)
        .withName(name)
        .withMetric(metric)
        .withColumn(column);
  }

  private static ODCSQualityRule legacy(String name, String rule, String column) {
    return new ODCSQualityRule()
        .withType(ODCSQualityRule.Type.LIBRARY)
        .withName(name)
        .withRule(rule)
        .withColumn(column);
  }

  private static ODCSQualityRule sql(String name, String query, String column) {
    return new ODCSQualityRule()
        .withType(ODCSQualityRule.Type.SQL)
        .withName(name)
        .withQuery(query)
        .withColumn(column);
  }

  private static String columnLink(String column) {
    return "<#E::table::" + TABLE_FQN + "::columns::" + column + ">";
  }

  private static String parameter(CreateTestCase test, String name) {
    return test.getParameterValues().stream()
        .filter(parameter -> name.equals(parameter.getName()))
        .map(TestCaseParameterValue::getValue)
        .findFirst()
        .orElse(null);
  }
}
