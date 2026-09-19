package org.openmetadata.service.jdbi3;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.openmetadata.schema.tests.TestCaseParameter;
import org.openmetadata.schema.tests.TestDefinition;
import org.openmetadata.schema.type.TestCaseParameterDataType;

/**
 * Validates the failure threshold parameters — `threshold` and `thresholdUnit` — of a test case.
 *
 * <p>A PERCENTAGE threshold means two different things depending on what the test counts, so the
 * range check has to be class-aware rather than a blanket 0..100. A row-countable test — one whose
 * validator reports a passed/failed row count — spends its tolerance on rows, and more than 100% of
 * the rows cannot fail. A statistical test spends it on how far a single aggregate (a mean, a sum, a
 * row count) may drift from its bound, and "tolerate the mean being up to 200% off" is loose but
 * perfectly coherent, so it is accepted.
 */
final class TestCaseThresholdValidator {
  static final String THRESHOLD = "threshold";
  static final String THRESHOLD_UNIT = "thresholdUnit";
  static final String PERCENTAGE = "PERCENTAGE";

  private static final String COLUMN_VALUES_TO_BE_IN_SET = "columnValuesToBeInSet";
  private static final String MATCH_ENUM = "matchEnum";

  /** Parameters that configure the threshold itself, never a bound it is measured against. */
  private static final Set<String> THRESHOLD_PARAMETERS =
      Set.of(THRESHOLD, THRESHOLD_UNIT, "dimensionFailurePolicy");

  private static final Set<TestCaseParameterDataType> NUMERIC_TYPES =
      Set.of(
          TestCaseParameterDataType.NUMBER,
          TestCaseParameterDataType.INT,
          TestCaseParameterDataType.FLOAT,
          TestCaseParameterDataType.DOUBLE,
          TestCaseParameterDataType.DECIMAL);

  private TestCaseThresholdValidator() {}

  /**
   * Throws {@link IllegalArgumentException} — surfaced as a 400 — when the threshold cannot mean
   * anything for this test definition. Returns the warnings worth logging for the thresholds that
   * are accepted but degenerate.
   */
  static List<String> validate(TestDefinition testDefinition, Map<String, Object> values) {
    if (!declaresThresholdUnit(testDefinition)) {
      // `thresholdUnit` is what marks a definition as opted in to failure thresholds. Without it a
      // `threshold` parameter is the definition's own business — `tableDiff` has carried an
      // unrelated one since long before this feature, and so may any custom test definition.
      return List.of();
    }
    String rawThreshold = stringValue(values.get(THRESHOLD));
    if (rawThreshold == null) {
      return List.of();
    }
    Double threshold = numericValue(rawThreshold);
    if (threshold == null) {
      throw new IllegalArgumentException(
          String.format("Parameter '%s' must be a number, but was '%s'.", THRESHOLD, rawThreshold));
    }
    if (threshold < 0) {
      throw new IllegalArgumentException(
          String.format(
              "Parameter '%s' must not be negative, but was %s. A failure threshold is how many "
                  + "failures are tolerated before the test fails.",
              THRESHOLD, rawThreshold));
    }
    validateMatchEnum(testDefinition, values, threshold);

    if (!PERCENTAGE.equalsIgnoreCase(stringValue(values.get(THRESHOLD_UNIT)))) {
      return List.of();
    }
    if (Boolean.TRUE.equals(testDefinition.getSupportsRowLevelPassedFailed())) {
      if (threshold > 100) {
        throw new IllegalArgumentException(
            String.format(
                "Parameter '%s' is read as a percentage of the evaluated rows for test definition "
                    + "'%s' and cannot exceed 100, but was %s. Use a '%s' of ABSOLUTE to tolerate a "
                    + "raw number of failing rows.",
                THRESHOLD, testDefinition.getName(), rawThreshold, THRESHOLD_UNIT));
      }
      return List.of();
    }
    return degenerateBoundWarnings(testDefinition, values, rawThreshold);
  }

  /**
   * With `matchEnum` off the test passes as soon as a single allowed value occurs, so it never
   * produces failing rows for a tolerance to absorb.
   */
  private static void validateMatchEnum(
      TestDefinition testDefinition, Map<String, Object> values, double threshold) {
    if (threshold == 0 || !COLUMN_VALUES_TO_BE_IN_SET.equals(testDefinition.getName())) {
      return;
    }
    if (!Boolean.parseBoolean(stringValue(values.get(MATCH_ENUM)))) {
      throw new IllegalArgumentException(
          String.format(
              "Parameter '%s' is not supported on '%s' when '%s' is false: that mode passes as soon "
                  + "as any allowed value occurs, so there are no failing rows to tolerate. Set '%s' "
                  + "to true or drop the threshold.",
              THRESHOLD, COLUMN_VALUES_TO_BE_IN_SET, MATCH_ENUM, MATCH_ENUM));
    }
  }

  /**
   * A percentage of a bound of 0 is 0, so the tolerance the user asked for silently does nothing.
   * Worth saying out loud, not worth rejecting — the bound itself is legitimate.
   */
  private static List<String> degenerateBoundWarnings(
      TestDefinition testDefinition, Map<String, Object> values, String rawThreshold) {
    List<String> warnings = new ArrayList<>();
    for (TestCaseParameter parameter : listOrEmpty(testDefinition.getParameterDefinition())) {
      if (THRESHOLD_PARAMETERS.contains(parameter.getName())
          || !NUMERIC_TYPES.contains(parameter.getDataType())) {
        continue;
      }
      Double bound = numericValue(stringValue(values.get(parameter.getName())));
      if (bound != null && bound == 0) {
        warnings.add(
            String.format(
                "Test definition '%s': a %s%% threshold is measured against '%s', which is 0, so "
                    + "the tolerance evaluates to 0 and no deviation is allowed.",
                testDefinition.getName(), rawThreshold, parameter.getName()));
      }
    }
    return warnings;
  }

  private static boolean declaresThresholdUnit(TestDefinition testDefinition) {
    return listOrEmpty(testDefinition.getParameterDefinition()).stream()
        .anyMatch(parameter -> THRESHOLD_UNIT.equals(parameter.getName()));
  }

  private static String stringValue(Object value) {
    if (value == null) {
      return null;
    }
    String string = value.toString().trim();
    return string.isEmpty() ? null : string;
  }

  private static Double numericValue(String value) {
    if (value == null) {
      return null;
    }
    try {
      double parsed = Double.parseDouble(value);
      return Double.isFinite(parsed) ? parsed : null;
    } catch (NumberFormatException e) {
      return null;
    }
  }
}
