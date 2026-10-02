package org.openmetadata.service.jdbi3;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.openmetadata.schema.tests.TestDefinition;

/**
 * Validates the failure threshold parameters — `threshold` and `thresholdUnit` — of a test case.
 *
 * <p>A PERCENTAGE threshold means two different things depending on what the test counts, so the
 * range check has to be class-aware rather than a blanket 0..100.
 *
 * <p>A <b>row tolerance</b> is spent on rows: the validator counts violating rows and compares their
 * share of a denominator against the threshold, so more than 100% of the rows cannot fail and the
 * cap applies. A <b>deviation from a statistic</b> is spent on how far a single aggregate (a mean, a
 * sum, a row count) may drift from its bound or expected value, and "tolerate the mean being up to
 * 200% off" is loose but perfectly coherent, so it is accepted.
 *
 * <p>Which class a definition belongs to is named here rather than derived from
 * `supportsRowLevelPassedFailed`. That flag says whether a validator can report passed/failed row
 * counts, which is a related but different question, and it does not track the threshold semantics:
 * `columnValuesToBeAtExpectedLocation` sets it to false and `columnValuesMissingCount` omits it,
 * yet the first spends its percentage on rows and the second on an expected value. The two sets
 * below mirror the semantics the validators actually implement, in
 * `BaseTestValidator._apply_row_threshold()` and `thresholds.apply_bound_tolerance()` /
 * `within_deviation()` respectively.
 */
final class TestCaseThresholdValidator {
  static final String THRESHOLD = "threshold";
  static final String THRESHOLD_UNIT = "thresholdUnit";
  static final String PERCENTAGE = "PERCENTAGE";

  private static final String COLUMN_VALUES_TO_BE_IN_SET = "columnValuesToBeInSet";
  private static final String MATCH_ENUM = "matchEnum";

  /**
   * `tableCustomSQLQuery` declares `thresholdUnit`, but its `threshold` is not a failure tolerance
   * at all: it is the bound the custom SQL result is compared against through `operator`, and it has
   * carried that meaning since long before failure thresholds existed. A negative bound compared
   * with `>=` is a legitimate test case, so it is left entirely alone.
   */
  private static final Set<String> COMPARISON_BOUND_DEFINITIONS = Set.of("tableCustomSQLQuery");

  /** Definitions whose percentage is a share of the evaluated rows, so it cannot exceed 100. */
  private static final Set<String> ROW_TOLERANCE_DEFINITIONS =
      Set.of(
          "columnValuesToBeNotNull",
          "columnValuesToBeUnique",
          COLUMN_VALUES_TO_BE_IN_SET,
          "columnValuesToBeNotInSet",
          "columnValuesToMatchRegex",
          "columnValuesToNotMatchRegex",
          "columnValuesToBeBetween",
          "columnValueLengthsToBeBetween",
          "columnValuesToBeAtExpectedLocation");

  /**
   * Definitions whose percentage is a deviation from a statistic, mapped to the parameters the
   * percentage is actually measured against — the bounds of a range test, the expected value of an
   * exact-value one. Only those parameters can make a percentage tolerance degenerate; the other
   * numeric parameters of the same definitions configure the metric rather than scale the tolerance,
   * so a `rangeInterval` of 0 says nothing about the threshold.
   */
  private static final Map<String, Set<String>> DEVIATION_REFERENCES =
      Map.ofEntries(
          Map.entry(
              "columnValueMaxToBeBetween", Set.of("minValueForMaxInCol", "maxValueForMaxInCol")),
          Map.entry(
              "columnValueMeanToBeBetween", Set.of("minValueForMeanInCol", "maxValueForMeanInCol")),
          Map.entry(
              "columnValueMedianToBeBetween",
              Set.of("minValueForMedianInCol", "maxValueForMedianInCol")),
          Map.entry(
              "columnValueMinToBeBetween", Set.of("minValueForMinInCol", "maxValueForMinInCol")),
          Map.entry(
              "columnValueStdDevToBeBetween",
              Set.of("minValueForStdDevInCol", "maxValueForStdDevInCol")),
          Map.entry("columnValuesSumToBeBetween", Set.of("minValueForColSum", "maxValueForColSum")),
          Map.entry("columnValuesMissingCount", Set.of("missingCountValue")),
          Map.entry("tableColumnCountToBeBetween", Set.of("minColValue", "maxColValue")),
          Map.entry("tableColumnCountToEqual", Set.of("columnCount")),
          Map.entry("tableRowCountToBeBetween", Set.of("minValue", "maxValue")),
          Map.entry("tableRowCountToEqual", Set.of("value")),
          Map.entry("tableRowInsertedCountToBeBetween", Set.of("min", "max")));

  private TestCaseThresholdValidator() {}

  /**
   * Throws {@link IllegalArgumentException} — surfaced as a 400 — when the threshold cannot mean
   * anything for this test definition. Returns the warnings worth logging for the thresholds that
   * are accepted but degenerate.
   */
  static List<String> validate(TestDefinition testDefinition, Map<String, Object> values) {
    String name = testDefinition.getName();
    if (COMPARISON_BOUND_DEFINITIONS.contains(name) || !declaresThresholdUnit(testDefinition)) {
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
    if (isRowTolerance(testDefinition)) {
      if (threshold > 100) {
        throw new IllegalArgumentException(
            String.format(
                "Parameter '%s' is read as a percentage of the evaluated rows for test definition "
                    + "'%s' and cannot exceed 100, but was %s. Use a '%s' of ABSOLUTE to tolerate a "
                    + "raw number of failing rows.",
                THRESHOLD, name, rawThreshold, THRESHOLD_UNIT));
      }
      return List.of();
    }
    return degenerateReferenceWarnings(testDefinition, values, rawThreshold);
  }

  /**
   * Whether this definition spends its percentage on rows.
   *
   * <p>The two named sets cover every system definition that supports failure thresholds. A custom
   * definition is classified by its own `supportsRowLevelPassedFailed` declaration, which is the
   * only signal available for it — and unlike for the system definitions, it is the author's
   * deliberate statement that the test counts rows.
   */
  private static boolean isRowTolerance(TestDefinition testDefinition) {
    String name = testDefinition.getName();
    if (ROW_TOLERANCE_DEFINITIONS.contains(name)) {
      return true;
    }
    return !DEVIATION_REFERENCES.containsKey(name)
        && Boolean.TRUE.equals(testDefinition.getSupportsRowLevelPassedFailed());
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
   * A percentage of a reference of 0 is 0, so the tolerance the user asked for silently does
   * nothing. Worth saying out loud, not worth rejecting — the bound itself is legitimate.
   */
  private static List<String> degenerateReferenceWarnings(
      TestDefinition testDefinition, Map<String, Object> values, String rawThreshold) {
    List<String> warnings = new ArrayList<>();
    for (String reference : DEVIATION_REFERENCES.getOrDefault(testDefinition.getName(), Set.of())) {
      Double value = numericValue(stringValue(values.get(reference)));
      if (value != null && value == 0) {
        warnings.add(
            String.format(
                "Test definition '%s': a %s%% threshold is measured against '%s', which is 0, so "
                    + "the tolerance evaluates to 0 and no deviation is allowed.",
                testDefinition.getName(), rawThreshold, reference));
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
