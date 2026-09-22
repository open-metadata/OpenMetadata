package org.openmetadata.service.governance.onboarding;

import jakarta.json.Json;
import java.io.StringReader;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.governance.onboarding.OnboardingAssignment;
import org.openmetadata.schema.governance.onboarding.OnboardingCheckType;
import org.openmetadata.schema.governance.onboarding.OnboardingConfiguration;
import org.openmetadata.schema.governance.onboarding.OnboardingInstance;
import org.openmetadata.schema.governance.onboarding.OnboardingReminder;
import org.openmetadata.schema.governance.onboarding.OnboardingStep;
import org.openmetadata.schema.governance.onboarding.OnboardingStepResult;
import org.openmetadata.schema.governance.onboarding.OnboardingStepResult.State;
import org.openmetadata.schema.governance.onboarding.OnboardingTaskBinding;
import org.openmetadata.schema.governance.workflows.WorkflowInstance;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TaskCategory;
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.schema.type.TaskEntityType;
import org.openmetadata.schema.type.TaskPriority;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.TaskRepository;
import org.openmetadata.service.tasks.TaskWorkflowLifecycleResolver;
import org.openmetadata.service.tasks.TaskWorkflowLifecycleResolver.TaskWorkflowBinding;

public final class OnboardingTasks {
  private static final Set<TaskResolutionType> APPROVED_RESOLUTIONS =
      Set.of(TaskResolutionType.Approved, TaskResolutionType.AutoApproved);
  private static final Set<TaskResolutionType> REJECTED_RESOLUTIONS =
      Set.of(TaskResolutionType.Rejected, TaskResolutionType.AutoRejected);
  private static final String WORKFLOW_START_FAILED = "workflow-start-failed";

  private record BoundTask(OnboardingTaskBinding binding, Task task) {}

  private OnboardingTasks() {}

  private static TaskRepository repository() {
    return (TaskRepository) Entity.getEntityRepository(Entity.TASK);
  }

  public static OnboardingStep stepForTask(UUID taskId) {
    OnboardingInstance instance = OnboardingStore.forTask(taskId);
    if (instance == null) return null;
    var binding =
        instance.getBindings().stream()
            .filter(item -> item.getTaskId().equals(taskId))
            .findFirst()
            .orElse(null);
    return binding == null
        ? null
        : OnboardingLifecycle.stageKeys(configurationOf(instance)).stream()
            .flatMap(
                stage -> OnboardingEvaluator.steps(instance.getConfiguration(), stage).stream())
            .filter(step -> step.getId().equals(binding.getStepId()))
            .findFirst()
            .orElse(null);
  }

  public static Map<String, Object> correlation(UUID taskId) {
    var instance = OnboardingStore.forTask(taskId);
    if (instance == null) return Map.of();
    var binding =
        instance.getBindings().stream()
            .filter(item -> item.getTaskId().equals(taskId))
            .findFirst()
            .orElseThrow();
    var stage =
        OnboardingLifecycle.stageKeys(configurationOf(instance)).stream()
            .filter(
                gate ->
                    OnboardingEvaluator.steps(instance.getConfiguration(), gate).stream()
                        .anyMatch(step -> step.getId().equals(binding.getStepId())))
            .findFirst()
            .orElseThrow();
    return Map.of(
        "onboardingInstanceId",
        instance.getId().toString(),
        "onboardingGate",
        stage,
        "onboardingStepId",
        binding.getStepId(),
        "onboardingAttempt",
        binding.getAttempt());
  }

  public static TaskWorkflowBinding workflowBinding(Task task) {
    OnboardingStep step = stepForTask(task.getId());
    if (step == null || step.getType() != OnboardingCheckType.APPROVAL) return null;
    var workflow = OnboardingConfigurationValidator.workflow(step);
    var defaults =
        TaskWorkflowLifecycleResolver.resolveBinding(
                task.getType(), task.getCategory(), task.getPayload())
            .orElseThrow();
    return new TaskWorkflowBinding(
        defaults.schema(),
        workflow.getFullyQualifiedName(),
        defaults.createFormSchema(),
        defaults.createUiSchema(),
        defaults.transitionForms(),
        defaults.defaultStageMappings());
  }

  public static boolean isManaged(UUID taskId) {
    return OnboardingStore.forTask(taskId) != null;
  }

  public static boolean isFieldTask(UUID taskId) {
    return isFieldCheck(stepForTask(taskId));
  }

  /**
   * A check satisfied by a value on the asset rather than by a workflow decision. Every type except
   * {@code approval} names a field path - the validator enforces that - so a relationship,
   * responsibility or assessment check carries a field task exactly like an attribute does. Only an
   * approval has a workflow to consult.
   */
  static boolean isFieldCheck(OnboardingStep step) {
    return step != null && step.getType() != OnboardingCheckType.APPROVAL;
  }

  private static OnboardingConfiguration configurationOf(OnboardingInstance instance) {
    return instance.getConfiguration() == null ? null : instance.getConfiguration().getOnboarding();
  }

  /**
   * True once the asset has reached the stage its playbook maps to {@code Approved} - past that point
   * onboarding stops opening new tasks and leaves the asset to its workflows.
   */
  private static boolean reachedApproved(OnboardingInstance instance) {
    var configuration = configurationOf(instance);
    int current = OnboardingLifecycle.indexOf(configuration, instance.getStage());
    int approved = OnboardingLifecycle.indexOf(configuration, OnboardingLifecycle.APPROVED);
    return current >= 0 && approved >= 0 && current >= approved;
  }

  /**
   * The decision lives on the task, not in a copy onboarding keeps. An approval is only complete
   * once the workflow that owns it has finished - a recorded resolution with a workflow still
   * running means another approver is yet to act.
   */
  private static boolean isApproved(Task task, OnboardingReadContext reads) {
    TaskResolutionType resolution = resolutionType(task);
    return resolution != null
        && APPROVED_RESOLUTIONS.contains(resolution)
        && hasCompletedExecution(task, reads);
  }

  private static boolean isRejected(Task task) {
    TaskResolutionType resolution = resolutionType(task);
    return task.getStatus() == TaskEntityStatus.Rejected
        || (resolution != null && REJECTED_RESOLUTIONS.contains(resolution));
  }

  private static TaskResolutionType resolutionType(Task task) {
    return task == null || task.getResolution() == null ? null : task.getResolution().getType();
  }

  private static boolean hasCompletedExecution(Task task, OnboardingReadContext reads) {
    if (task.getWorkflowInstanceId() == null) return false;
    try {
      WorkflowInstance execution = reads.execution(task.getWorkflowInstanceId());
      return execution != null
          && execution.getStatus() == WorkflowInstance.WorkflowStatus.FINISHED
          && Objects.equals(execution.getWorkflowDefinitionId(), task.getWorkflowDefinitionId())
          && !reads.activeRuntimeTask(task.getId());
    } catch (EntityNotFoundException missingExecution) {
      return false;
    }
  }

  public static void hydrate(
      OnboardingStepResult result, OnboardingInstance instance, EntityInterface entity) {
    hydrate(result, instance, entity, OnboardingReadContext.DIRECT);
  }

  static void hydrate(
      OnboardingStepResult result,
      OnboardingInstance instance,
      EntityInterface entity,
      OnboardingReadContext reads) {
    if (result.getState() == State.NOT_APPLICABLE) return;
    var binding = binding(instance, result.getStep().getId());
    Task task = binding == null ? null : reads.task(binding.getTaskId());
    if (task != null)
      result
          .withTaskId(task.getId())
          .withWorkflowInstanceId(task.getWorkflowInstanceId())
          .withDueDate(task.getDueDate());
    if (binding != null)
      result
          .withStallNotifiedAt(binding.getStallNotifiedAt())
          .withReassignedAt(binding.getReassignedAt());
    result.withLastReminderAt(lastReminderAt(instance, result.getStep().getId()));
    if (isFieldCheck(result.getStep())) {
      result.setAssignees(OnboardingAssignments.resolve(result.getStep(), entity, instance, reads));
      if (!OnboardingEvaluator.isSatisfied(result)
          && task != null
          && TaskRepository.isTerminalStatus(task.getStatus())) {
        result
            .withState(State.FAILED)
            .withMessage("The field still needs a value; retry to reopen assigned work");
      }
      if (!OnboardingEvaluator.isSatisfied(result) && result.getAssignees().isEmpty())
        result.withState(State.BLOCKED).withMessage("Assign a responsible user or team");
    } else {
      hydrateApproval(result, new BoundTask(binding, task), instance, entity, reads);
    }
  }

  private static void hydrateApproval(
      OnboardingStepResult result,
      BoundTask bound,
      OnboardingInstance instance,
      EntityInterface entity,
      OnboardingReadContext reads) {
    var binding = bound.binding();
    var task = bound.task();
    boolean decided = isApproved(task, reads);
    // Past the approved stage the decision stands even if the workflow was later retired or the
    // reviewed metadata has moved on; onboarding no longer governs the asset.
    if (reachedApproved(instance) && decided) {
      result.withState(State.COMPLETE).withMessage(null);
      return;
    }
    try {
      OnboardingConfigurationValidator.workflow(result.getStep(), reads);
    } catch (RuntimeException exception) {
      result.withState(State.FAILED).withMessage(exception.getMessage());
      return;
    }
    if (task == null) return;
    result.setAssignees(task.getAssignees() == null ? List.of() : task.getAssignees());
    if (!Objects.equals(binding.getFingerprint(), OnboardingFingerprint.of(instance, entity))) {
      result.withState(State.PENDING).withMessage("Metadata changed; request a fresh approval");
    } else if (decided) {
      result.withState(State.COMPLETE).withMessage(null);
    } else if (isRejected(task)) {
      result.withState(State.REJECTED).withMessage("Approval rejected; revise and resubmit");
    } else if (WORKFLOW_START_FAILED.equals(task.getWorkflowStageId())
        || TaskRepository.isTerminalStatus(task.getStatus())
        || failedExecution(task, reads)) {
      result
          .withState(State.FAILED)
          .withMessage("Workflow failed; retry after resolving the error");
    } else if (result.getAssignees().isEmpty()) {
      result.withState(State.BLOCKED).withMessage("The workflow has no assignees");
    }
  }

  private static Long lastReminderAt(OnboardingInstance instance, String stepId) {
    return instance.getReminders().stream()
        .filter(reminder -> stepId.equals(reminder.getStepId()))
        .map(OnboardingReminder::getSentAt)
        .filter(Objects::nonNull)
        .max(Long::compareTo)
        .orElse(null);
  }

  private static boolean failedExecution(Task task, OnboardingReadContext reads) {
    if (task.getWorkflowInstanceId() == null)
      return task.getUpdatedAt() < System.currentTimeMillis() - 60_000;
    try {
      var execution = reads.execution(task.getWorkflowInstanceId());
      return execution == null
          || execution.getStatus() != WorkflowInstance.WorkflowStatus.RUNNING
              && execution.getStatus() != WorkflowInstance.WorkflowStatus.FINISHED;
    } catch (EntityNotFoundException missingExecution) {
      return true;
    }
  }

  public static void closeAll(OnboardingInstance instance) {
    instance.getBindings().forEach(OnboardingTasks::closeFieldTask);
  }

  public static void reserve(OnboardingInstance instance, EntityInterface entity, boolean retry) {
    if (reachedApproved(instance)) return;
    var results =
        OnboardingEvaluator.evaluateThrough(
            instance.getConfiguration(), entity, instance.getStage());
    boolean fieldsReady =
        results.stream()
            .filter(result -> isFieldCheck(result.getStep()))
            .noneMatch(result -> result.getRequired() && !OnboardingEvaluator.isSatisfied(result));
    for (var result : results) {
      if (result.getState() == State.NOT_APPLICABLE) continue;
      if (result.getStep().getType() == OnboardingCheckType.APPROVAL && !fieldsReady) continue;
      if (isFieldCheck(result.getStep()) && OnboardingEvaluator.isSatisfied(result)) continue;
      reserveStep(instance, entity, result, retry);
    }
  }

  private static void reserveStep(
      OnboardingInstance instance,
      EntityInterface entity,
      OnboardingStepResult result,
      boolean retry) {
    if (!canStart(result.getStep())) return;
    var previous = binding(instance, result.getStep().getId());
    if (previous != null) {
      hydrate(result, instance, entity);
      if (!retry
          || result.getState() == State.COMPLETE
          || (result.getState() != State.REJECTED
              && result.getState() != State.FAILED
              && Objects.equals(
                  previous.getFingerprint(), OnboardingFingerprint.of(instance, entity)))) return;
    }
    if (isFieldCheck(result.getStep())
        && OnboardingAssignments.resolve(result.getStep(), entity, instance).isEmpty()) return;
    var next =
        new OnboardingTaskBinding()
            .withStepId(result.getStep().getId())
            .withTaskId(UUID.randomUUID())
            .withAttempt(previous == null ? 1 : previous.getAttempt() + 1)
            .withFingerprint(OnboardingFingerprint.of(instance, entity));
    if (result.getStep().getWorkflow() != null)
      next.setWorkflowDefinitionId(result.getStep().getWorkflow().getId());
    instance.getBindings().add(next);
    OnboardingStore.dao()
        .bindTask(
            next.getTaskId().toString(),
            instance.getId().toString(),
            next.getStepId(),
            next.getAttempt());
  }

  public static void startPending(OnboardingInstance instance, EntityInterface entity) {
    if (reachedApproved(instance)) {
      closeAll(instance);
      return;
    }
    closeSupersededAttempts(instance);
    for (var result :
        OnboardingEvaluator.evaluateThrough(
            instance.getConfiguration(), entity, instance.getStage())) {
      var binding = binding(instance, result.getStep().getId());
      if (binding == null) continue;
      if (result.getState() == State.NOT_APPLICABLE
          || (isFieldCheck(result.getStep()) && OnboardingEvaluator.isSatisfied(result))) {
        closeFieldTask(binding);
      } else {
        startTask(instance, entity, result.getStep(), binding);
      }
    }
  }

  private static void closeSupersededAttempts(OnboardingInstance instance) {
    for (var previous : instance.getBindings()) {
      var current = binding(instance, previous.getStepId());
      if (!previous.getTaskId().equals(current.getTaskId())) closeFieldTask(previous);
    }
  }

  private static void startTask(
      OnboardingInstance instance,
      EntityInterface entity,
      OnboardingStep step,
      OnboardingTaskBinding binding) {
    Task existing = repository().findCommittedTask(binding.getTaskId());
    if (existing != null) {
      if (isFieldCheck(step)) refreshAssignees(existing, step, instance, entity);
      return;
    }
    boolean approval = step.getType() == OnboardingCheckType.APPROVAL;
    if (!canStart(step)) return;
    var task =
        new Task()
            .withId(binding.getTaskId())
            .withName("onboarding-" + binding.getTaskId())
            .withDisplayName(step.getTitle() == null ? step.getId() : step.getTitle())
            .withDescription(step.getGuidance())
            .withType(approval ? TaskEntityType.RequestApproval : TaskEntityType.CustomTask)
            .withCategory(approval ? TaskCategory.Approval : TaskCategory.Custom)
            .withStatus(TaskEntityStatus.Open)
            .withPriority(TaskPriority.Medium)
            .withAbout(entity.getEntityReference())
            .withCreatedBy(instance.getCreator())
            .withUpdatedBy(OnboardingNotifications.BOT)
            .withUpdatedAt(System.currentTimeMillis())
            .withCreatedAt(System.currentTimeMillis())
            .withAssignees(
                approval ? List.of() : OnboardingAssignments.resolve(step, entity, instance))
            .withDueDate(
                OnboardingGates.dueDate(
                    OnboardingGates.gateForStep(instance, step.getId()),
                    System.currentTimeMillis()))
            .withPayload(Map.of());
    try {
      repository().create(null, task);
    } catch (RuntimeException exception) {
      if (repository().findCommittedTask(binding.getTaskId()) == null) throw exception;
    }
  }

  private static void closeFieldTask(OnboardingTaskBinding binding) {
    Task task = repository().findCommittedTask(binding.getTaskId());
    if (task != null && TaskRepository.OPEN_TASK_STATUSES.contains(task.getStatus()))
      repository()
          .closeTask(task, OnboardingNotifications.BOT, "Onboarding check satisfied or superseded");
  }

  private static void refreshAssignees(
      Task task, OnboardingStep step, OnboardingInstance instance, EntityInterface entity) {
    applyAssignees(task, OnboardingAssignments.resolve(step, entity, instance));
  }

  /** Hand a stalled task to the gate's fallback role; the marker keeps the move from bouncing back. */
  static void reassign(
      OnboardingInstance instance,
      EntityInterface entity,
      OnboardingTaskBinding binding,
      OnboardingAssignment role) {
    Task task = repository().findCommittedTask(binding.getTaskId());
    if (task == null) return;
    applyAssignees(
        task, OnboardingAssignments.resolve(role, entity, instance, OnboardingReadContext.DIRECT));
  }

  private static void applyAssignees(Task task, List<EntityReference> assignees) {
    if (!TaskRepository.OPEN_TASK_STATUSES.contains(task.getStatus())) return;
    var current = task.getAssignees() == null ? List.<EntityReference>of() : task.getAssignees();
    if (identifiers(assignees).equals(identifiers(current))) return;
    try (var reader = Json.createReader(new StringReader(JsonUtils.pojoToJson(assignees)))) {
      repository()
          .patch(
              null,
              task.getId(),
              OnboardingNotifications.BOT,
              Json.createPatchBuilder().add("/assignees", reader.readArray()).build());
    }
  }

  private static Set<UUID> identifiers(List<EntityReference> references) {
    return references.stream().map(EntityReference::getId).collect(Collectors.toSet());
  }

  private static boolean canStart(OnboardingStep step) {
    if (isFieldCheck(step)) return true;
    try {
      OnboardingConfigurationValidator.workflow(step);
      return true;
    } catch (IllegalArgumentException | EntityNotFoundException unavailableWorkflow) {
      return false;
    }
  }

  static OnboardingTaskBinding binding(OnboardingInstance instance, String stepId) {
    return instance.getBindings().stream()
        .filter(binding -> binding.getStepId().equals(stepId))
        .max(Comparator.comparingInt(OnboardingTaskBinding::getAttempt))
        .orElse(null);
  }
}
