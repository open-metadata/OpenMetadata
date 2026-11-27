package org.openmetadata.service.governance.workflows.elements.nodes.userTask.impl;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.List;
import java.util.UUID;
import java.util.function.Supplier;
import java.util.stream.Stream;
import lombok.extern.slf4j.Slf4j;
import org.flowable.common.engine.impl.cfg.TransactionContext;
import org.flowable.common.engine.impl.cfg.TransactionState;
import org.flowable.common.engine.impl.context.Context;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.governance.workflows.ApprovalOutcome;
import org.openmetadata.schema.governance.workflows.ApprovalOutcomeDecision;
import org.openmetadata.schema.governance.workflows.AutomaticApprovalReason;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.approval.ChangeApplyService;
import org.openmetadata.service.governance.approval.ChangeApplyService.RevisionReview;
import org.openmetadata.service.governance.approval.ChangeRequestRun;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.jdbi3.TaskRepository;
import org.openmetadata.service.jdbi3.WorkflowInstanceRepository;

/**
 * Records on the workflow run how one of its approval steps was decided
 * (ADR:2026-11-13-a-workflow-run-records-how-each-approval-step-was-decided). The write runs once
 * the step's Flowable transaction commits: a step that rolls back records nothing, and a retried
 * one records its decision once.
 */
@Slf4j
public final class ApprovalOutcomeRecorder {
  private ApprovalOutcomeRecorder() {}

  /** A step the workflow approved itself, for the given reason. */
  public static void recordAutomatic(
      String workflowInstanceId, String node, AutomaticApprovalReason reason) {
    afterCommit(
        workflowInstanceId,
        () ->
            outcome(node, ApprovalOutcomeDecision.APPROVED, List.of()).withAutomaticReason(reason));
  }

  /** A step people decided, named by the users whose votes decided it. */
  public static void recordVoted(String workflowInstanceId, VotedStep step) {
    afterCommit(workflowInstanceId, () -> outcomeOf(step));
  }

  /** A change request an administrator published without review, ending the run reviewing it. */
  public static void recordOverride(UUID taskId, String admin) {
    try {
      String node = WorkflowHandler.getInstance().getTaskNode(taskId);
      Task task =
          ((TaskRepository) Entity.getEntityRepository(Entity.TASK)).findCommittedTask(taskId);
      if (node != null && task != null && task.getWorkflowInstanceId() != null) {
        afterCommit(
            task.getWorkflowInstanceId().toString(),
            () -> outcome(node, ApprovalOutcomeDecision.OVERRIDDEN, List.of(admin)));
      }
    } catch (RuntimeException e) {
      // The override is already published; failing to describe it must not fail the request.
      LOG.error("[ApprovalOutcome] Could not record the override of task {}", taskId, e);
    }
  }

  /**
   * How people decided a step: {@code changeRequest} is the change request the step reviewed, or
   * null when it reviewed none.
   */
  public record VotedStep(
      String node, boolean approved, List<String> decidedBy, ChangeRequestRun changeRequest) {}

  // A change request counts its reviewers' votes itself (the task completes once, on the vote that
  // settles it), so its settled review names who decided and whether any change was dropped.
  private static ApprovalOutcome outcomeOf(VotedStep step) {
    RevisionReview review =
        step.changeRequest() == null
            ? null
            : ChangeApplyService.reviewOf(
                step.changeRequest().changeRequestId(), step.changeRequest().revisionNumber());
    ApprovalOutcomeDecision decision =
        decisionOf(step.approved(), review != null && review.droppedAny());
    return outcome(step.node(), decision, decidersOf(decision, review, step.decidedBy()));
  }

  static ApprovalOutcomeDecision decisionOf(boolean approved, boolean droppedAnyChange) {
    ApprovalOutcomeDecision decision = ApprovalOutcomeDecision.REJECTED;
    if (approved) {
      decision =
          droppedAnyChange
              ? ApprovalOutcomeDecision.PARTIALLY_APPROVED
              : ApprovalOutcomeDecision.APPROVED;
    }
    return decision;
  }

  // The reviewers on the deciding side; both sides of a partial approval decided it. Falls back to
  // the task's own voters when the review names no one.
  static List<String> decidersOf(
      ApprovalOutcomeDecision decision, RevisionReview review, List<String> taskVoters) {
    List<String> deciders = List.of();
    if (review != null) {
      deciders =
          switch (decision) {
            case APPROVED -> review.approvers();
            case REJECTED -> review.rejecters();
            default -> Stream.concat(review.approvers().stream(), review.rejecters().stream())
                .distinct()
                .toList();
          };
    }
    return deciders.isEmpty() ? List.copyOf(taskVoters) : deciders;
  }

  private static ApprovalOutcome outcome(
      String node, ApprovalOutcomeDecision decision, List<String> decidedBy) {
    return new ApprovalOutcome()
        .withId(UUID.randomUUID())
        .withNode(node)
        .withDecision(decision)
        .withDecidedBy(decidedBy)
        .withDecidedAt(System.currentTimeMillis());
  }

  // A run started outside OM has no business key, and so no run record to add the decision to.
  private static void afterCommit(String workflowInstanceId, Supplier<ApprovalOutcome> outcome) {
    if (!nullOrEmpty(workflowInstanceId)) {
      Runnable write = () -> record(workflowInstanceId, outcome);
      TransactionContext transactionContext = Context.getTransactionContext();
      if (transactionContext != null) {
        transactionContext.addTransactionListener(
            TransactionState.COMMITTED, commandContext -> write.run());
      } else {
        write.run();
      }
    }
  }

  // The decision is already made and committed; failing to record it must not fail the run.
  private static void record(String workflowInstanceId, Supplier<ApprovalOutcome> outcome) {
    try {
      WorkflowInstanceRepository repository =
          (WorkflowInstanceRepository)
              Entity.getEntityTimeSeriesRepository(Entity.WORKFLOW_INSTANCE);
      repository.recordApproval(UUID.fromString(workflowInstanceId), outcome.get());
    } catch (RuntimeException e) {
      LOG.error(
          "[ApprovalOutcome] Could not record an approval step's outcome on run {}",
          workflowInstanceId,
          e);
    }
  }
}
