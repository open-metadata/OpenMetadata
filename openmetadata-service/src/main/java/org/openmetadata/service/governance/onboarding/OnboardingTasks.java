package org.openmetadata.service.governance.onboarding;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.json.Json;
import java.io.StringReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.TreeMap;
import java.util.TreeSet;
import java.util.UUID;
import java.util.stream.StreamSupport;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.governance.onboarding.OnboardingInstance;
import org.openmetadata.schema.governance.onboarding.OnboardingStage;
import org.openmetadata.schema.governance.onboarding.OnboardingStep;
import org.openmetadata.schema.governance.onboarding.OnboardingStepResult;
import org.openmetadata.schema.governance.onboarding.OnboardingStepResult.State;
import org.openmetadata.schema.governance.onboarding.OnboardingTaskBinding;
import org.openmetadata.schema.governance.workflows.WorkflowInstance;
import org.openmetadata.schema.type.TaskCategory;
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.schema.type.TaskEntityType;
import org.openmetadata.schema.type.TaskPriority;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.jdbi3.TaskRepository;
import org.openmetadata.service.jdbi3.WorkflowInstanceRepository;
import org.openmetadata.service.tasks.TaskWorkflowLifecycleResolver;
import org.openmetadata.service.tasks.TaskWorkflowLifecycleResolver.TaskWorkflowBinding;
import org.openmetadata.service.util.IntakeFormUtil;

public final class OnboardingTasks {
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
        : OnboardingEvaluator.STAGES.stream()
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
        OnboardingEvaluator.STAGES.stream()
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
        stage.value(),
        "onboardingStepId",
        binding.getStepId(),
        "onboardingAttempt",
        binding.getAttempt());
  }

  public static TaskWorkflowBinding workflowBinding(Task task) {
    OnboardingStep step = stepForTask(task.getId());
    if (step == null || step.getType() != OnboardingStep.Type.APPROVAL) return null;
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
    var step = stepForTask(taskId);
    return step != null && step.getType() == OnboardingStep.Type.FIELD;
  }

  public static void recordDecision(Task task, boolean approved) {
    var instance = OnboardingStore.forTask(task.getId());
    if (instance == null || isFieldTask(task.getId()) || !hasCompletedExecution(task)) return;
    Entity.getCollectionDAO()
        .useTransaction(
            dao -> {
              var locked =
                  OnboardingStore.read(
                      dao.onboardingDAO().lock(instance.getEntity().getId().toString()));
              locked.getBindings().stream()
                  .filter(binding -> binding.getTaskId().equals(task.getId()))
                  .findFirst()
                  .ifPresent(
                      binding ->
                          binding
                              .withApproved(approved)
                              .withDecidedAt(System.currentTimeMillis())
                              .withWorkflowInstanceId(task.getWorkflowInstanceId()));
              OnboardingStore.save(locked);
            });
  }

  private static boolean hasCompletedExecution(Task task) {
    if (task.getWorkflowInstanceId() == null) return false;
    var repository =
        (WorkflowInstanceRepository) Entity.getEntityTimeSeriesRepository(Entity.WORKFLOW_INSTANCE);
    WorkflowInstance execution = repository.getById(task.getWorkflowInstanceId());
    return execution != null
        && execution.getStatus() == WorkflowInstance.WorkflowStatus.FINISHED
        && Objects.equals(execution.getWorkflowDefinitionId(), task.getWorkflowDefinitionId())
        && !WorkflowHandler.getInstance().hasActiveRuntimeTask(task.getId());
  }

  public static void hydrate(
      OnboardingStepResult result, OnboardingInstance instance, EntityInterface entity) {
    if (result.getState() == State.NOT_APPLICABLE) return;
    var binding = binding(instance, result.getStep().getId());
    Task task = binding == null ? null : repository().findCommittedTask(binding.getTaskId());
    if (task != null)
      result.withTaskId(task.getId()).withWorkflowInstanceId(task.getWorkflowInstanceId());
    if (result.getStep().getType() == OnboardingStep.Type.FIELD) {
      result.setAssignees(OnboardingAssignments.resolve(result.getStep(), entity, instance));
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
      hydrateApproval(result, binding, task, instance, entity);
    }
  }

  private static void hydrateApproval(
      OnboardingStepResult result,
      OnboardingTaskBinding binding,
      Task task,
      OnboardingInstance instance,
      EntityInterface entity) {
    if (instance.getStage().ordinal() >= OnboardingStage.APPROVED.ordinal()
        && binding != null
        && Boolean.TRUE.equals(binding.getApproved())
        && binding.getWorkflowInstanceId() != null) {
      result
          .withState(State.COMPLETE)
          .withMessage(null)
          .withTaskId(binding.getTaskId())
          .withWorkflowInstanceId(binding.getWorkflowInstanceId());
      return;
    }
    try {
      OnboardingConfigurationValidator.workflow(result.getStep());
    } catch (RuntimeException exception) {
      result.withState(State.FAILED).withMessage(exception.getMessage());
      return;
    }
    if (task == null) return;
    result.setAssignees(task.getAssignees() == null ? List.of() : task.getAssignees());
    if (!Objects.equals(binding.getFingerprint(), fingerprint(instance, entity))) {
      result.withState(State.PENDING).withMessage("Metadata changed; request a fresh approval");
    } else if (task.getStatus() == TaskEntityStatus.Approved
        && Boolean.TRUE.equals(binding.getApproved())
        && Objects.equals(binding.getWorkflowInstanceId(), task.getWorkflowInstanceId())
        && hasCompletedExecution(task)) {
      result.withState(State.COMPLETE).withMessage(null);
    } else if (task.getStatus() == TaskEntityStatus.Rejected) {
      result.withState(State.REJECTED).withMessage("Approval rejected; revise and resubmit");
    } else if ("workflow-start-failed".equals(task.getWorkflowStageId())
        || TaskRepository.isTerminalStatus(task.getStatus())
        || failedExecution(task)) {
      result
          .withState(State.FAILED)
          .withMessage("Workflow failed; retry after resolving the error");
    } else if (result.getAssignees().isEmpty()) {
      result.withState(State.BLOCKED).withMessage("The workflow has no assignees");
    }
  }

  private static boolean failedExecution(Task task) {
    if (task.getWorkflowInstanceId() == null)
      return task.getUpdatedAt() < System.currentTimeMillis() - 60_000;
    try {
      var repository =
          (WorkflowInstanceRepository)
              Entity.getEntityTimeSeriesRepository(Entity.WORKFLOW_INSTANCE);
      var execution = repository.getById(task.getWorkflowInstanceId());
      return execution == null
          || execution.getStatus() != WorkflowInstance.WorkflowStatus.RUNNING
              && execution.getStatus() != WorkflowInstance.WorkflowStatus.FINISHED;
    } catch (org.openmetadata.service.exception.EntityNotFoundException missingExecution) {
      return true;
    }
  }

  public static void closeAll(OnboardingInstance instance) {
    instance.getBindings().forEach(OnboardingTasks::closeFieldTask);
  }

  public static void reserve(OnboardingInstance instance, EntityInterface entity, boolean retry) {
    if (instance.getStage().ordinal() >= OnboardingStage.APPROVED.ordinal()) return;
    var results =
        OnboardingEvaluator.evaluateThrough(
            instance.getConfiguration(), entity, instance.getStage());
    boolean fieldsReady =
        results.stream()
            .filter(result -> result.getStep().getType() == OnboardingStep.Type.FIELD)
            .noneMatch(result -> result.getRequired() && !OnboardingEvaluator.isSatisfied(result));
    for (var result : results) {
      if (result.getState() == State.NOT_APPLICABLE) continue;
      if (result.getStep().getType() == OnboardingStep.Type.APPROVAL && !fieldsReady) continue;
      if (result.getStep().getType() == OnboardingStep.Type.FIELD
          && OnboardingEvaluator.isSatisfied(result)) continue;
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
              && Objects.equals(previous.getFingerprint(), fingerprint(instance, entity)))) return;
    }
    if (result.getStep().getType() == OnboardingStep.Type.FIELD
        && OnboardingAssignments.resolve(result.getStep(), entity, instance).isEmpty()) return;
    var next =
        new OnboardingTaskBinding()
            .withStepId(result.getStep().getId())
            .withTaskId(UUID.randomUUID())
            .withAttempt(previous == null ? 1 : previous.getAttempt() + 1)
            .withFingerprint(fingerprint(instance, entity));
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
    if (instance.getStage().ordinal() >= OnboardingStage.APPROVED.ordinal()) {
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
          || (result.getStep().getType() == OnboardingStep.Type.FIELD
              && OnboardingEvaluator.isSatisfied(result))) {
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
      if (step.getType() == OnboardingStep.Type.FIELD)
        refreshAssignees(existing, step, instance, entity);
      return;
    }
    boolean approval = step.getType() == OnboardingStep.Type.APPROVAL;
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
            .withUpdatedBy("governance-bot")
            .withUpdatedAt(System.currentTimeMillis())
            .withCreatedAt(System.currentTimeMillis())
            .withAssignees(
                approval ? List.of() : OnboardingAssignments.resolve(step, entity, instance))
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
      repository().closeTask(task, "governance-bot", "Onboarding check satisfied or superseded");
  }

  private static void refreshAssignees(
      Task task, OnboardingStep step, OnboardingInstance instance, EntityInterface entity) {
    if (!TaskRepository.OPEN_TASK_STATUSES.contains(task.getStatus())) return;
    var assignees = OnboardingAssignments.resolve(step, entity, instance);
    var current =
        task.getAssignees() == null
            ? List.<org.openmetadata.schema.type.EntityReference>of()
            : task.getAssignees();
    var ids =
        assignees.stream()
            .map(org.openmetadata.schema.type.EntityReference::getId)
            .collect(java.util.stream.Collectors.toSet());
    if (ids.equals(
        current.stream()
            .map(org.openmetadata.schema.type.EntityReference::getId)
            .collect(java.util.stream.Collectors.toSet()))) return;
    try (var reader = Json.createReader(new StringReader(JsonUtils.pojoToJson(assignees)))) {
      repository()
          .patch(
              null,
              task.getId(),
              "governance-bot",
              Json.createPatchBuilder().add("/assignees", reader.readArray()).build());
    }
  }

  private static boolean canStart(OnboardingStep step) {
    if (step.getType() == OnboardingStep.Type.FIELD) return true;
    try {
      OnboardingConfigurationValidator.workflow(step);
      return true;
    } catch (IllegalArgumentException
        | org.openmetadata.service.exception.EntityNotFoundException unavailableWorkflow) {
      return false;
    }
  }

  private static OnboardingTaskBinding binding(OnboardingInstance instance, String stepId) {
    return instance.getBindings().stream()
        .filter(binding -> binding.getStepId().equals(stepId))
        .max(Comparator.comparingInt(OnboardingTaskBinding::getAttempt))
        .orElse(null);
  }

  static String fingerprint(OnboardingInstance instance, EntityInterface entity) {
    var values = JsonUtils.valueToTree(entity);
    Map<String, Object> captured = new TreeMap<>();
    var paths = new TreeSet<>(List.of("domains", "tags", "owners", "reviewers", "experts"));
    paths.addAll(OnboardingConfigurationValidator.creationFields(instance.getEntity().getType()));
    IntakeFormUtil.getEffectiveFormFields(instance.getConfiguration())
        .forEach(field -> paths.add(field.getFieldPath()));
    instance
        .getConfiguration()
        .getOnboarding()
        .getGates()
        .forEach(
            gate ->
                gate.getSteps()
                    .forEach(
                        step -> {
                          if (step.getConditions() != null)
                            step.getConditions()
                                .forEach(condition -> paths.add(condition.getFieldPath()));
                        }));
    paths.forEach(
        path -> captured.put(path, canonicalValue(OnboardingEvaluator.valueAt(values, path))));
    return UUID.nameUUIDFromBytes(JsonUtils.pojoToJson(captured).getBytes(StandardCharsets.UTF_8))
        .toString();
  }

  private static Object canonicalValue(JsonNode value) {
    if (value == null || value.isMissingNode() || value.isNull()) return null;
    if (value.isArray()) {
      List<Object> items = new ArrayList<>();
      value.forEach(item -> items.add(canonicalValue(item)));
      if (StreamSupport.stream(value.spliterator(), false)
          .allMatch(OnboardingTasks::isRelationshipValue)) {
        items.sort(Comparator.comparing(JsonUtils::pojoToJson));
      }
      return items;
    }
    if (value.isObject()) {
      if (value.hasNonNull("id") && value.hasNonNull("type"))
        return Map.of("id", value.get("id").asText(), "type", value.get("type").asText());
      if (value.hasNonNull("tagFQN")) return value.get("tagFQN").asText();
      Map<String, Object> fields = new TreeMap<>();
      value
          .fields()
          .forEachRemaining(field -> fields.put(field.getKey(), canonicalValue(field.getValue())));
      return fields;
    }
    return value;
  }

  private static boolean isRelationshipValue(JsonNode value) {
    return value.hasNonNull("tagFQN") || (value.hasNonNull("id") && value.hasNonNull("type"));
  }
}
