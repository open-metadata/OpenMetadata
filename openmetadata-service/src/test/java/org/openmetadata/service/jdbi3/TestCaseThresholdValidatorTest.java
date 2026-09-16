package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.tests.TestCaseParameter;
import org.openmetadata.schema.tests.TestDefinition;
import org.openmetadata.schema.type.TestCaseParameterDataType;

class TestCaseThresholdValidatorTest {

  /** A row-countable test: its validator reports a passed/failed row count. */
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
}
