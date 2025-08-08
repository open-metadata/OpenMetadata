package org.openmetadata.dsl.conditions;

import org.openmetadata.dsl.core.DSLCondition;

public class TestResult {

  public static DSLCondition is(String result) {
    return DSLCondition.builder()
        .expression("TestResult.is(\"" + result + "\")")
        .type("test_result")
        .build();
  }

  public static DSLCondition in(String... results) {
    String resultsList = "[\"" + String.join("\", \"", results) + "\"]";
    return DSLCondition.builder()
        .expression("TestResult.in(" + resultsList + ")")
        .type("test_result")
        .build();
  }

  public static DSLCondition isNot(String result) {
    return DSLCondition.builder()
        .expression("TestResult.isNot(\"" + result + "\")")
        .type("test_result")
        .build();
  }

  public static DSLCondition notIn(String... results) {
    String resultsList = "[\"" + String.join("\", \"", results) + "\"]";
    return DSLCondition.builder()
        .expression("TestResult.notIn(" + resultsList + ")")
        .type("test_result")
        .build();
  }

  // Common test result constants
  public static final String SUCCESS = "Success";
  public static final String FAILED = "Failed";
  public static final String ABORTED = "Aborted";
  public static final String SKIPPED = "Skipped";
  public static final String QUEUED = "Queued";

  // Helper methods for common conditions
  public static DSLCondition failed() {
    return is(FAILED);
  }

  public static DSLCondition successful() {
    return is(SUCCESS);
  }

  public static DSLCondition aborted() {
    return is(ABORTED);
  }

  public static DSLCondition failedOrAborted() {
    return in(FAILED, ABORTED);
  }
}
