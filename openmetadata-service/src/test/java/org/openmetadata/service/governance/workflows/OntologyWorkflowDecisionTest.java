package org.openmetadata.service.governance.workflows;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.type.OntologyReviewTarget;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.BadRequestException;

class OntologyWorkflowDecisionTest {
  @Test
  void decisionSurvivesSerializationAndRetainsItsExactTarget() {
    Task task = task();
    OntologyWorkflowDecision decision = decision(task);
    OntologyWorkflowDecision restored =
        JsonUtils.readValue(JsonUtils.pojoToJson(decision), OntologyWorkflowDecision.class);

    restored.requireTarget(task);
    assertEquals(decision, restored);
    assertEquals(List.of("alice", "bob"), restored.voters());
  }

  @Test
  void replayCannotResolveAnotherTaskOrRevision() {
    Task task = task();
    OntologyWorkflowDecision decision = decision(task);
    assertThrows(
        BadRequestException.class,
        () ->
            decision.requireTarget(JsonUtils.deepCopy(task, Task.class).withId(UUID.randomUUID())));
    task.getOntologyReview().setReviewRevision(2L);
    assertThrows(BadRequestException.class, () -> decision.requireTarget(task));
  }

  @Test
  void receiptRequiresAnExplicitHumanDecisionAndItsVoter() {
    Task task = task();
    for (TaskResolutionType type :
        List.of(TaskResolutionType.AutoApproved, TaskResolutionType.Completed)) {
      assertThrows(
          BadRequestException.class,
          () ->
              new OntologyWorkflowDecision(
                  task.getId(), task.getOntologyReview(), type, "bob", List.of("bob"), null, null));
    }
    assertThrows(
        BadRequestException.class,
        () ->
            new OntologyWorkflowDecision(
                task.getId(),
                task.getOntologyReview(),
                TaskResolutionType.Approved,
                "bob",
                List.of("alice"),
                null,
                null));
  }

  private static Task task() {
    return new Task()
        .withId(UUID.randomUUID())
        .withOntologyReview(
            new OntologyReviewTarget()
                .withEntityId(UUID.randomUUID())
                .withReviewRevision(1L)
                .withContentDigest("reviewed"));
  }

  private static OntologyWorkflowDecision decision(Task task) {
    return new OntologyWorkflowDecision(
        task.getId(),
        task.getOntologyReview(),
        TaskResolutionType.Approved,
        "bob",
        List.of("alice", "bob"),
        null,
        "Reviewed");
  }
}
