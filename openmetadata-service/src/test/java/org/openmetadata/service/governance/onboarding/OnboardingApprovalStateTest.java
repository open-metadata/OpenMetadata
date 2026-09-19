package org.openmetadata.service.governance.onboarding;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.entity.governance.OnboardingPlaybook;
import org.openmetadata.schema.entity.governance.PlaybookEntityType;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.governance.onboarding.OnboardingCheckType;
import org.openmetadata.schema.governance.onboarding.OnboardingConfiguration;
import org.openmetadata.schema.governance.onboarding.OnboardingGate;
import org.openmetadata.schema.governance.onboarding.OnboardingInstance;
import org.openmetadata.schema.governance.onboarding.OnboardingStep;
import org.openmetadata.schema.governance.onboarding.OnboardingStepResult;
import org.openmetadata.schema.governance.onboarding.OnboardingStepResult.State;
import org.openmetadata.schema.governance.onboarding.OnboardingTaskBinding;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.governance.workflows.WorkflowInstance;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.schema.type.TaskResolution;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;

/**
 * An approval is complete when the task says it was approved and the workflow that owns it has
 * finished. Onboarding used to keep its own copy of that decision, which meant the copy could be
 * missing while the decision existed - the check then stayed open forever.
 */
class OnboardingApprovalStateTest {
  private static final UUID WORKFLOW_ID = UUID.randomUUID();
  private static final String STEP_ID = "review";

  @Test
  void anApprovedTaskWithAFinishedWorkflowCompletesTheCheck() {
    UUID taskId = UUID.randomUUID();
    UUID executionId = UUID.randomUUID();
    var reads =
        context()
            .with(resolvedTask(taskId, executionId, TaskResolutionType.Approved))
            .with(finished(executionId));

    assertEquals(State.COMPLETE, hydrate(taskId, reads).getState());
  }

  @Test
  void anApprovalStillRunningIsNotComplete() {
    UUID taskId = UUID.randomUUID();
    UUID executionId = UUID.randomUUID();
    var reads =
        context()
            .with(resolvedTask(taskId, executionId, TaskResolutionType.Approved))
            .with(finished(executionId).withStatus(WorkflowInstance.WorkflowStatus.RUNNING));

    assertEquals(State.PENDING, hydrate(taskId, reads).getState());
  }

  /** A multi-approver workflow keeps its runtime task alive until the threshold is met. */
  @Test
  void anApprovalWaitingOnAnotherApproverIsNotComplete() {
    UUID taskId = UUID.randomUUID();
    UUID executionId = UUID.randomUUID();
    var reads =
        context()
            .with(resolvedTask(taskId, executionId, TaskResolutionType.Approved))
            .with(finished(executionId))
            .running(taskId);

    assertEquals(State.PENDING, hydrate(taskId, reads).getState());
  }

  @Test
  void aRejectedResolutionRejectsTheCheck() {
    UUID taskId = UUID.randomUUID();
    UUID executionId = UUID.randomUUID();
    var reads =
        context()
            .with(resolvedTask(taskId, executionId, TaskResolutionType.Rejected))
            .with(finished(executionId));

    assertEquals(State.REJECTED, hydrate(taskId, reads).getState());
  }

  @Test
  void anAutoApprovalCountsAsADecision() {
    UUID taskId = UUID.randomUUID();
    UUID executionId = UUID.randomUUID();
    var reads =
        context()
            .with(resolvedTask(taskId, executionId, TaskResolutionType.AutoApproved))
            .with(finished(executionId));

    assertEquals(State.COMPLETE, hydrate(taskId, reads).getState());
  }

  /**
   * Once the asset is approved the decision stands even though the reviewed metadata has since
   * changed; onboarding no longer governs it and must not reopen the check.
   */
  @Test
  void aPastApprovalSurvivesLaterMetadataChanges() {
    UUID taskId = UUID.randomUUID();
    UUID executionId = UUID.randomUUID();
    var reads =
        context()
            .with(resolvedTask(taskId, executionId, TaskResolutionType.Approved))
            .with(finished(executionId));
    var instance = instance(taskId).withStage(OnboardingLifecycle.APPROVED);
    var result = pendingResult();

    OnboardingTasks.hydrate(result, instance, new Metric().withName("changed"), reads);

    assertEquals(State.COMPLETE, result.getState());
  }

  private OnboardingStepResult hydrate(UUID taskId, StubOnboardingReadContext reads) {
    var instance = instance(taskId);
    var metric = metric();
    var binding = OnboardingTasks.binding(instance, STEP_ID);
    binding.setFingerprint(OnboardingFingerprint.of(instance, metric));
    var result = pendingResult();
    OnboardingTasks.hydrate(result, instance, metric, reads);
    return result;
  }

  private OnboardingStepResult pendingResult() {
    return new OnboardingStepResult()
        .withStep(approvalStep())
        .withRequired(true)
        .withStage(OnboardingLifecycle.IN_REVIEW)
        .withState(State.PENDING);
  }

  private StubOnboardingReadContext context() {
    return new StubOnboardingReadContext().with(approvalWorkflow());
  }

  private Task resolvedTask(UUID taskId, UUID executionId, TaskResolutionType type) {
    return new Task()
        .withId(taskId)
        .withName("onboarding-" + taskId)
        .withStatus(
            type == TaskResolutionType.Rejected
                ? TaskEntityStatus.Rejected
                : TaskEntityStatus.Approved)
        .withResolution(new TaskResolution().withType(type))
        .withWorkflowInstanceId(executionId)
        .withWorkflowDefinitionId(WORKFLOW_ID)
        .withUpdatedAt(System.currentTimeMillis())
        .withAssignees(List.of(user()));
  }

  private WorkflowInstance finished(UUID executionId) {
    return new WorkflowInstance()
        .withId(executionId)
        .withWorkflowDefinitionId(WORKFLOW_ID)
        .withStatus(WorkflowInstance.WorkflowStatus.FINISHED);
  }

  private WorkflowDefinition approvalWorkflow() {
    return JsonUtils.readValue(
            """
            {"name":"ReviewWorkflow","fullyQualifiedName":"ReviewWorkflow","deployed":true,
             "suspended":false,"trigger":{"type":"noOp"},
             "nodes":[{"type":"userTask","subType":"userApprovalTask","name":"Review"}]}
            """,
            WorkflowDefinition.class)
        .withId(WORKFLOW_ID);
  }

  private OnboardingStep approvalStep() {
    return new OnboardingStep()
        .withId(STEP_ID)
        .withTitle("Review")
        .withType(OnboardingCheckType.APPROVAL)
        .withWorkflow(
            new EntityReference().withId(WORKFLOW_ID).withType(Entity.WORKFLOW_DEFINITION));
  }

  private Metric metric() {
    return new Metric().withId(UUID.randomUUID()).withName("orders").withDisplayName("Orders");
  }

  private EntityReference user() {
    return new EntityReference()
        .withId(UUID.randomUUID())
        .withType(Entity.USER)
        .withName("reviewer");
  }

  private OnboardingInstance instance(UUID taskId) {
    return new OnboardingInstance()
        .withId(UUID.randomUUID())
        .withEntity(new EntityReference().withId(UUID.randomUUID()).withType(Entity.METRIC))
        .withStage(OnboardingLifecycle.IN_REVIEW)
        .withConfiguration(
            new OnboardingPlaybook()
                .withEntityType(PlaybookEntityType.METRIC)
                .withOnboarding(
                    new OnboardingConfiguration()
                        .withEnabled(true)
                        .withGates(
                            List.of(
                                new OnboardingGate()
                                    .withStage(OnboardingLifecycle.IN_REVIEW)
                                    .withSteps(List.of(approvalStep()))))))
        .withBindings(
            List.of(
                new OnboardingTaskBinding().withStepId(STEP_ID).withTaskId(taskId).withAttempt(1)));
  }
}
