package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.tests.TestCaseParameter;
import org.openmetadata.schema.tests.TestDefinition;
import org.openmetadata.schema.type.TestCaseParameterDataType;
import org.openmetadata.schema.utils.JsonUtils;

class TestCaseThresholdValidatorTest {

  /** A row-countable test: the percentage is a share of the rows the validator counts. */
  private static TestDefinition columnValuesToBeNotNull() {
    return new TestDefinition()
        .withName("columnValuesToBeNotNull")
        .withSupportsRowLevelPassedFailed(true)
        .withParameterDefinition(List.of(threshold(), thresholdUnit()));
  }

  /** A statistical test: the threshold is a deviation from the mean's bounds. */
  private static TestDefinition columnValueMeanToBeBetween() {
    return new TestDefinition()
        .withName("columnValueMeanToBeBetween")
        .withSupportsRowLevelPassedFailed(false)
        .withParameterDefinition(
            List.of(
                numeric("minValueForMeanInCol"),
                numeric("maxValueForMeanInCol"),
                threshold(),
                thresholdUnit()));
  }

  private static TestDefinition columnValuesToBeInSet() {
    return new TestDefinition()
        .withName("columnValuesToBeInSet")
        .withSupportsRowLevelPassedFailed(true)
        .withParameterDefinition(
            List.of(
                new TestCaseParameter()
                    .withName("allowedValues")
                    .withDataType(TestCaseParameterDataType.ARRAY),
                new TestCaseParameter()
                    .withName("matchEnum")
                    .withDataType(TestCaseParameterDataType.BOOLEAN),
                threshold(),
                thresholdUnit()));
  }

  private static TestCaseParameter threshold() {
    return numeric("threshold");
  }

  private static TestCaseParameter thresholdUnit() {
    return new TestCaseParameter()
        .withName("thresholdUnit")
        .withDataType(TestCaseParameterDataType.STRING);
  }

  private static TestCaseParameter numeric(String name) {
    return new TestCaseParameter().withName(name).withDataType(TestCaseParameterDataType.NUMBER);
  }

  private static Map<String, Object> values(String... nameValuePairs) {
    Map<String, Object> values = new LinkedHashMap<>();
    for (int i = 0; i < nameValuePairs.length; i += 2) {
      values.put(nameValuePairs[i], nameValuePairs[i + 1]);
    }
    return values;
  }

  private static String rejects(TestDefinition definition, Map<String, Object> values) {
    return assertThrows(
            IllegalArgumentException.class,
            () -> TestCaseThresholdValidator.validate(definition, values))
        .getMessage();
  }

  @Test
  void rejectsANegativeThreshold() {
    String message = rejects(columnValuesToBeNotNull(), values("threshold", "-1"));
    assertTrue(message.contains("must not be negative"), message);

    // Statistical tests read the threshold differently but a negative tolerance is nonsense there
    // too.
    assertTrue(
        rejects(
                columnValueMeanToBeBetween(),
                values("threshold", "-0.5", "thresholdUnit", "PERCENTAGE"))
            .contains("must not be negative"));
  }

  @Test
  void acceptsANonNegativeThreshold() {
    assertEquals(
        List.of(),
        TestCaseThresholdValidator.validate(columnValuesToBeNotNull(), values("threshold", "0")));
    assertEquals(
        List.of(),
        TestCaseThresholdValidator.validate(
            columnValuesToBeNotNull(), values("threshold", "5", "thresholdUnit", "ABSOLUTE")));
  }

  @Test
  void rejectsAThresholdThatIsNotANumber() {
    String message = rejects(columnValuesToBeNotNull(), values("threshold", "a few"));
    assertTrue(message.contains("must be a number"), message);
  }

  @Test
  void rejectsAPercentageAbove100ForARowCountableTest() {
    String message =
        rejects(
            columnValuesToBeNotNull(), values("threshold", "150", "thresholdUnit", "PERCENTAGE"));
    assertTrue(message.contains("cannot exceed 100"), message);
  }

  @Test
  void acceptsAPercentageUpTo100ForARowCountableTest() {
    assertEquals(
        List.of(),
        TestCaseThresholdValidator.validate(
            columnValuesToBeNotNull(), values("threshold", "100", "thresholdUnit", "PERCENTAGE")));
  }

  @Test
  void acceptsAnAbsoluteThresholdAbove100ForARowCountableTest() {
    // 150 failing rows out of a million is a perfectly ordinary tolerance — only the percentage is
    // capped.
    assertEquals(
        List.of(),
        TestCaseThresholdValidator.validate(
            columnValuesToBeNotNull(), values("threshold", "150", "thresholdUnit", "ABSOLUTE")));
  }

  @Test
  void acceptsAPercentageAbove100ForAStatisticalTest() {
    // "Tolerate the mean being up to 200% off" is loose, but it is not incoherent.
    assertEquals(
        List.of(),
        TestCaseThresholdValidator.validate(
            columnValueMeanToBeBetween(),
            values(
                "minValueForMeanInCol",
                "10",
                "maxValueForMeanInCol",
                "20",
                "threshold",
                "200",
                "thresholdUnit",
                "PERCENTAGE")));
  }

  @Test
  void rejectsAThresholdOnColumnValuesToBeInSetWhenMatchEnumIsOff() {
    String explicitlyFalse =
        rejects(
            columnValuesToBeInSet(),
            values("allowedValues", "[1,2]", "matchEnum", "false", "threshold", "10"));
    assertTrue(explicitlyFalse.contains("matchEnum"), explicitlyFalse);

    // Omitting matchEnum means the same "any value in the set passes" branch.
    assertTrue(
        rejects(columnValuesToBeInSet(), values("allowedValues", "[1,2]", "threshold", "10"))
            .contains("matchEnum"));
  }

  @Test
  void acceptsAThresholdOnColumnValuesToBeInSetWhenMatchEnumIsOn() {
    assertEquals(
        List.of(),
        TestCaseThresholdValidator.validate(
            columnValuesToBeInSet(),
            values("allowedValues", "[1,2]", "matchEnum", "true", "threshold", "10")));

    // A threshold of 0 is the default no-tolerance behaviour, so it stays valid in either mode.
    assertEquals(
        List.of(),
        TestCaseThresholdValidator.validate(
            columnValuesToBeInSet(),
            values("allowedValues", "[1,2]", "matchEnum", "false", "threshold", "0")));
  }

  @Test
  void warnsRatherThanRejectsOnAPercentageAgainstABoundOfZero() {
    List<String> warnings =
        TestCaseThresholdValidator.validate(
            columnValueMeanToBeBetween(),
            values(
                "minValueForMeanInCol",
                "0",
                "maxValueForMeanInCol",
                "20",
                "threshold",
                "10",
                "thresholdUnit",
                "PERCENTAGE"));
    assertEquals(1, warnings.size(), warnings.toString());
    assertTrue(warnings.get(0).contains("minValueForMeanInCol"), warnings.get(0));
    assertTrue(warnings.get(0).contains("evaluates to 0"), warnings.get(0));
  }

  @Test
  void doesNotWarnWhenTheBoundsAreNonZero() {
    assertEquals(
        List.of(),
        TestCaseThresholdValidator.validate(
            columnValueMeanToBeBetween(),
            values(
                "minValueForMeanInCol",
                "10",
                "maxValueForMeanInCol",
                "20",
                "threshold",
                "10",
                "thresholdUnit",
                "PERCENTAGE")));
  }

  @Test
  void doesNotWarnOnAZeroBoundWhenTheThresholdIsAbsolute() {
    assertEquals(
        List.of(),
        TestCaseThresholdValidator.validate(
            columnValueMeanToBeBetween(),
            values("minValueForMeanInCol", "0", "threshold", "10", "thresholdUnit", "ABSOLUTE")));
  }

  @Test
  void leavesTestDefinitionsWithoutAThresholdUnitAlone() {
    // `tableDiff` has carried its own unrelated `threshold` since long before failure thresholds
    // existed, and so may any custom test definition.
    TestDefinition tableDiff =
        new TestDefinition()
            .withName("tableDiff")
            .withParameterDefinition(List.of(numeric("threshold")));
    assertEquals(
        List.of(), TestCaseThresholdValidator.validate(tableDiff, values("threshold", "-1")));
  }

  @Test
  void ignoresAnAbsentOrBlankThreshold() {
    assertEquals(
        List.of(),
        TestCaseThresholdValidator.validate(
            columnValuesToBeNotNull(), values("thresholdUnit", "PERCENTAGE")));
    assertEquals(
        List.of(),
        TestCaseThresholdValidator.validate(
            columnValuesToBeNotNull(), values("threshold", "  ", "thresholdUnit", "PERCENTAGE")));
  }

  // ---------------------------------------------------------------------------------------------
  // Classification is named, not inferred from `supportsRowLevelPassedFailed`
  // ---------------------------------------------------------------------------------------------

  /**
   * The percentage of `columnValuesToBeAtExpectedLocation` is a share of the evaluated rows, but the
   * definition sets `supportsRowLevelPassedFailed` to false, so keying the cap off that flag let a
   * 150% threshold through.
   */
  @Test
  void capsAPercentageOnARowCountableTestThatDoesNotSetTheRowLevelFlag() {
    TestDefinition atExpectedLocation =
        new TestDefinition()
            .withName("columnValuesToBeAtExpectedLocation")
            .withSupportsRowLevelPassedFailed(false)
            .withParameterDefinition(
                List.of(
                    new TestCaseParameter()
                        .withName("radius")
                        .withDataType(TestCaseParameterDataType.FLOAT),
                    threshold(),
                    thresholdUnit()));
    String message =
        rejects(
            atExpectedLocation,
            values("radius", "500", "threshold", "150", "thresholdUnit", "PERCENTAGE"));
    assertTrue(message.contains("cannot exceed 100"), message);
  }

  /**
   * `radius` configures the metric — it is not the value the percentage is measured against — so a
   * radius of 0 must not produce a "the tolerance evaluates to 0" warning.
   */
  @Test
  void doesNotWarnOnAZeroConfigurationParameter() {
    TestDefinition atExpectedLocation =
        new TestDefinition()
            .withName("columnValuesToBeAtExpectedLocation")
            .withSupportsRowLevelPassedFailed(false)
            .withParameterDefinition(
                List.of(
                    new TestCaseParameter()
                        .withName("radius")
                        .withDataType(TestCaseParameterDataType.FLOAT),
                    threshold(),
                    thresholdUnit()));
    assertEquals(
        List.of(),
        TestCaseThresholdValidator.validate(
            atExpectedLocation,
            values("radius", "0", "threshold", "10", "thresholdUnit", "PERCENTAGE")));
  }

  /**
   * `tableRowInsertedCountToBeBetween` widens `min`/`max` by the threshold, so only those two scale
   * the tolerance. `rangeInterval` is how far back the window reaches and says nothing about it.
   */
  @Test
  void warnsOnlyForTheParametersThePercentageIsMeasuredAgainst() {
    TestDefinition rowInsertedCount =
        new TestDefinition()
            .withName("tableRowInsertedCountToBeBetween")
            .withParameterDefinition(
                List.of(
                    numeric("min"),
                    numeric("max"),
                    numeric("rangeInterval"),
                    threshold(),
                    thresholdUnit()));
    assertEquals(
        List.of(),
        TestCaseThresholdValidator.validate(
            rowInsertedCount,
            values(
                "min",
                "10",
                "max",
                "20",
                "rangeInterval",
                "0",
                "threshold",
                "10",
                "thresholdUnit",
                "PERCENTAGE")));

    List<String> warnings =
        TestCaseThresholdValidator.validate(
            rowInsertedCount,
            values(
                "min",
                "0",
                "max",
                "20",
                "rangeInterval",
                "0",
                "threshold",
                "10",
                "thresholdUnit",
                "PERCENTAGE"));
    assertEquals(1, warnings.size(), warnings.toString());
    assertTrue(warnings.get(0).contains("'min'"), warnings.get(0));
  }

  /**
   * `tableCustomSQLQuery` declares `thresholdUnit`, but its `threshold` is the bound the SQL result
   * is compared against through `operator`, not a failure tolerance. A SQL returning a signed delta
   * compared with `>=` legitimately carries a negative one, and `validateTestParameters` runs on
   * update as well as create, so rejecting it would also break every PUT on an existing test case.
   */
  @Test
  void leavesTableCustomSqlQueryComparisonBoundsAlone() {
    TestDefinition customSql =
        new TestDefinition()
            .withName("tableCustomSQLQuery")
            .withSupportsRowLevelPassedFailed(true)
            .withParameterDefinition(
                List.of(
                    new TestCaseParameter()
                        .withName("operator")
                        .withDataType(TestCaseParameterDataType.STRING),
                    threshold(),
                    thresholdUnit()));
    assertEquals(
        List.of(),
        TestCaseThresholdValidator.validate(
            customSql, values("operator", ">=", "threshold", "-25")));
    assertEquals(
        List.of(),
        TestCaseThresholdValidator.validate(
            customSql, values("operator", ">", "threshold", "150", "thresholdUnit", "PERCENTAGE")));
  }

  // ---------------------------------------------------------------------------------------------
  // Every seeded definition that opts in to failure thresholds is classified
  // ---------------------------------------------------------------------------------------------

  /** Definitions whose percentage is a share of the evaluated rows. */
  private static final Set<String> ROW_TOLERANCE =
      Set.of(
          "columnValuesToBeNotNull",
          "columnValuesToBeUnique",
          "columnValuesToBeInSet",
          "columnValuesToBeNotInSet",
          "columnValuesToMatchRegex",
          "columnValuesToNotMatchRegex",
          "columnValuesToBeBetween",
          "columnValueLengthsToBeBetween",
          "columnValuesToBeAtExpectedLocation");

  /** Definitions whose percentage is a deviation from a bound or an expected value. */
  private static final Set<String> DEVIATION =
      Set.of(
          "columnValueMaxToBeBetween",
          "columnValueMeanToBeBetween",
          "columnValueMedianToBeBetween",
          "columnValueMinToBeBetween",
          "columnValueStdDevToBeBetween",
          "columnValuesSumToBeBetween",
          "columnValuesMissingCount",
          "tableColumnCountToBeBetween",
          "tableColumnCountToEqual",
          "tableRowCountToBeBetween",
          "tableRowCountToEqual",
          "tableRowInsertedCountToBeBetween");

  /** Definitions that declare `thresholdUnit` without their `threshold` being a tolerance. */
  private static final Set<String> NOT_A_TOLERANCE = Set.of("tableCustomSQLQuery");

  /** The definitions as they are seeded, read straight off the classpath. */
  private static List<TestDefinition> seededDefinitions() throws IOException {
    List<TestDefinition> definitions = new ArrayList<>();
    for (String resource :
        CommonUtil.getResources(Pattern.compile(".*json/data/tests/.*\\.json$"))) {
      definitions.add(
          JsonUtils.readValue(
              CommonUtil.getResourceAsStream(
                  TestCaseThresholdValidatorTest.class.getClassLoader(), resource),
              TestDefinition.class));
    }
    return definitions;
  }

  /**
   * The classification is a named list, so a newly seeded definition that opts in to failure
   * thresholds has to be placed in one of the three buckets rather than silently inheriting
   * whichever `supportsRowLevelPassedFailed` happens to say.
   */
  @Test
  void everySeededThresholdDefinitionIsClassified() throws IOException {
    Set<String> optedIn =
        seededDefinitions().stream()
            .filter(
                definition ->
                    definition.getParameterDefinition().stream()
                        .anyMatch(
                            parameter ->
                                TestCaseThresholdValidator.THRESHOLD_UNIT.equals(
                                    parameter.getName())))
            .map(TestDefinition::getName)
            .collect(Collectors.toCollection(TreeSet::new));

    Set<String> classified = new TreeSet<>(ROW_TOLERANCE);
    classified.addAll(DEVIATION);
    classified.addAll(NOT_A_TOLERANCE);

    assertEquals(classified, optedIn);
  }

  /** The seeded definitions, as shipped, land on the side of the cap this test declares. */
  @Test
  void theSeededDefinitionsAreCappedAccordingToTheirClass() throws IOException {
    for (TestDefinition definition : seededDefinitions()) {
      String name = definition.getName();
      // `matchEnum` has its own rule; satisfy it so this test only exercises the cap.
      Map<String, Object> aboveTheCap =
          values("matchEnum", "true", "threshold", "150", "thresholdUnit", "PERCENTAGE");
      if (ROW_TOLERANCE.contains(name)) {
        assertTrue(rejects(definition, aboveTheCap).contains("cannot exceed 100"), name);
      } else if (DEVIATION.contains(name) || NOT_A_TOLERANCE.contains(name)) {
        assertEquals(List.of(), TestCaseThresholdValidator.validate(definition, aboveTheCap), name);
      }
    }
  }
}
