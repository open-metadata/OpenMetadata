package org.openmetadata.service.governance.workflows.elements.nodes.userTask.impl;

import static org.openmetadata.service.governance.workflows.Workflow.RESULT_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.UPDATED_BY_VARIABLE;

import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.flowable.engine.delegate.TaskListener;
import org.flowable.task.service.delegate.DelegateTask;
import org.openmetadata.schema.type.TaskReviewVoteDecision;
import org.openmetadata.service.governance.approval.ChangeRequestRun;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.governance.workflows.WorkflowVariableHandler;
import org.openmetadata.service.governance.workflows.elements.nodes.userTask.impl.ApprovalOutcomeRecorder.VotedStep;
import org.openmetadata.service.tasks.TaskReviewVotes;

/**
 * Records, when an approval task completes, how the people who voted decided its step. The task
 * completes with the deciding vote's result and voter, so both are this pass's own even when the
 * step runs again in a loop.
 */
@Slf4j
public class RecordVotedApprovalImpl implements TaskListener {
  private static final String APPROVERS_VARIABLE = "approversList";
  private static final String REJECTERS_VARIABLE = "rejectersList";

  @Override
  public void notify(DelegateTask delegateTask) {
    try {
      WorkflowVariableHandler varHandler = new WorkflowVariableHandler(delegateTask);
      TaskReviewVoteDecision decision =
          TaskReviewVotes.decisionForResult(varHandler.getNodeVariable(RESULT_VARIABLE));
      if (decision != null) {
        boolean approved = decision == TaskReviewVoteDecision.Approved;
        ApprovalOutcomeRecorder.recordVoted(
            WorkflowHandler.getInstance()
                .getProcessBusinessKey(delegateTask.getProcessInstanceId()),
            new VotedStep(
                varHandler.getNodeNamespace(),
                approved,
                votersOf(
                    delegateTask.getVariable(approved ? APPROVERS_VARIABLE : REJECTERS_VARIABLE),
                    varHandler.getNodeVariable(UPDATED_BY_VARIABLE)),
                ChangeRequestRun.from(varHandler).orElse(null)));
      }
    } catch (RuntimeException e) {
      // The outcome only describes the decision; a failure to read it must not undo the vote.
      LOG.error("[ApprovalOutcome] Could not read the outcome of task {}", delegateTask.getId(), e);
    }
  }

  // A task that needs several votes keeps every voter on its side of the decision; a single-vote
  // task names the user whose vote completed it.
  static List<String> votersOf(Object sideVoters, Object updatedBy) {
    List<String> voters = namesOf(sideVoters);
    // Flowable variables are untyped; the resolver sets the node's updatedBy to the user's name.
    if (voters.isEmpty() && updatedBy instanceof String user) {
      voters = List.of(user);
    }
    return voters;
  }

  // Flowable variables are untyped; WorkflowHandler.handleMultiApproval keeps the voters of a
  // multi-vote task as a List of user names.
  private static List<String> namesOf(Object voters) {
    List<String> names = List.of();
    if (voters instanceof List<?> list) {
      names = list.stream().map(String::valueOf).toList();
    }
    return names;
  }
}
