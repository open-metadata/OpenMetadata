package org.openmetadata.service.governance.workflows;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.UUID;
import java.util.function.Consumer;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.OntologyReviewTarget;
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.schema.type.TaskEntityType;
import org.openmetadata.schema.type.TaskResolution;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.BadRequestException;

class OntologyApprovalWorkflowTest {
  @Test
  void ontologyReviewCannotBeRetargetedOrConvertedToAnotherTaskType() {
    Task original = reviewTask();
    assertRejected(original, task -> task.getOntologyReview().setReviewRevision(2L));
    assertRejected(original, task -> task.setOntologyReview(null));
    assertRejected(original, task -> task.setWorkflowDefinitionId(UUID.randomUUID()));
    assertRejected(original, task -> task.getAbout().setId(UUID.randomUUID()));
    assertRejected(original, task -> task.setType(TaskEntityType.GlossaryApproval));
  }

  @Test
  void hydratedReferencePresentationDoesNotRetargetTheTask() {
    Task original = reviewTask();
    Task updated = JsonUtils.deepCopy(original, Task.class);
    updated.getAbout().setDisplayName("Sales model");

    assertDoesNotThrow(() -> OntologyApprovalWorkflow.requireUnchangedTarget(original, updated));
  }

  @Test
  void finishedReviewsRequireANewTaskInsteadOfReusingVotes() {
    for (TaskEntityStatus status :
        new TaskEntityStatus[] {
          TaskEntityStatus.Approved, TaskEntityStatus.Rejected, TaskEntityStatus.Cancelled
        }) {
      Task original =
          reviewTask()
              .withStatus(status)
              .withResolution(new TaskResolution().withType(TaskResolutionType.Completed));
      assertRejected(original, task -> task.setStatus(TaskEntityStatus.Open));
      assertRejected(original, task -> task.setResolution(null));
      assertRejected(original, task -> task.setStatus(TaskEntityStatus.InProgress));
      assertDoesNotThrow(() -> OntologyApprovalWorkflow.requireUnchangedTarget(original, original));
    }
  }

  @Test
  void cancellationCannotBeOverwrittenByALateDecision() {
    Task cancelled = reviewTask().withStatus(TaskEntityStatus.Cancelled);
    assertRejected(cancelled, task -> task.setStatus(TaskEntityStatus.Approved));
    assertRejected(cancelled, task -> task.setStatus(TaskEntityStatus.Rejected));
  }

  @Test
  void reviewFilerCannotBeChangedToPermitSelfApproval() {
    Task original =
        reviewTask()
            .withCreatedBy(new EntityReference().withId(UUID.randomUUID()).withType(Entity.USER));
    assertRejected(original, task -> task.getCreatedBy().setId(UUID.randomUUID()));
    assertRejected(original, task -> task.setCreatedBy(null));
  }

  @Test
  void glossaryApprovalKeepsItsExistingLifecycle() {
    Task glossary =
        new Task()
            .withType(TaskEntityType.GlossaryApproval)
            .withAbout(new EntityReference().withType(Entity.GLOSSARY_TERM));
    Task updated =
        JsonUtils.deepCopy(glossary, Task.class).withWorkflowDefinitionId(UUID.randomUUID());

    assertFalse(OntologyApprovalWorkflow.isReview(glossary));
    assertDoesNotThrow(() -> OntologyApprovalWorkflow.requireUnchangedTarget(glossary, updated));
    assertTrue(OntologyApprovalWorkflow.isReview(reviewTask()));
  }

  private static void assertRejected(Task original, Consumer<Task> edit) {
    Task updated = JsonUtils.deepCopy(original, Task.class);
    edit.accept(updated);
    assertThrows(
        BadRequestException.class,
        () -> OntologyApprovalWorkflow.requireUnchangedTarget(original, updated));
  }

  private static Task reviewTask() {
    UUID entityId = UUID.randomUUID();
    return new Task()
        .withType(TaskEntityType.RequestApproval)
        .withAbout(new EntityReference().withId(entityId).withType(Entity.ONTOLOGY))
        .withWorkflowDefinitionId(UUID.randomUUID())
        .withOntologyReview(
            new OntologyReviewTarget().withEntityId(entityId).withReviewRevision(1L));
  }
}
