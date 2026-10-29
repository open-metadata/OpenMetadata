package org.openmetadata.service.governance.workflows;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mockStatic;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Consumer;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.OntologyApprovalRule;
import org.openmetadata.schema.type.OntologyReviewTarget;
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.schema.type.TaskEntityType;
import org.openmetadata.schema.type.TaskResolution;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.schema.type.TaskReviewVote;
import org.openmetadata.schema.type.TaskReviewVoteDecision;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

class OntologyApprovalWorkflowTest {
  @Test
  void ontologyReviewCannotBeRetargetedOrConvertedToAnotherTaskType() {
    Task original = reviewTask();
    assertRejected(original, task -> task.getOntologyReview().setContentDigest("b".repeat(64)));
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

  @Test
  void decidedVotesKeepRecordedCommentsAndAddEveryCountedVoterOnce() {
    EntityReference alice = user("alice");
    EntityReference bob = user("bob");
    EntityReference carol = user("carol");
    Task task =
        reviewTask()
            .withId(UUID.randomUUID())
            .withReviewers(List.of(alice, bob, carol))
            .withAssignees(List.of(bob, carol))
            .withReviewVotes(
                List.of(
                    new TaskReviewVote()
                        .withVoter(alice)
                        .withAssignee(alice)
                        .withDecision(TaskReviewVoteDecision.Approved)
                        .withComment("Looks right")
                        .withTimestamp(1L)));
    OntologyWorkflowDecision decision =
        new OntologyWorkflowDecision(
            task.getId(),
            task.getOntologyReview(),
            TaskResolutionType.Rejected,
            "carol",
            List.of("alice", "bob", "carol", "carol"),
            null,
            "Rename Funds Transfer");

    List<TaskReviewVote> votes;
    try (MockedStatic<Entity> entities = mockStatic(Entity.class);
        MockedStatic<SubjectContext> subjects = mockStatic(SubjectContext.class)) {
      entities
          .when(
              () ->
                  Entity.getEntityReferenceByName(eq(Entity.USER), anyString(), any(Include.class)))
          .thenAnswer(invocation -> user(invocation.getArgument(1)));
      subjects
          .when(() -> SubjectContext.getSubjectContext(anyString()))
          .thenAnswer(
              invocation ->
                  new SubjectContext(new User().withName(invocation.getArgument(0)), null));
      votes = OntologyApprovalWorkflow.decidedVotes(task, decision, 9L);
    }

    assertEquals(
        List.of("alice", "bob", "carol"), votes.stream().map(v -> v.getVoter().getName()).toList());
    assertEquals(TaskReviewVoteDecision.Approved, votes.get(0).getDecision());
    assertEquals("Looks right", votes.get(0).getComment());
    assertEquals(1L, votes.get(0).getTimestamp());
    assertEquals(TaskReviewVoteDecision.Approved, votes.get(1).getDecision());
    assertNull(votes.get(1).getComment());
    assertEquals(bob.getId(), votes.get(1).getAssignee().getId());
    assertEquals(9L, votes.get(1).getTimestamp());
    assertEquals(TaskReviewVoteDecision.Rejected, votes.get(2).getDecision());
    assertEquals("Rename Funds Transfer", votes.get(2).getComment());
    assertEquals(carol.getId(), votes.get(2).getAssignee().getId());
  }

  private static EntityReference user(String name) {
    return new EntityReference()
        .withId(UUID.nameUUIDFromBytes(name.getBytes()))
        .withType(Entity.USER)
        .withName(name);
  }

  @Test
  void allReviewersRuleStartsTheWorkflowInAllAssigneesMode() {
    Task review = reviewTask();
    review.getOntologyReview().setApprovalRule(OntologyApprovalRule.AllReviewers);

    assertEquals(
        Map.of("approvalMode", "allAssignees"), OntologyApprovalWorkflow.startVariables(review));
    assertEquals(OntologyApprovalRule.AllReviewers, OntologyApprovalWorkflow.approvalRule(review));
  }

  @Test
  void anyReviewerRuleAndOlderReviewsAddNoStartVariable() {
    Task any = reviewTask();
    any.getOntologyReview().setApprovalRule(OntologyApprovalRule.AnyReviewer);
    Task legacy = reviewTask();
    legacy.getOntologyReview().setApprovalRule(null);
    Task glossary =
        new Task()
            .withType(TaskEntityType.GlossaryApproval)
            .withAbout(new EntityReference().withType(Entity.GLOSSARY_TERM));

    assertEquals(Map.of(), OntologyApprovalWorkflow.startVariables(any));
    assertEquals(Map.of(), OntologyApprovalWorkflow.startVariables(legacy));
    assertEquals(Map.of(), OntologyApprovalWorkflow.startVariables(glossary));
    assertEquals(OntologyApprovalRule.AnyReviewer, OntologyApprovalWorkflow.approvalRule(legacy));
    assertEquals(OntologyApprovalRule.AnyReviewer, OntologyApprovalWorkflow.approvalRule(glossary));
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
            new OntologyReviewTarget().withEntityId(entityId).withContentDigest("a".repeat(64)));
  }
}
