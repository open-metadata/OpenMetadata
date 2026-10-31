package org.openmetadata.service.tasks;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.OntologyReviewTarget;
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.schema.type.TaskEntityType;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.schema.type.TaskReviewVote;
import org.openmetadata.schema.type.TaskReviewVoteDecision;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.approval.ApprovalDecisionService;
import org.openmetadata.service.governance.approval.ApprovalDecisionService.ReviewOutcome;
import org.openmetadata.service.governance.workflows.OntologyApprovalWorkflow;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.governance.workflows.WorkflowHandler.ApprovalTaskContext;
import org.openmetadata.service.governance.workflows.WorkflowHandler.TaskResolutionOutcome;
import org.openmetadata.service.jdbi3.TaskRepository;
import org.openmetadata.service.security.policyevaluator.SubjectContext;
import org.openmetadata.service.util.EntityUtil;

/**
 * Drives {@link TaskWorkflowHandler#resolveTask} for an ontology review that still waits for more
 * votes. The workflow engine and the task store are stood in for by fakes that keep votes the way
 * they do: the engine merges what each completion carries, and the store merges what the handler
 * projects onto the task.
 */
class TaskWorkflowHandlerReviewVotesTest {
  private final UUID taskId = UUID.randomUUID();
  private final Task task = reviewTask();
  private final List<TaskReviewVote> engineVotes = new ArrayList<>();

  @Test
  void aNonFinalVoteLeavesTheReviewOpenAndRecordsOneVoteWithItsComment() {
    Task result = voteAsAlice("Looks right");

    assertSame(task, result);
    assertEquals(TaskEntityStatus.Open, result.getStatus());
    assertEquals(1, result.getReviewVotes().size());
    TaskReviewVote recorded = result.getReviewVotes().getFirst();
    assertEquals("alice", recorded.getVoter().getName());
    assertEquals(TaskReviewVoteDecision.Approved, recorded.getDecision());
    assertEquals("Looks right", recorded.getComment());
    assertEquals("approval", recorded.getStage());
  }

  @Test
  void aRepeatVoterIsRecordedOnce() {
    voteAsAlice("Looks right");
    Task result = voteAsAlice("Changed my mind");

    assertEquals(1, result.getReviewVotes().size());
    assertEquals("Looks right", result.getReviewVotes().getFirst().getComment());
  }

  @Test
  void aVoterKeepsOneVoteInEachApprovalStage() {
    voteAsAlice("Fine for marketing");
    task.setWorkflowStageId("ownerApproval");
    Task result = voteAsAlice("Fine for finance");

    assertEquals(2, result.getReviewVotes().size());
    assertEquals("approval", result.getReviewVotes().get(0).getStage());
    assertEquals("Fine for marketing", result.getReviewVotes().get(0).getComment());
    assertEquals("ownerApproval", result.getReviewVotes().get(1).getStage());
    assertEquals("Fine for finance", result.getReviewVotes().get(1).getComment());
  }

  private Task voteAsAlice(String comment) {
    WorkflowHandler workflow = mock(WorkflowHandler.class);
    TaskRepository tasks = mock(TaskRepository.class);
    EntityUtil.Fields fields = new EntityUtil.Fields(Set.of("about"));
    EntityReference alice = new EntityReference().withType("user").withName("alice");
    SubjectContext subject = mock(SubjectContext.class);
    when(subject.getTeams()).thenReturn(List.of());

    try (MockedStatic<WorkflowHandler> workflowStatic = Mockito.mockStatic(WorkflowHandler.class);
        MockedStatic<Entity> entityStatic = Mockito.mockStatic(Entity.class);
        MockedStatic<OntologyApprovalWorkflow> ontology =
            Mockito.mockStatic(OntologyApprovalWorkflow.class);
        MockedStatic<ApprovalDecisionService> decisions =
            Mockito.mockStatic(ApprovalDecisionService.class);
        MockedStatic<SubjectContext> subjects = Mockito.mockStatic(SubjectContext.class)) {
      workflowStatic.when(WorkflowHandler::getInstance).thenReturn(workflow);
      entityStatic.when(() -> Entity.getEntityRepository(Entity.TASK)).thenReturn(tasks);
      entityStatic
          .when(() -> Entity.getEntityReferenceByName(Entity.USER, "alice", Include.NON_DELETED))
          .thenReturn(alice);
      ontology.when(() -> OntologyApprovalWorkflow.isReview(task)).thenReturn(true);
      decisions
          .when(() -> ApprovalDecisionService.recordForTask(any(), any(), any(), any(), any()))
          .thenReturn(ReviewOutcome.NONE);
      subjects.when(() -> SubjectContext.getSubjectContext("alice")).thenReturn(subject);

      when(workflow.hasActiveRuntimeTask(taskId)).thenReturn(true);
      when(workflow.hasMultiApprovalSupport(taskId)).thenReturn(true);
      when(workflow.approvalTaskContext(taskId))
          .thenReturn(new ApprovalTaskContext("process", "approval", List.of()));
      when(workflow.transformToNodeVariables(eq(taskId), any()))
          .thenAnswer(invocation -> invocation.getArgument(1));
      when(workflow.resolveTaskOutcome(eq(taskId), any()))
          .thenAnswer(
              invocation -> {
                String json =
                    (String)
                        invocation
                            .<java.util.Map<String, Object>>getArgument(1)
                            .get(TaskReviewVotes.variable(taskId));
                List<TaskReviewVote> merged =
                    TaskReviewVotes.merge(engineVotes, TaskReviewVotes.read(json));
                engineVotes.clear();
                engineVotes.addAll(merged);
                return TaskResolutionOutcome.WAITING_FOR_VOTES;
              });
      when(workflow.recordedReviewVotes("process", taskId))
          .thenAnswer(invocation -> List.copyOf(engineVotes));
      when(tasks.recordReviewVotes(eq(taskId), any(), anyString()))
          .thenAnswer(
              invocation -> {
                task.setReviewVotes(
                    TaskReviewVotes.merge(task.getReviewVotes(), invocation.getArgument(1)));
                return task;
              });
      when(tasks.getFields(anyString())).thenReturn(fields);
      when(tasks.get(isNull(), eq(taskId), eq(fields))).thenReturn(task);

      return TaskWorkflowHandler.getInstance()
          .resolveTask(task, "approve", TaskResolutionType.Approved, null, null, comment, "alice");
    }
  }

  private Task reviewTask() {
    EntityReference alice = new EntityReference().withType("user").withName("alice");
    EntityReference bob = new EntityReference().withType("user").withName("bob");
    return new Task()
        .withId(taskId)
        .withWorkflowInstanceId(UUID.randomUUID())
        .withStatus(TaskEntityStatus.Open)
        .withType(TaskEntityType.RequestApproval)
        .withOntologyReview(new OntologyReviewTarget())
        .withWorkflowStageId("approval")
        .withReviewers(List.of(alice, bob));
  }
}
