package org.openmetadata.dsl.conditions;

import org.openmetadata.dsl.core.DSLCondition;

public class PipelineStatus {

  public static DSLCondition is(String status) {
    return DSLCondition.builder()
        .expression("PipelineStatus.is(\"" + status + "\")")
        .type("pipeline_status")
        .build();
  }

  public static DSLCondition in(String... statuses) {
    String statusesList = "[\"" + String.join("\", \"", statuses) + "\"]";
    return DSLCondition.builder()
        .expression("PipelineStatus.in(" + statusesList + ")")
        .type("pipeline_status")
        .build();
  }

  public static DSLCondition isNot(String status) {
    return DSLCondition.builder()
        .expression("PipelineStatus.isNot(\"" + status + "\")")
        .type("pipeline_status")
        .build();
  }

  public static DSLCondition notIn(String... statuses) {
    String statusesList = "[\"" + String.join("\", \"", statuses) + "\"]";
    return DSLCondition.builder()
        .expression("PipelineStatus.notIn(" + statusesList + ")")
        .type("pipeline_status")
        .build();
  }

  // Common pipeline status constants
  public static final String SUCCESS = "Success";
  public static final String SUCCESSFUL = "Successful";
  public static final String FAILED = "Failed";
  public static final String RUNNING = "Running";
  public static final String QUEUED = "Queued";
  public static final String ABORTED = "Aborted";
  public static final String SKIPPED = "Skipped";
  public static final String PENDING = "Pending";
  public static final String PARTIAL_SUCCESS = "PartialSuccess";

  // Helper methods for common conditions
  public static DSLCondition failed() {
    return is(FAILED);
  }

  public static DSLCondition successful() {
    return in(SUCCESS, SUCCESSFUL);
  }

  public static DSLCondition running() {
    return is(RUNNING);
  }

  public static DSLCondition queued() {
    return is(QUEUED);
  }

  public static DSLCondition aborted() {
    return is(ABORTED);
  }

  public static DSLCondition failedOrAborted() {
    return in(FAILED, ABORTED);
  }

  public static DSLCondition activeStates() {
    return in(RUNNING, QUEUED, PENDING);
  }

  public static DSLCondition completedStates() {
    return in(SUCCESS, SUCCESSFUL, FAILED, ABORTED, SKIPPED, PARTIAL_SUCCESS);
  }
}
