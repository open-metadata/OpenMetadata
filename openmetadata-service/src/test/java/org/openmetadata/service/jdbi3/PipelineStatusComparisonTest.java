package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.PipelineStatus;
import org.openmetadata.schema.type.Status;
import org.openmetadata.schema.type.StatusType;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * Guards the equality check behind ENTITY_NO_CHANGE for pipeline status writes. A false "changed"
 * here re-opens the alert storm of #31782, so each case below is a way a re-sent but identical
 * status can look different on the wire.
 */
class PipelineStatusComparisonTest {

  private static final long TS = 1785063454240L;

  private static Status task(String name, StatusType status, Long endTime) {
    return new Status().withName(name).withExecutionStatus(status).withEndTime(endTime);
  }

  private static PipelineStatus status(List<Status> tasks) {
    return new PipelineStatus()
        .withTimestamp(TS)
        .withExecutionId("run_1")
        .withExecutionStatus(StatusType.Failed)
        .withTaskStatus(tasks);
  }

  private static PipelineStatus fromJson(String json) {
    return JsonUtils.readValue(json, PipelineStatus.class);
  }

  @Test
  @DisplayName("identical payloads compare equal")
  void identicalPayloads() {
    assertTrue(
        PipelineRepository.isSameStatus(
            status(List.of(task("a", StatusType.Failed, 5L))),
            status(List.of(task("a", StatusType.Failed, 5L)))));
  }

  @Test
  @DisplayName("reordered taskStatus compares equal: connectors do not guarantee a stable order")
  void reorderedTasksAreEqual() {
    PipelineStatus stored =
        status(List.of(task("a", StatusType.Failed, 5L), task("b", StatusType.Successful, 6L)));
    PipelineStatus incoming =
        status(List.of(task("b", StatusType.Successful, 6L), task("a", StatusType.Failed, 5L)));
    assertTrue(PipelineRepository.isSameStatus(stored, incoming));
  }

  @Test
  @DisplayName("explicit null inputs collapses onto the schema default")
  void explicitNullInputsEqualsDefault() {
    PipelineStatus incoming = status(List.of(task("a", StatusType.Failed, 5L)));
    incoming.setInputs(null);
    incoming.setOutputs(null);
    assertTrue(
        PipelineRepository.isSameStatus(
            status(List.of(task("a", StatusType.Failed, 5L))), incoming));
  }

  @Test
  @DisplayName("legacy stored JSON without inputs/outputs compares equal")
  void legacyJsonWithoutInputsOutputs() {
    String legacy =
        "{\"timestamp\":"
            + TS
            + ",\"executionId\":\"run_1\",\"executionStatus\":\"Failed\","
            + "\"taskStatus\":[{\"name\":\"a\",\"executionStatus\":\"Failed\",\"endTime\":5}]}";
    assertTrue(
        PipelineRepository.isSameStatus(
            fromJson(legacy), status(List.of(task("a", StatusType.Failed, 5L)))));
  }

  @Test
  @DisplayName("key order in stored JSON is irrelevant: Postgres jsonb reorders on write")
  void keyReorderedStoredJson() {
    String reordered =
        "{\"executionStatus\":\"Failed\",\"taskStatus\":[{\"endTime\":5,"
            + "\"executionStatus\":\"Failed\",\"name\":\"a\"}],\"executionId\":\"run_1\","
            + "\"timestamp\":"
            + TS
            + "}";
    assertTrue(
        PipelineRepository.isSameStatus(
            fromJson(reordered), status(List.of(task("a", StatusType.Failed, 5L)))));
  }

  @Test
  @DisplayName("a changed executionStatus is a real change")
  void differentExecutionStatusIsAChange() {
    PipelineStatus incoming = status(List.of(task("a", StatusType.Failed, 5L)));
    incoming.setExecutionStatus(StatusType.Successful);
    assertFalse(
        PipelineRepository.isSameStatus(
            status(List.of(task("a", StatusType.Failed, 5L))), incoming));
  }

  @Test
  @DisplayName("a task gaining an endTime is a real change")
  void taskEndTimeAppearingIsAChange() {
    assertFalse(
        PipelineRepository.isSameStatus(
            status(List.of(task("a", StatusType.Failed, null))),
            status(List.of(task("a", StatusType.Failed, 5L)))));
  }

  @Test
  @DisplayName("a task disappearing is a real change")
  void taskRemovalIsAChange() {
    assertFalse(
        PipelineRepository.isSameStatus(
            status(List.of(task("a", StatusType.Failed, 5L), task("b", StatusType.Failed, 6L))),
            status(List.of(task("a", StatusType.Failed, 5L)))));
  }

  @Test
  @DisplayName("a null taskStatus is not the same as an empty one")
  void nullTaskStatusVersusEmpty() {
    assertFalse(PipelineRepository.isSameStatus(status(null), status(List.of())));
  }
}
