/*
 *  Copyright 2024 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.governance.workflows.elements.nodes.userTask;

import static org.openmetadata.service.governance.workflows.Workflow.EXCEPTION_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.GLOBAL_NAMESPACE;
import static org.openmetadata.service.governance.workflows.Workflow.RECOGNIZER_FEEDBACK;
import static org.openmetadata.service.governance.workflows.Workflow.RELATED_ENTITY_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.WORKFLOW_RUNTIME_EXCEPTION;
import static org.openmetadata.service.governance.workflows.WorkflowHandler.getProcessDefinitionKeyFromId;

import io.github.resilience4j.core.IntervalFunction;
import io.github.resilience4j.retry.Retry;
import io.github.resilience4j.retry.RetryConfig;
import java.time.Duration;
import java.time.Period;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.exception.ExceptionUtils;
import org.flowable.common.engine.api.FlowableObjectNotFoundException;
import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.engine.RuntimeService;
import org.flowable.engine.delegate.BpmnError;
import org.flowable.engine.delegate.TaskListener;
import org.flowable.engine.runtime.Execution;
import org.flowable.identitylink.api.IdentityLink;
import org.flowable.task.service.delegate.DelegateTask;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.RecognizerFeedback;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TagLabelRecognizerMetadata;
import org.openmetadata.schema.type.TaskAvailableTransition;
import org.openmetadata.schema.type.TaskCategory;
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.schema.type.TaskEntityType;
import org.openmetadata.schema.type.TaskExternalReference;
import org.openmetadata.schema.type.TaskPriority;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.governance.workflows.WorkflowVariableHandler;
import org.openmetadata.service.governance.workflows.elements.TriggerFactory;
import org.openmetadata.service.governance.workflows.elements.nodes.userTask.helper.WorkflowVariableResolver;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.TaskRepository;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.tasks.TaskWorkflowLifecycleResolver;
import org.openmetadata.service.util.AsyncService;
import org.openmetadata.service.util.WebsocketNotificationHandler;

/**
 * Flowable TaskListener that creates a Task entity (new system) when a workflow reaches an
 * approval node. This replaces CreateApprovalTaskImpl for the new Task entity system.
 *
 * <p>Key differences from the legacy CreateApprovalTaskImpl:
 * - Creates Task entity instead of Thread entity
 * - Uses TaskRepository instead of FeedRepository
 * - Links task to WorkflowInstance via workflowInstanceId
 * - Cleaner separation from Feed/Thread complexity
 */
@Slf4j
public class CreateTask implements TaskListener {
  static final String PENDING_WORKFLOW_START_STAGE_ID = "pending-workflow-start";
  private static final String DEFAULT_SYSTEM_USER = "admin";
  private static final String SUPERSEDED_BY_NEWER_RUN =
      "Superseded by a newer approval workflow run for the same entity";
  private static final int WORKFLOW_MANAGED_DRAFT_LOOKUP_MAX_ATTEMPTS = 6;
  private static final long INITIAL_WORKFLOW_MANAGED_DRAFT_LOOKUP_DELAY_MILLIS = 25L;
  private static final long MAX_WORKFLOW_MANAGED_DRAFT_LOOKUP_DELAY_MILLIS = 250L;
  private static final IntervalFunction WORKFLOW_MANAGED_DRAFT_LOOKUP_INTERVAL_FUNCTION =
      attempt -> {
        long retryDelayMillis =
            INITIAL_WORKFLOW_MANAGED_DRAFT_LOOKUP_DELAY_MILLIS << Math.max(0, (int) attempt - 1);
        return Math.min(retryDelayMillis, MAX_WORKFLOW_MANAGED_DRAFT_LOOKUP_DELAY_MILLIS);
      };
  private static final RetryConfig WORKFLOW_MANAGED_DRAFT_LOOKUP_RETRY_CONFIG =
      RetryConfig.<Task>custom()
          .maxAttempts(WORKFLOW_MANAGED_DRAFT_LOOKUP_MAX_ATTEMPTS)
          .intervalFunction(WORKFLOW_MANAGED_DRAFT_LOOKUP_INTERVAL_FUNCTION)
          .retryOnResult(task -> task == null)
          .failAfterMaxAttempts(false)
          .build();
  private Expression inputNamespaceMapExpr;
  private Expression assigneesVarNameExpr;
  private Expression approvalThresholdExpr;
  private Expression rejectionThresholdExpr;
  private Expression taskTypeExpr;
  private Expression taskCategoryExpr;
  private Expression stageIdExpr;
  private Expression stageDisplayNameExpr;
  private Expression taskStatusExpr;
  private Expression transitionMetadataExpr;

  @Override
  public void notify(DelegateTask delegateTask) {
    WorkflowVariableHandler varHandler = new WorkflowVariableHandler(delegateTask);
    try {
      Map<String, String> inputNamespaceMap =
          JsonUtils.readOrConvertValue(inputNamespaceMapExpr.getValue(delegateTask), Map.class);
      List<EntityReference> assignees = getAssignees(delegateTask);
      MessageParser.EntityLink entityLink =
          MessageParser.EntityLink.parse(
              (String)
                  varHandler.getNamespacedVariable(
                      inputNamespaceMap.get(RELATED_ENTITY_VARIABLE), RELATED_ENTITY_VARIABLE));
      EntityInterface entity = Entity.getEntity(entityLink, "*", Include.ALL);

      // Get approval threshold, default to 1 if not set
      Integer approvalThreshold =
          WorkflowVariableResolver.getThresholdValue(approvalThresholdExpr, delegateTask, 1);
      Integer rejectionThreshold =
          WorkflowVariableResolver.getThresholdValue(rejectionThresholdExpr, delegateTask, 1);

      // Get task type and category
      TaskEntityType taskType = getTaskType(delegateTask);
      TaskCategory taskCategory = getTaskCategory(delegateTask);

      // Get workflow instance ID from the process
      UUID workflowInstanceId = getWorkflowInstanceId(delegateTask);

      // Build workflow-specific payload for task types that need richer context.
      Object payload = buildWorkflowPayload(taskType, inputNamespaceMap, varHandler);

      // Create or update the Task entity for the current workflow stage
      Task task =
          createOrUpdateTask(
              delegateTask,
              entity,
              assignees,
              taskType,
              taskCategory,
              workflowInstanceId,
              approvalThreshold,
              rejectionThreshold,
              payload);

      if (task == null) {
        return;
      }

      // Register with WorkflowHandler for resolution
      WorkflowHandler.getInstance().setCustomTaskId(delegateTask.getId(), task.getId());

      // Set the thresholds as task variables for use in WorkflowHandler
      delegateTask.setVariable("approvalThreshold", approvalThreshold);
      delegateTask.setVariable("rejectionThreshold", rejectionThreshold);
      delegateTask.setVariable("approversList", new ArrayList<String>());
      delegateTask.setVariable("rejectersList", new ArrayList<String>());
      delegateTask.setVariable("taskEntityId", task.getId().toString());

      LOG.info(
          "[CreateTask] Created Task entity: id='{}', taskId='{}', type='{}', workflowInstanceId='{}'",
          task.getId(),
          task.getTaskId(),
          taskType,
          workflowInstanceId);

    } catch (Exception exc) {
      LOG.error(
          String.format(
              "[%s] Failure: ",
              getProcessDefinitionKeyFromId(delegateTask.getProcessDefinitionId())),
          exc);
      varHandler.setGlobalVariable(EXCEPTION_VARIABLE, ExceptionUtils.getStackTrace(exc));
      throw new BpmnError(WORKFLOW_RUNTIME_EXCEPTION, exc.getMessage());
    }
  }

  private TaskEntityType getTaskType(DelegateTask delegateTask) {
    String variableTaskType = WorkflowVariableResolver.stringVariable(delegateTask, "taskType");
    if (variableTaskType != null && !variableTaskType.isEmpty()) {
      return TaskEntityType.fromValue(variableTaskType);
    }

    if (taskTypeExpr != null) {
      String typeStr = (String) taskTypeExpr.getValue(delegateTask);
      if (typeStr != null && !typeStr.isEmpty()) {
        return TaskEntityType.fromValue(typeStr);
      }
    }

    TaskEntityType inferredTaskType = inferTaskTypeFromWorkflow(delegateTask);
    if (inferredTaskType != null) {
      return inferredTaskType;
    }

    return TaskEntityType.GlossaryApproval; // Default for backward compatibility
  }

  private TaskCategory getTaskCategory(DelegateTask delegateTask) {
    String variableTaskCategory =
        WorkflowVariableResolver.stringVariable(delegateTask, "taskCategory");
    if (variableTaskCategory != null && !variableTaskCategory.isEmpty()) {
      return TaskCategory.fromValue(variableTaskCategory);
    }

    if (taskCategoryExpr != null) {
      String categoryStr = (String) taskCategoryExpr.getValue(delegateTask);
      if (categoryStr != null && !categoryStr.isEmpty()) {
        return TaskCategory.fromValue(categoryStr);
      }
    }

    TaskEntityType inferredTaskType = inferTaskTypeFromWorkflow(delegateTask);
    if (inferredTaskType != null) {
      return TaskWorkflowLifecycleResolver.defaultTaskCategoryForWorkflowDefinitionRef(
          inferredTaskType == TaskEntityType.CustomTask
              ? "CustomTaskWorkflow"
              : inferWorkflowDefinitionRef(delegateTask));
    }

    return TaskCategory.Approval; // Default for backward compatibility
  }

  private TaskEntityType inferTaskTypeFromWorkflow(DelegateTask delegateTask) {
    String workflowDefinitionRef = inferWorkflowDefinitionRef(delegateTask);
    if (workflowDefinitionRef == null || workflowDefinitionRef.isBlank()) {
      return null;
    }

    return TaskWorkflowLifecycleResolver.defaultTaskTypeForWorkflowDefinitionRef(
        workflowDefinitionRef);
  }

  private String inferWorkflowDefinitionRef(DelegateTask delegateTask) {
    String processDefinitionKey =
        getProcessDefinitionKeyFromId(delegateTask.getProcessDefinitionId());
    if (processDefinitionKey == null || processDefinitionKey.isBlank()) {
      return null;
    }

    return processDefinitionKey.endsWith("Trigger")
        ? TriggerFactory.getMainWorkflowDefinitionNameFromTrigger(processDefinitionKey)
        : processDefinitionKey;
  }

  private UUID resolveWorkflowDefinitionId(
      DelegateTask delegateTask, String workflowDefinitionIdValue) {
    if (workflowDefinitionIdValue != null && !workflowDefinitionIdValue.isBlank()) {
      return UUID.fromString(workflowDefinitionIdValue);
    }

    String workflowDefinitionRef = inferWorkflowDefinitionRef(delegateTask);
    if (workflowDefinitionRef == null || workflowDefinitionRef.isBlank()) {
      return null;
    }

    WorkflowDefinition workflowDefinition =
        Entity.findByNameOrNull(
            Entity.WORKFLOW_DEFINITION, workflowDefinitionRef, Include.NON_DELETED);
    return workflowDefinition != null ? workflowDefinition.getId() : null;
  }

  private UUID getWorkflowInstanceId(DelegateTask delegateTask) {
    // First prefer an explicit runtime variable when one is present.
    Object workflowInstanceIdObj = delegateTask.getVariable("workflowInstanceId");
    if (workflowInstanceIdObj != null) {
      return UUID.fromString(workflowInstanceIdObj.toString());
    }

    String processInstanceId = delegateTask.getProcessInstanceId();
    if (processInstanceId == null || processInstanceId.isBlank()) {
      return null;
    }

    org.flowable.engine.runtime.ProcessInstance processInstance =
        WorkflowHandler.getInstance()
            .getRuntimeService()
            .createProcessInstanceQuery()
            .processInstanceId(processInstanceId)
            .singleResult();

    String businessKey = processInstance != null ? processInstance.getBusinessKey() : null;
    if (businessKey == null || businessKey.isBlank()) {
      return null;
    }

    return UUID.fromString(businessKey);
  }

  private List<EntityReference> getAssignees(DelegateTask delegateTask) {
    List<EntityReference> assignees = new ArrayList<>();

    // Read assignees from the workflow variable set by SetApprovalAssigneesImpl.
    // This is more reliable than getCandidates() which may not reflect candidates
    // added by earlier task listeners in the same "create" event.
    if (assigneesVarNameExpr != null) {
      String varName = assigneesVarNameExpr.getValue(delegateTask).toString();
      Object varValue = delegateTask.getVariable(varName);
      LOG.info(
          "[CreateTask] Reading assignees: varName='{}', varValue type='{}', varValue='{}'",
          varName,
          varValue != null ? varValue.getClass().getName() : "null",
          varValue);
      if (varValue != null) {
        List<String> assigneeLinks;
        if (varValue instanceof String) {
          assigneeLinks = JsonUtils.readValue((String) varValue, List.class);
        } else {
          assigneeLinks = JsonUtils.readOrConvertValue(varValue, List.class);
        }
        if (assigneeLinks != null) {
          for (String link : assigneeLinks) {
            try {
              assignees.add(getEntityReferenceFromLinkString(link));
            } catch (Exception e) {
              LOG.warn("[CreateTask] Failed to resolve assignee '{}': {}", link, e.getMessage());
            }
          }
        }
      }
    }

    // Fallback to Flowable task candidates/assignee
    if (assignees.isEmpty()) {
      Set<IdentityLink> candidates = delegateTask.getCandidates();
      if (!candidates.isEmpty()) {
        for (IdentityLink candidate : candidates) {
          try {
            assignees.add(getEntityReferenceFromLinkString(candidate.getUserId()));
          } catch (Exception e) {
            LOG.warn(
                "[CreateTask] Failed to resolve candidate '{}': {}",
                candidate.getUserId(),
                e.getMessage());
          }
        }
      } else if (delegateTask.getAssignee() != null) {
        assignees.add(getEntityReferenceFromLinkString(delegateTask.getAssignee()));
      }
    }

    return assignees;
  }

  private EntityReference getEntityReferenceFromLinkString(String entityLinkString) {
    MessageParser.EntityLink assigneeEntityLink = MessageParser.EntityLink.parse(entityLinkString);
    return Entity.getEntityReferenceByName(
        assigneeEntityLink.getEntityType(), assigneeEntityLink.getEntityFQN(), Include.NON_DELETED);
  }

  private Task createOrUpdateTask(
      DelegateTask delegateTask,
      EntityInterface entity,
      List<EntityReference> assignees,
      TaskEntityType taskType,
      TaskCategory taskCategory,
      UUID workflowInstanceId,
      Integer approvalThreshold,
      Integer rejectionThreshold,
      Object payload) {

    TaskRepository taskRepository = (TaskRepository) Entity.getEntityRepository(Entity.TASK);
    UUID requestedTaskId = resolveRequestedTaskId(delegateTask);
    String taskName = WorkflowVariableResolver.stringVariable(delegateTask, "taskName");
    String taskDisplayName =
        WorkflowVariableResolver.stringVariable(delegateTask, "taskDisplayName");
    String taskDescription =
        WorkflowVariableResolver.stringVariable(delegateTask, "taskDescription");
    TaskPriority requestedPriority = resolveTaskPriority(delegateTask);
    Object requestedPayload =
        WorkflowVariableResolver.workflowObjectVariable(delegateTask, "taskPayload");
    Long requestedDueDate = WorkflowVariableResolver.longVariable(delegateTask, "taskDueDate");
    Object requestedExternalReference =
        WorkflowVariableResolver.workflowObjectVariable(delegateTask, "taskExternalReference");
    Object requestedTags =
        WorkflowVariableResolver.workflowObjectVariable(delegateTask, "taskTags");
    List<EntityReference> requestedReviewers =
        WorkflowVariableResolver.entityReferencesVariable(delegateTask, "taskReviewers");
    List<EntityReference> requestedAssignees =
        WorkflowVariableResolver.entityReferencesVariable(delegateTask, "taskAssignees");
    EntityReference requestedCreatedBy =
        WorkflowVariableResolver.entityReferenceVariable(delegateTask, "taskCreatedBy");
    String requestedUpdatedBy =
        WorkflowVariableResolver.stringVariable(delegateTask, "taskUpdatedBy");
    String workflowDefinitionId =
        WorkflowVariableResolver.stringVariable(delegateTask, "workflowDefinitionId");
    UUID resolvedWorkflowDefinitionId =
        resolveWorkflowDefinitionId(delegateTask, workflowDefinitionId);
    boolean workflowManagedDraftTask =
        WorkflowVariableResolver.booleanVariable(delegateTask, "taskWorkflowManaged");
    String taskFormSchemaId =
        WorkflowVariableResolver.stringVariable(delegateTask, "taskFormSchemaId");
    Double taskFormSchemaVersion =
        WorkflowVariableResolver.doubleVariable(delegateTask, "taskFormSchemaVersion");
    String workflowStageId = WorkflowVariableResolver.stringExpression(stageIdExpr, delegateTask);
    String workflowStageDisplayName =
        WorkflowVariableResolver.stringExpression(stageDisplayNameExpr, delegateTask);
    TaskEntityStatus stageStatus = resolveStageStatus(delegateTask);
    List<TaskAvailableTransition> availableTransitions =
        TaskWorkflowLifecycleResolver.parseTransitions(
            transitionMetadataExpr != null ? transitionMetadataExpr.getValue(delegateTask) : null);
    if (availableTransitions.isEmpty()) {
      availableTransitions =
          TaskWorkflowLifecycleResolver.resolveTransitionsForStage(
              resolvedWorkflowDefinitionId, workflowStageId);
    }

    // Build the about reference
    EntityReference aboutRef =
        new EntityReference()
            .withId(entity.getId())
            .withType(Entity.getEntityTypeFromObject(entity))
            .withName(entity.getName())
            .withFullyQualifiedName(entity.getFullyQualifiedName());

    // Build createdBy reference
    EntityReference createdByRef = resolveCreatedByReference(requestedCreatedBy, entity, payload);
    String updatedBy =
        requestedUpdatedBy != null && !requestedUpdatedBy.isBlank()
            ? requestedUpdatedBy
            : resolveUpdatedBy(entity, createdByRef);

    Task existingTask =
        findExistingTaskWithRetry(taskRepository, requestedTaskId, workflowManagedDraftTask);
    if (shouldSkipDeletedWorkflowManagedDraftTask(
        requestedTaskId, workflowManagedDraftTask, existingTask)) {
      terminateDeletedWorkflowManagedDraftTask(delegateTask, requestedTaskId);
      return null;
    }
    if (existingTask != null) {
      LOG.info(
          "[CreateTask] Updating existing task '{}' stage='{}' workflowAssignees={} requestedAssignees={}",
          existingTask.getId(),
          existingTask.getWorkflowStageId(),
          assignees != null ? assignees.stream().map(EntityReference::getName).toList() : null,
          requestedAssignees != null
              ? requestedAssignees.stream().map(EntityReference::getName).toList()
              : null);
      Task currentTask =
          taskRepository.get(null, existingTask.getId(), taskRepository.getFields("*"));
      Task updatedTask = JsonUtils.deepCopy(currentTask, Task.class);
      UUID effectiveWorkflowDefinitionId =
          resolvedWorkflowDefinitionId != null
              ? resolvedWorkflowDefinitionId
              : currentTask.getWorkflowDefinitionId();
      if (availableTransitions.isEmpty()) {
        availableTransitions =
            TaskWorkflowLifecycleResolver.resolveTransitionsForStage(
                effectiveWorkflowDefinitionId, workflowStageId);
      }
      List<EntityReference> resolvedAssignees =
          resolveExistingTaskAssignees(currentTask, assignees, requestedAssignees);
      boolean preserveTerminalWorkflowState = isTerminalTaskStatus(currentTask.getStatus());
      if (!preserveTerminalWorkflowState) {
        updatedTask.setStatus(stageStatus != null ? stageStatus : updatedTask.getStatus());
        updatedTask.setWorkflowStageId(workflowStageId);
        updatedTask.setWorkflowStageDisplayName(
            workflowStageDisplayName != null ? workflowStageDisplayName : workflowStageId);
        updatedTask.setAvailableTransitions(availableTransitions);
      }
      if (resolvedAssignees != null) {
        updatedTask.setAssignees(resolvedAssignees);
      }
      if (requestedReviewers != null) {
        updatedTask.setReviewers(requestedReviewers);
      }
      updatedTask.setWorkflowInstanceId(
          workflowInstanceId != null ? workflowInstanceId : updatedTask.getWorkflowInstanceId());
      updatedTask.setUpdatedAt(System.currentTimeMillis());
      updatedTask.setUpdatedBy(updatedBy);
      updatedTask.setPayload(
          requestedPayload != null ? requestedPayload : updatedTask.getPayload());
      if (effectiveWorkflowDefinitionId != null) {
        updatedTask.setWorkflowDefinitionId(effectiveWorkflowDefinitionId);
      }
      if (taskFormSchemaId != null && !taskFormSchemaId.isBlank()) {
        updatedTask.setTaskFormSchemaId(UUID.fromString(taskFormSchemaId));
      }
      if (taskFormSchemaVersion != null) {
        updatedTask.setTaskFormSchemaVersion(taskFormSchemaVersion);
      }
      if (taskName != null && !taskName.isBlank()) {
        updatedTask.setName(taskName);
      }
      if (taskDisplayName != null && !taskDisplayName.isBlank()) {
        updatedTask.setDisplayName(taskDisplayName);
      }
      if (taskDescription != null && !taskDescription.isBlank()) {
        updatedTask.setDescription(taskDescription);
      }
      if (requestedPriority != null) {
        updatedTask.setPriority(requestedPriority);
      }
      Long effectiveDueDate =
          resolveEffectiveDueDate(stageStatus, requestedPayload, requestedDueDate);
      if (effectiveDueDate != null) {
        updatedTask.setDueDate(effectiveDueDate);
      }
      updatedTask.setPayload(withGrantExpirationDate(stageStatus, updatedTask.getPayload()));
      if (requestedExternalReference != null) {
        updatedTask.setExternalReference(
            JsonUtils.convertValue(requestedExternalReference, TaskExternalReference.class));
      }
      if (requestedTags != null) {
        updatedTask.setTags(
            JsonUtils.convertValue(
                requestedTags,
                new com.fasterxml.jackson.core.type.TypeReference<List<TagLabel>>() {}));
      }

      return taskRepository.update(null, currentTask, updatedTask, updatedBy).getEntity();
    }

    // Create the task
    Task task =
        new Task()
            .withId(requestedTaskId != null ? requestedTaskId : UUID.randomUUID())
            .withType(taskType)
            .withCategory(taskCategory)
            .withStatus(stageStatus != null ? stageStatus : TaskEntityStatus.Open)
            .withPriority(requestedPriority != null ? requestedPriority : TaskPriority.Medium)
            .withAbout(aboutRef)
            .withAssignees(
                requestedAssignees != null && !requestedAssignees.isEmpty()
                    ? requestedAssignees
                    : assignees)
            .withReviewers(requestedReviewers)
            .withCreatedBy(createdByRef)
            .withWorkflowInstanceId(workflowInstanceId)
            .withWorkflowStageId(workflowStageId)
            .withWorkflowStageDisplayName(
                workflowStageDisplayName != null ? workflowStageDisplayName : workflowStageId)
            .withAvailableTransitions(availableTransitions)
            .withDescription(
                taskDescription != null ? taskDescription : buildTaskDescription(entity, taskType))
            .withPayload(requestedPayload != null ? requestedPayload : payload)
            .withCreatedAt(System.currentTimeMillis())
            .withUpdatedAt(System.currentTimeMillis())
            .withUpdatedBy(updatedBy);

    if (taskName != null && !taskName.isBlank()) {
      task.setName(taskName);
    }
    if (taskDisplayName != null && !taskDisplayName.isBlank()) {
      task.setDisplayName(taskDisplayName);
    }
    if (resolvedWorkflowDefinitionId != null) {
      task.setWorkflowDefinitionId(resolvedWorkflowDefinitionId);
    }
    if (taskFormSchemaId != null && !taskFormSchemaId.isBlank()) {
      task.setTaskFormSchemaId(UUID.fromString(taskFormSchemaId));
    }
    if (taskFormSchemaVersion != null) {
      task.setTaskFormSchemaVersion(taskFormSchemaVersion);
    }
    Long effectiveDueDate =
        resolveEffectiveDueDate(stageStatus, requestedPayload, requestedDueDate);
    if (effectiveDueDate != null) {
      task.setDueDate(effectiveDueDate);
    }
    task.setPayload(withGrantExpirationDate(stageStatus, task.getPayload()));
    if (requestedExternalReference != null) {
      task.setExternalReference(
          JsonUtils.convertValue(requestedExternalReference, TaskExternalReference.class));
    }
    if (requestedTags != null) {
      task.setTags(
          JsonUtils.convertValue(
              requestedTags,
              new com.fasterxml.jackson.core.type.TypeReference<List<TagLabel>>() {}));
    }

    // Use the repository to create (handles taskId generation, FQN, relationships)
    task = taskRepository.create(null, task);

    // Create and publish ChangeEvent for notification system
    ChangeEvent changeEvent =
        new ChangeEvent()
            .withId(UUID.randomUUID())
            .withEventType(EventType.ENTITY_CREATED)
            .withEntityId(task.getId())
            .withEntityType(Entity.TASK)
            .withEntityFullyQualifiedName(task.getFullyQualifiedName())
            .withUserName(updatedBy)
            .withTimestamp(task.getUpdatedAt())
            .withEntity(task);

    Entity.getCollectionDAO().changeEventDAO().insert(JsonUtils.pojoToMaskedJson(changeEvent));

    // Send WebSocket Notification
    WebsocketNotificationHandler.handleTaskNotification(task);

    // Supersede any approval task still open from an earlier run of the same workflow, AFTER the
    // new
    // task has been created, so a rollback of the new-task transaction can't leave the prior run's
    // Flowable process terminated behind a still-open OM task. One live approval per (entity,
    // workflow) is the invariant.
    supersedePriorApprovalTask(
        delegateTask,
        taskRepository,
        entity,
        taskCategory,
        resolvedWorkflowDefinitionId,
        workflowInstanceId,
        updatedBy);

    return task;
  }

  private void supersedePriorApprovalTask(
      DelegateTask delegateTask,
      TaskRepository taskRepository,
      EntityInterface entity,
      TaskCategory taskCategory,
      UUID currentWorkflowDefinitionId,
      UUID currentWorkflowInstanceId,
      String updatedBy) {
    // Best-effort cleanup: failing to supersede a prior task must never abort creation of the new
    // approval task, so all exceptions are contained here instead of bubbling up as a BpmnError.
    if (taskCategory == TaskCategory.Approval) {
      try {
        taskRepository
            .listNonTerminalTasksByEntityAndCategory(entity.getFullyQualifiedName(), taskCategory)
            .stream()
            .filter(
                prior ->
                    isSupersedablePriorApprovalTask(
                        prior, currentWorkflowDefinitionId, currentWorkflowInstanceId))
            .forEach(
                prior ->
                    cancelAndTerminatePriorApproval(
                        delegateTask, taskRepository, prior, updatedBy));
      } catch (Exception e) {
        LOG.warn(
            "[CreateTask] Failed to supersede prior approval task(s) for entity '{}': {}",
            entity.getFullyQualifiedName(),
            e.getMessage());
      }
    }
  }

  static boolean isSupersedablePriorApprovalTask(
      Task prior, UUID currentWorkflowDefinitionId, UUID currentWorkflowInstanceId) {
    return prior != null
        && currentWorkflowInstanceId != null
        && currentWorkflowDefinitionId != null
        && prior.getWorkflowInstanceId() != null
        && !isTerminalTaskStatus(prior.getStatus())
        && !prior.getWorkflowInstanceId().equals(currentWorkflowInstanceId)
        && currentWorkflowDefinitionId.equals(prior.getWorkflowDefinitionId());
  }

  private void cancelAndTerminatePriorApproval(
      DelegateTask delegateTask, TaskRepository taskRepository, Task prior, String updatedBy) {
    LOG.info(
        "[CreateTask] Superseding prior approval task '{}' (workflowInstance '{}') with a newer run",
        prior.getId(),
        prior.getWorkflowInstanceId());
    taskRepository.closeTask(prior, updatedBy, SUPERSEDED_BY_NEWER_RUN);
    dispatchPriorInstanceTermination(
        inferWorkflowDefinitionRef(delegateTask), prior.getId(), prior.getWorkflowInstanceId());
  }

  private void dispatchPriorInstanceTermination(
      String mainWorkflowName, UUID priorTaskId, UUID priorInstanceId) {
    // Run on the shared async executor in its own transaction, so terminating the superseded
    // Flowable process can never poison the current task-creation transaction. The async path first
    // re-reads the prior task and only deletes the process once the cancellation has actually
    // committed: if the task-creation transaction rolled back, the prior task is still open, so we
    // leave its process intact rather than orphaning a still-open approval.
    CompletableFuture.runAsync(
            () -> terminateSupersededInstance(mainWorkflowName, priorTaskId, priorInstanceId),
            AsyncService.getInstance().getExecutorService())
        .exceptionally(
            ex -> {
              LOG.error(
                  "[CreateTask] Failed to terminate superseded workflow instance '{}'",
                  priorInstanceId,
                  ex);
              return null;
            });
  }

  private void terminateSupersededInstance(
      String mainWorkflowName, UUID priorTaskId, UUID priorInstanceId) {
    TaskRepository taskRepository = (TaskRepository) Entity.getEntityRepository(Entity.TASK);
    Task prior = taskRepository.find(priorTaskId, Include.ALL);
    if (isTerminalTaskStatus(prior.getStatus())) {
      WorkflowHandler.getInstance()
          .terminateWorkflowInstance(priorInstanceId, mainWorkflowName, SUPERSEDED_BY_NEWER_RUN);
    } else {
      LOG.debug(
          "[CreateTask] Prior approval task '{}' is no longer cancelled (status={}); "
              + "leaving its workflow process intact",
          priorTaskId,
          prior.getStatus());
    }
  }

  static List<EntityReference> resolveExistingTaskAssignees(
      Task existingTask,
      List<EntityReference> workflowAssignees,
      List<EntityReference> requestedAssignees) {
    List<EntityReference> existingAssignees = existingTask.getAssignees();
    boolean hasExistingAssignees = existingAssignees != null && !existingAssignees.isEmpty();

    // For API-created workflow-managed tasks, taskAssignees is seeded into the workflow start
    // variables. Subsequent workflow callbacks must not overwrite the task row's current
    // assignees with BPMN candidate users or the original start-variable snapshot; the persisted
    // task row is the source of truth once assignees are present.
    if (requestedAssignees != null && !requestedAssignees.isEmpty() && hasExistingAssignees) {
      return null;
    }

    if (workflowAssignees != null && !workflowAssignees.isEmpty()) {
      return workflowAssignees;
    }

    if (requestedAssignees != null && !requestedAssignees.isEmpty() && !hasExistingAssignees) {
      return requestedAssignees;
    }

    return existingAssignees;
  }

  static boolean isTerminalTaskStatus(TaskEntityStatus status) {
    return status != null
        && status != TaskEntityStatus.Open
        && status != TaskEntityStatus.InProgress
        && status != TaskEntityStatus.Pending
        && status != TaskEntityStatus.Approved
        && status != TaskEntityStatus.Granted;
  }

  static boolean shouldSkipDeletedWorkflowManagedDraftTask(
      UUID requestedTaskId, boolean workflowManagedDraftTask, Task existingTask) {
    return workflowManagedDraftTask && requestedTaskId != null && existingTask == null;
  }

  static Task findExistingTaskWithRetry(
      TaskRepository taskRepository, UUID requestedTaskId, boolean workflowManagedDraftTask) {
    if (requestedTaskId == null) {
      return null;
    }

    Supplier<Task> lookupTask =
        () -> {
          try {
            return taskRepository.find(requestedTaskId, Include.ALL);
          } catch (EntityNotFoundException ignored) {
            LOG.debug(
                "[CreateTask] Task '{}' not visible yet during workflow callback", requestedTaskId);
            return null;
          }
        };

    if (!workflowManagedDraftTask) {
      return lookupTask.get();
    }

    Task existingTask =
        Retry.decorateSupplier(
                Retry.of(
                    "workflowManagedDraftTaskLookup", WORKFLOW_MANAGED_DRAFT_LOOKUP_RETRY_CONFIG),
                lookupTask)
            .get();

    if (existingTask == null) {
      LOG.info(
          "[CreateTask] Workflow-managed draft task '{}' remained unavailable after {} lookup attempts",
          requestedTaskId,
          WORKFLOW_MANAGED_DRAFT_LOOKUP_MAX_ATTEMPTS);
    }

    return existingTask;
  }

  private UUID resolveRequestedTaskId(DelegateTask delegateTask) {
    String taskId = WorkflowVariableResolver.stringVariable(delegateTask, "taskEntityId");
    if (taskId != null && !taskId.isBlank()) {
      return UUID.fromString(taskId);
    }

    String processInstanceId = delegateTask.getProcessInstanceId();
    if (processInstanceId == null || processInstanceId.isBlank()) {
      return null;
    }

    org.flowable.engine.runtime.ProcessInstance processInstance =
        WorkflowHandler.getInstance()
            .getRuntimeService()
            .createProcessInstanceQuery()
            .processInstanceId(processInstanceId)
            .singleResult();
    String businessKey = processInstance != null ? processInstance.getBusinessKey() : null;

    if (businessKey == null || businessKey.isBlank()) {
      return null;
    }

    LOG.debug(
        "[CreateTask] Falling back to process business key '{}' as requested task id", businessKey);

    return UUID.fromString(businessKey);
  }

  private TaskEntityStatus resolveStageStatus(DelegateTask delegateTask) {
    String stageStatus = WorkflowVariableResolver.stringExpression(taskStatusExpr, delegateTask);
    if (stageStatus == null || stageStatus.isBlank()) {
      return TaskEntityStatus.Open;
    }
    return TaskEntityStatus.fromValue(stageStatus);
  }

  static Long resolveEffectiveDueDate(
      TaskEntityStatus stageStatus, Object payload, Long requestedDueDate) {
    if (stageStatus != TaskEntityStatus.Granted || payload == null) {
      return requestedDueDate;
    }
    if (!(payload instanceof Map<?, ?> rawMap)) {
      return requestedDueDate;
    }
    Object durationValue = rawMap.get("duration");
    if (!(durationValue instanceof String duration) || duration.isBlank()) {
      return requestedDueDate;
    }
    return parseMillisFromIso8601Duration(duration, requestedDueDate);
  }

  /**
   * Compute {@code payload.expirationDate} when the workflow enters the Granted stage.
   *
   * <p>Anchoring this on stage entry (instead of on the user-invoked transition) makes
   * both the manual path (Approved → markAsGranted → Granted) and the automated PolicyAgent
   * path (Review → approve → PolicyAgent[granted] → Granted) populate expirationDate, since
   * both routes funnel through this listener.
   *
   * <p>Returns null when the stage isn't Granted or the payload doesn't carry a parseable
   * duration. When the payload already carries a numeric {@code expirationDate} (re-entry into
   * the Granted stage, or upstream-set value), returns that existing value unchanged — silent
   * overwrites would extend access on every workflow listener fire.
   */
  static Long resolveEffectiveExpirationDate(TaskEntityStatus stageStatus, Object payload) {
    if (stageStatus != TaskEntityStatus.Granted || !(payload instanceof Map<?, ?> rawMap)) {
      return null;
    }
    Object existing = rawMap.get("expirationDate");
    if (existing instanceof Number existingNum) {
      return existingNum.longValue();
    }
    Object durationValue = rawMap.get("duration");
    if (!(durationValue instanceof String duration) || duration.isBlank()) {
      return null;
    }
    return parseMillisFromIso8601Duration(duration, null);
  }

  /**
   * Returns the payload with {@code expirationDate} merged in when the task enters
   * Granted. Returns the original reference unchanged when there's nothing to add, so
   * non-DAR workflows that target Granted aren't penalised and the input map is never
   * mutated.
   */
  static Object withGrantExpirationDate(TaskEntityStatus stageStatus, Object payload) {
    Long expiration = resolveEffectiveExpirationDate(stageStatus, payload);
    if (expiration == null || !(payload instanceof Map<?, ?> rawMap)) {
      return payload;
    }
    if (rawMap.get("expirationDate") instanceof Number) {
      return payload;
    }
    Map<String, Object> merged = new LinkedHashMap<>();
    rawMap.forEach((k, v) -> merged.put(String.valueOf(k), v));
    merged.put("expirationDate", expiration);
    return merged;
  }

  static Long parseMillisFromIso8601Duration(String duration, Long fallback) {
    try {
      return System.currentTimeMillis() + Duration.parse(duration).toMillis();
    } catch (DateTimeParseException ignored) {
      // Duration.parse does not support month/year designators; try Period
    }
    try {
      return ZonedDateTime.now(ZoneOffset.UTC)
          .plus(Period.parse(duration))
          .toInstant()
          .toEpochMilli();
    } catch (DateTimeParseException e) {
      LOG.warn(
          "[CreateTask] Could not parse ISO-8601 duration '{}'; falling back to caller default",
          duration);
      return fallback;
    }
  }

  private TaskPriority resolveTaskPriority(DelegateTask delegateTask) {
    String priority = WorkflowVariableResolver.stringVariable(delegateTask, "taskPriority");
    if (priority == null || priority.isBlank()) {
      return null;
    }
    return TaskPriority.fromValue(priority);
  }

  private String buildTaskDescription(EntityInterface entity, TaskEntityType taskType) {
    return String.format("Approval required for %s", entity.getName());
  }

  private EntityReference resolveCreatedByReference(
      EntityReference requestedCreatedBy, EntityInterface entity, Object payload) {
    if (requestedCreatedBy != null && requestedCreatedBy.getId() != null) {
      return requestedCreatedBy;
    }

    EntityReference payloadCreator = extractPayloadCreatedBy(payload);
    if (payloadCreator != null) {
      return payloadCreator;
    }

    String userName = entity != null ? entity.getUpdatedBy() : null;
    if (userName == null || userName.isEmpty()) {
      userName = DEFAULT_SYSTEM_USER;
    }

    try {
      return Entity.getEntityReferenceByName(Entity.USER, userName, Include.NON_DELETED);
    } catch (Exception e) {
      return Entity.getEntityReferenceByName(Entity.USER, DEFAULT_SYSTEM_USER, Include.NON_DELETED);
    }
  }

  private EntityReference extractPayloadCreatedBy(Object payload) {
    if (!(payload instanceof Map<?, ?> payloadMap)) {
      return null;
    }

    Object feedback = payloadMap.get("feedback");
    if (feedback == null) {
      return null;
    }

    try {
      RecognizerFeedback recognizerFeedback =
          JsonUtils.convertValue(feedback, RecognizerFeedback.class);
      if (recognizerFeedback == null || recognizerFeedback.getCreatedBy() == null) {
        return null;
      }
      return recognizerFeedback.getCreatedBy();
    } catch (Exception e) {
      return null;
    }
  }

  private String resolveUpdatedBy(EntityInterface entity, EntityReference createdByRef) {
    if (entity != null && entity.getUpdatedBy() != null && !entity.getUpdatedBy().isEmpty()) {
      return entity.getUpdatedBy();
    }
    if (createdByRef != null
        && createdByRef.getName() != null
        && !createdByRef.getName().isEmpty()) {
      return createdByRef.getName();
    }
    return DEFAULT_SYSTEM_USER;
  }

  private Object buildWorkflowPayload(
      TaskEntityType taskType,
      Map<String, String> inputNamespaceMap,
      WorkflowVariableHandler varHandler) {
    if (taskType != TaskEntityType.DataQualityReview || inputNamespaceMap == null) {
      return null;
    }

    String recognizerNamespace =
        inputNamespaceMap.getOrDefault(RECOGNIZER_FEEDBACK, GLOBAL_NAMESPACE);

    try {
      String feedbackJson =
          (String) varHandler.getNamespacedVariable(recognizerNamespace, RECOGNIZER_FEEDBACK);
      if (feedbackJson == null || feedbackJson.isEmpty()) {
        return null;
      }

      RecognizerFeedback feedback = JsonUtils.readValue(feedbackJson, RecognizerFeedback.class);
      Map<String, Object> payload = new LinkedHashMap<>();
      payload.put("feedback", feedback);

      TagLabelRecognizerMetadata recognizer = resolveRecognizerMetadata(feedback);
      if (recognizer != null) {
        payload.put("recognizer", recognizer);
      }
      return payload;
    } catch (Exception e) {
      LOG.warn("Failed to build recognizer feedback payload for task: {}", e.getMessage());
      return null;
    }
  }

  private void terminateDeletedWorkflowManagedDraftTask(
      DelegateTask delegateTask, UUID requestedTaskId) {
    String processInstanceId = delegateTask.getProcessInstanceId();
    RuntimeService runtimeService = WorkflowHandler.getInstance().getRuntimeService();
    String terminationReason =
        String.format(
            "Workflow-managed draft task %s was deleted before workflow materialization",
            requestedTaskId);

    try {
      String terminationMessageName =
          deriveTerminationMessageName(delegateTask.getTaskDefinitionKey());
      if (terminationMessageName != null) {
        Execution execution =
            runtimeService
                .createExecutionQuery()
                .processInstanceId(processInstanceId)
                .messageEventSubscriptionName(terminationMessageName)
                .singleResult();
        if (execution != null) {
          LOG.info(
              "[CreateTask] Draft task '{}' was deleted before materialization; "
                  + "terminating workflow instance '{}' via message '{}'",
              requestedTaskId,
              processInstanceId,
              terminationMessageName);
          runtimeService.messageEventReceived(terminationMessageName, execution.getId());
          return;
        }
      }

      LOG.info(
          "[CreateTask] Draft task '{}' was deleted before materialization; deleting workflow instance '{}'",
          requestedTaskId,
          processInstanceId);
      runtimeService.deleteProcessInstance(processInstanceId, terminationReason);
    } catch (FlowableObjectNotFoundException e) {
      LOG.debug(
          "[CreateTask] Workflow instance '{}' already ended while handling deleted draft task '{}'",
          processInstanceId,
          requestedTaskId);
    }
  }

  private String deriveTerminationMessageName(String taskDefinitionKey) {
    if (taskDefinitionKey == null || taskDefinitionKey.isBlank()) {
      return null;
    }
    int lastDot = taskDefinitionKey.lastIndexOf('.');
    if (lastDot < 0) {
      return null;
    }
    return taskDefinitionKey.substring(0, lastDot) + ".terminateProcess";
  }

  private TagLabelRecognizerMetadata resolveRecognizerMetadata(RecognizerFeedback feedback) {
    if (feedback == null || feedback.getEntityLink() == null || feedback.getTagFQN() == null) {
      return null;
    }

    try {
      MessageParser.EntityLink entityLink =
          MessageParser.EntityLink.parse(feedback.getEntityLink());
      String targetFQN = entityLink.getFullyQualifiedFieldValue();

      CollectionDAO.TagUsageDAO tagUsageDAO = Entity.getCollectionDAO().tagUsageDAO();
      List<TagLabel> tags = tagUsageDAO.getTags(targetFQN);
      return tags.stream()
          .filter(tagLabel -> feedback.getTagFQN().equals(tagLabel.getTagFQN()))
          .findFirst()
          .filter(tagLabel -> tagLabel.getMetadata() != null)
          .map(tagLabel -> tagLabel.getMetadata().getRecognizer())
          .orElse(null);
    } catch (Exception e) {
      LOG.debug(
          "Failed to resolve recognizer metadata for feedback '{}': {}",
          feedback.getId(),
          e.getMessage());
      return null;
    }
  }
}
