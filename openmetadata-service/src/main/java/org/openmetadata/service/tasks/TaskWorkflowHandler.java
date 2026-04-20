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

package org.openmetadata.service.tasks;

import static org.openmetadata.service.governance.workflows.Workflow.RESULT_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.UPDATED_BY_VARIABLE;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.governance.workflows.elements.EdgeDefinition;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TaskAvailableTransition;
import org.openmetadata.schema.type.TaskComment;
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.schema.type.TaskEntityType;
import org.openmetadata.schema.type.TaskResolution;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.TaskRepository;
import org.openmetadata.service.tasks.TaskFormExecutionResolver.TaskExecutionAction;
import org.openmetadata.service.tasks.TaskFormExecutionResolver.TaskExecutionBinding;
import org.openmetadata.service.tasks.TaskFormExecutionResolver.TaskExecutionPlan;
import org.openmetadata.service.util.EntityFieldUtils;
import org.openmetadata.service.util.FieldPathUtils;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * Handles workflow integration for Task entities.
 *
 * <p>This is a clean replacement for FeedRepository.TaskWorkflow that works directly with the new
 * Task entity. It integrates with the Flowable-based Governance Workflow system while keeping all
 * task logic in the new system.
 *
 * <p>Key responsibilities:
 * - Coordinate task resolution with WorkflowHandler
 * - Handle multi-approval thresholds
 * - Apply entity changes when task is resolved
 * - Update task status based on workflow outcome
 */
@Slf4j
public class TaskWorkflowHandler {

  private static TaskWorkflowHandler instance;

  private TaskWorkflowHandler() {}

  public static synchronized TaskWorkflowHandler getInstance() {
    if (instance == null) {
      instance = new TaskWorkflowHandler();
    }
    return instance;
  }

  /**
   * Resolve a task with the given resolution.
   *
   * <p>This method:
   * 1. Validates the user can resolve the task
   * 2. Notifies the Flowable workflow (if task is workflow-managed)
   * 3. Checks multi-approval thresholds
   * 4. If threshold met, applies entity changes and updates task status
   * 5. If threshold not met, task stays Open waiting for more approvals
   *
   * @param task The task to resolve
   * @param transitionId ID of the transition to follow (from availableTransitions)
   * @param requestedResolutionType The requested resolution type (Approved, Rejected, etc.)
   * @param newValue Optional new value to apply (for update tasks)
   * @param resolvedPayload Optional structured payload for the resolution
   * @param comment Optional comment from the resolver
   * @param user The user resolving the task
   * @return The updated task. Workflow-managed tasks may remain open while waiting for more
   *     approvals.
   */
  public Task resolveTask(
      Task task,
      String transitionId,
      TaskResolutionType requestedResolutionType,
      String newValue,
      Object resolvedPayload,
      String comment,
      String user) {
    UUID taskId = task.getId();
    TaskAvailableTransition selectedTransition =
        TaskWorkflowLifecycleResolver.findTransition(task, transitionId);
    TaskResolutionType effectiveResolutionType =
        resolveResolutionType(task, requestedResolutionType, selectedTransition);
    LOG.info(
        "[TaskWorkflowHandler] Resolving task: id='{}', transitionId='{}', resolutionType='{}', user='{}'",
        taskId,
        transitionId,
        effectiveResolutionType,
        user);

    // During migration cutover, legacy workflow tasks can be converted to Task entities before
    // workflowInstanceId is backfilled. Runtime-task presence is the source of truth in that case.
    boolean isWorkflowManaged = isWorkflowManaged(task);

    if (isWorkflowManaged) {
      return resolveWorkflowTask(
          task,
          transitionId,
          effectiveResolutionType,
          selectedTransition,
          newValue,
          resolvedPayload,
          comment,
          user);
    } else {
      return resolveStandaloneTask(
          task,
          effectiveResolutionType,
          selectedTransition,
          newValue,
          resolvedPayload,
          comment,
          user);
    }
  }

  /**
   * Resolve a task that is managed by a Flowable workflow.
   */
  private Task resolveWorkflowTask(
      Task task,
      String transitionId,
      TaskResolutionType resolutionType,
      TaskAvailableTransition selectedTransition,
      String newValue,
      Object resolvedPayload,
      String comment,
      String user) {
    UUID taskId = task.getId();
    WorkflowHandler workflowHandler = WorkflowHandler.getInstance();
    TaskRepository taskRepository = (TaskRepository) Entity.getEntityRepository(Entity.TASK);
    List<EntityReference> payloadAssignees = extractAssigneesFromPayload(resolvedPayload);

    if (payloadAssignees != null && !payloadAssignees.isEmpty()) {
      task = persistWorkflowAssignees(taskRepository, task, payloadAssignees, user);
    }

    Map<String, Object> variables = new HashMap<>();
    variables.put(RESULT_VARIABLE, resolveWorkflowResult(task, transitionId, resolutionType));
    variables.put(UPDATED_BY_VARIABLE, user);
    if (transitionId != null) {
      variables.put("transitionId", transitionId);
    }
    if (newValue != null) {
      variables.put("newValue", newValue);
    }
    if (resolvedPayload != null) {
      variables.put("payload", serializeWorkflowVariable(resolvedPayload));
    }

    // If the caller supplied explicit assignees via the resolve payload, set
    // taskAssignees at process instance scope with its raw name — matching how
    // TaskWorkflowLifecycleResolver.buildWorkflowStartVariables stores it at
    // workflow start. This is read by SetApprovalAssigneesImpl via
    // execution.getVariable("taskAssignees"). We must NOT push this through
    // transformToNodeVariables: that prefixes every key with the source stage
    // name, producing e.g. "AckStage_taskAssignees" which nobody reads.
    //
    // Known limitation: a single global variable works for the current
    // sequential incident workflow but would collide with parallel tasks.
    if (payloadAssignees != null) {
      workflowHandler.setProcessVariable(
          taskId, "taskAssignees", serializeWorkflowVariable(payloadAssignees));
    }

    // Resolve in Flowable workflow
    Map<String, Object> namespacedVariables =
        workflowHandler.transformToNodeVariables(taskId, variables);
    boolean workflowSuccess = workflowHandler.resolveTask(taskId, namespacedVariables);

    if (!workflowSuccess) {
      if (!workflowHandler.hasActiveRuntimeTask(taskId)) {
        if (resolutionType == null) {
          throw new IllegalStateException(
              String.format(
                  "Non-terminal transition '%s' failed for task '%s' and no active Flowable task exists",
                  transitionId, taskId));
        }
        if (task.getStatus() != TaskEntityStatus.Open
            && task.getStatus() != TaskEntityStatus.InProgress) {
          throw new IllegalStateException(
              String.format("Task '%s' is already in status '%s'", taskId, task.getStatus()));
        }
        LOG.warn(
            "[TaskWorkflowHandler] No active Flowable runtime task found for '{}'; applying direct task resolution fallback",
            taskId);
        return applyTaskResolution(
            task, resolutionType, selectedTransition, newValue, resolvedPayload, comment, user);
      }
      throw new IllegalStateException(
          String.format(
              "Workflow resolution failed for task '%s' on transition '%s'",
              taskId, transitionId != null ? transitionId : defaultWorkflowResult(resolutionType)));
    }

    // Non-terminal transition: the next stage's CreateTask already updated the Task
    // entity with the correct stageId, status, and availableTransitions. No resolution needed.
    if (resolutionType == null) {
      LOG.info(
          "[TaskWorkflowHandler] Non-terminal transition '{}' for task '{}' — workflow advanced, no resolution applied",
          transitionId,
          taskId);
      return refreshTask(taskId);
    }

    // Check if multi-approval task is still waiting for more votes
    if (workflowHandler.isAwaitingAdditionalVotes(taskId)) {
      LOG.info("[TaskWorkflowHandler] Task '{}' still open, waiting for more approvals", taskId);
      persistEditedWorkflowPayload(task, resolvedPayload, newValue, user);
      updateTaskVotes(task, user, isPositiveResolution(resolutionType));
      return refreshTask(taskId);
    }

    // Task threshold met, apply resolution
    return applyTaskResolution(
        task, resolutionType, selectedTransition, newValue, resolvedPayload, comment, user);
  }

  private Task persistWorkflowAssignees(
      TaskRepository taskRepository, Task task, List<EntityReference> assignees, String user) {
    try {
      Task currentTask = taskRepository.get(null, task.getId(), taskRepository.getFields("*"));
      Task updatedTask = JsonUtils.deepCopy(currentTask, Task.class);
      updatedTask.setAssignees(assignees);
      updatedTask.setUpdatedBy(user);
      updatedTask.setUpdatedAt(System.currentTimeMillis());

      return taskRepository.update(null, currentTask, updatedTask, user).getEntity();
    } catch (Exception e) {
      LOG.warn(
          "[TaskWorkflowHandler] Failed to persist assignees for workflow task '{}': {}",
          task.getId(),
          e.getMessage());
      return task;
    }
  }

  /**
   * Resolve a standalone task (not managed by a workflow).
   */
  private Task resolveStandaloneTask(
      Task task,
      TaskResolutionType resolutionType,
      TaskAvailableTransition selectedTransition,
      String newValue,
      Object resolvedPayload,
      String comment,
      String user) {
    return applyTaskResolution(
        task, resolutionType, selectedTransition, newValue, resolvedPayload, comment, user);
  }

  /**
   * Apply the task resolution: update entity and mark task as resolved.
   */
  private Task applyTaskResolution(
      Task task,
      TaskResolutionType resolutionType,
      TaskAvailableTransition selectedTransition,
      String newValue,
      Object resolvedPayload,
      String comment,
      String user) {
    UUID taskId = task.getId();
    TaskRepository taskRepository = (TaskRepository) Entity.getEntityRepository(Entity.TASK);
    boolean approved = isPositiveResolution(resolutionType);

    LOG.info(
        "[TaskWorkflowHandler] applyTaskResolution: taskId='{}', approved={}, newValue='{}', aboutPresent={}",
        taskId,
        approved,
        newValue != null
            ? (newValue.length() > 50 ? newValue.substring(0, 50) + "..." : newValue)
            : "null",
        task.getAbout() != null);

    // Add audit comment if assignee provided/modified the value
    if (approved && newValue != null && !newValue.isEmpty()) {
      addResolutionComment(task, taskRepository, newValue, user);
    }

    // Only positive resolutions should mutate the target entity.
    if (approved && task.getAbout() != null) {
      applyEntityChanges(task, approved, newValue, resolvedPayload, user);
    } else {
      LOG.info(
          "[TaskWorkflowHandler] Skipping entity changes: approved={}, aboutPresent={}",
          approved,
          task.getAbout() != null);
    }

    EntityReference resolvedByRef =
        Entity.getEntityReferenceByName(Entity.USER, user, Include.NON_DELETED);

    TaskResolution resolution =
        new TaskResolution()
            .withType(resolutionType)
            .withResolvedBy(resolvedByRef)
            .withResolvedAt(System.currentTimeMillis())
            .withNewValue(newValue)
            .withComment(comment)
            .withPayload(resolvedPayload);

    if (selectedTransition != null) {
      task.setWorkflowStageId(selectedTransition.getTargetStageId());
      task.setWorkflowStageDisplayName(selectedTransition.getTargetStageId());
      task.setAvailableTransitions(List.of());
    }

    task = taskRepository.resolveTask(task, resolution, user);

    LOG.info(
        "[TaskWorkflowHandler] Task '{}' resolved: status={}, resolution={}",
        taskId,
        task.getStatus(),
        resolutionType);

    return refreshTask(taskId, task);
  }

  public static Object mergeResolutionPayload(Task task, Object resolvedPayload, String newValue) {
    if (task == null) {
      return resolvedPayload;
    }

    Map<String, Object> mergedPayload = new LinkedHashMap<>();
    if (task.getPayload() != null) {
      mergedPayload.putAll(
          JsonUtils.convertValue(task.getPayload(), new TypeReference<Map<String, Object>>() {}));
    }
    if (resolvedPayload != null) {
      mergedPayload.putAll(
          JsonUtils.convertValue(resolvedPayload, new TypeReference<Map<String, Object>>() {}));
    }

    TaskExecutionBinding binding = TaskFormExecutionResolver.resolve(task);
    if (newValue != null
        && binding.valueField() != null
        && !mergedPayload.containsKey(binding.valueField())) {
      mergedPayload.put(binding.valueField(), newValue);
    }

    return mergedPayload;
  }

  private void persistEditedWorkflowPayload(
      Task task, Object resolvedPayload, String newValue, String user) {
    if (resolvedPayload == null && newValue == null) {
      return;
    }

    try {
      TaskRepository taskRepository = (TaskRepository) Entity.getEntityRepository(Entity.TASK);
      task.setPayload(mergeResolutionPayload(task, resolvedPayload, newValue));
      task.setUpdatedBy(user);
      task.setUpdatedAt(System.currentTimeMillis());
      taskRepository.createOrUpdate(null, task, user);
    } catch (Exception e) {
      LOG.warn(
          "[TaskWorkflowHandler] Failed to persist edited payload for workflow task '{}': {}",
          task.getId(),
          e.getMessage());
    }
  }

  /**
   * Add a comment to the task recording what value was applied by whom.
   * This creates an audit trail for task resolution.
   */
  private void addResolutionComment(
      Task task, TaskRepository taskRepository, String newValue, String user) {
    try {
      // Check if the newValue differs from the original suggestion
      Object payload = task.getPayload();
      String originalSuggestion = null;
      if (payload != null) {
        JsonNode payloadNode = JsonUtils.valueToTree(payload);
        originalSuggestion = payloadNode.path("suggestedValue").asText(null);
      }

      // Only add comment if user provided a new value (not just accepting suggestion)
      boolean userProvidedValue =
          originalSuggestion == null
              || originalSuggestion.isEmpty()
              || !originalSuggestion.equals(newValue);

      if (userProvidedValue) {
        String commentMessage = buildResolutionCommentMessage(task.getType(), newValue);

        EntityReference authorRef =
            Entity.getEntityReferenceByName(Entity.USER, user, Include.NON_DELETED);

        TaskComment comment =
            new TaskComment()
                .withId(UUID.randomUUID())
                .withMessage(commentMessage)
                .withAuthor(authorRef)
                .withCreatedAt(System.currentTimeMillis());

        taskRepository.addComment(task, comment);
        LOG.info(
            "[TaskWorkflowHandler] Added resolution comment to task '{}' by user '{}'",
            task.getId(),
            user);
      }
    } catch (Exception e) {
      LOG.warn(
          "[TaskWorkflowHandler] Failed to add resolution comment to task '{}': {}",
          task.getId(),
          e.getMessage());
    }
  }

  /**
   * Build a comment message based on task type and the applied value.
   */
  private String buildResolutionCommentMessage(TaskEntityType taskType, String newValue) {
    String truncatedValue = newValue.length() > 200 ? newValue.substring(0, 200) + "..." : newValue;

    return switch (taskType) {
      case DescriptionUpdate -> String.format("Resolved with description: %s", truncatedValue);
      case TagUpdate -> String.format("Resolved with tags: %s", truncatedValue);
      default -> String.format("Resolved with value: %s", truncatedValue);
    };
  }

  /**
   * Apply changes to the entity based on task type and payload.
   */
  private void applyEntityChanges(
      Task task, boolean approved, String newValue, Object resolvedPayload, String user) {
    TaskEntityType taskType = task.getType();
    EntityReference aboutRef = task.getAbout();
    TaskExecutionBinding binding = TaskFormExecutionResolver.resolve(task);
    TaskExecutionPlan executionPlan = TaskFormExecutionResolver.resolveExecutionPlan(task);
    Object effectivePayload = mergeResolutionPayload(task, resolvedPayload, newValue);

    LOG.info(
        "[TaskWorkflowHandler] applyEntityChanges called: taskId='{}', taskType={}, newValue='{}', aboutRef={}",
        task.getId(),
        taskType,
        newValue != null
            ? (newValue.length() > 50 ? newValue.substring(0, 50) + "..." : newValue)
            : "null",
        aboutRef != null ? aboutRef.getFullyQualifiedName() : "null");

    if (aboutRef == null) {
      LOG.warn("[TaskWorkflowHandler] aboutRef is null, skipping entity changes");
      return;
    }

    try {
      EntityInterface entity = Entity.getEntity(aboutRef, "*", Include.ALL);
      EntityRepository<?> repository = Entity.getEntityRepository(aboutRef.getType());

      List<TaskExecutionAction> actions =
          approved ? executionPlan.approveActions() : executionPlan.rejectActions();
      if (actions == null || actions.isEmpty()) {
        if (approved && binding.handlerType() == TaskFormExecutionResolver.HandlerType.SUGGESTION) {
          applySuggestion(task, effectivePayload, entity, repository, user);
        } else {
          LOG.debug("No entity changes configured for task type: {}", taskType);
        }

        return;
      }

      executeConfiguredActions(actions, task, entity, repository, user, effectivePayload, newValue);
    } catch (Exception e) {
      LOG.error(
          "[TaskWorkflowHandler] Failed to apply entity changes for task '{}'", task.getId(), e);
    }
  }

  private void executeConfiguredActions(
      List<TaskExecutionAction> actions,
      Task task,
      EntityInterface entity,
      EntityRepository<?> repository,
      String user,
      Object payload,
      String newValue) {
    for (TaskExecutionAction action : actions) {
      switch (action.actionType()) {
        case SET_DESCRIPTION -> applyDescriptionAction(
            task, entity, repository, user, newValue, payload, action);
        case MERGE_TAGS -> applyMergeTagsAction(
            task, entity, repository, user, newValue, payload, action);
        case REPLACE_OWNERS -> applyReplaceOwnersAction(
            task, entity, repository, user, payload, action);
        case APPLY_TIER -> applyApplyTierAction(task, entity, repository, user, payload, action);
        case REPLACE_DOMAINS -> applyReplaceDomainsAction(
            task, entity, repository, user, payload, action);
        case PATCH_ENTITY_FIELD -> applyPatchEntityFieldAction(task, entity, user, payload, action);
        case APPLY_SUGGESTION -> applySuggestion(task, payload, entity, repository, user);
        default -> LOG.debug("Unsupported task execution action '{}'", action.actionType());
      }
    }
  }

  private void applyDescriptionAction(
      Task task,
      EntityInterface entity,
      EntityRepository<?> repository,
      String user,
      String newValue,
      Object payload,
      TaskExecutionAction action) {

    LOG.info(
        "[TaskWorkflowHandler] applyDescriptionUpdate: taskId='{}', entity='{}'",
        task.getId(),
        entity.getName());

    try {
      // Extract description and field path from payload/newValue
      String newDescription = newValue;
      String fieldPath = null;

      if (payload != null) {
        JsonNode payloadNode = JsonUtils.valueToTree(payload);
        fieldPath = readPayloadString(payloadNode, action.fieldPathField(), "fieldPath");
        if (fieldPath == null || fieldPath.isEmpty()) {
          fieldPath = payloadNode.path("field").asText(null);
        }
        if (newDescription == null || newDescription.isEmpty()) {
          newDescription = readPayloadString(payloadNode, action.valueField(), "suggestedValue");
        }
      }

      if (newDescription == null || newDescription.isEmpty()) {
        LOG.warn("[TaskWorkflowHandler] No description value to apply for task '{}'", task.getId());
        return;
      }

      LOG.info(
          "[TaskWorkflowHandler] Applying description update: fieldPath='{}', description='{}'",
          fieldPath,
          newDescription.length() > 50 ? newDescription.substring(0, 50) + "..." : newDescription);

      // Use FieldPathUtils for clean field update
      boolean success =
          FieldPathUtils.updateFieldDescription(
              entity, repository, user, fieldPath, newDescription);

      if (success) {
        LOG.info(
            "[TaskWorkflowHandler] Successfully applied description update for task '{}'",
            task.getId());
      } else {
        LOG.warn(
            "[TaskWorkflowHandler] Failed to apply description update for task '{}'", task.getId());
      }
    } catch (Exception e) {
      LOG.error("[TaskWorkflowHandler] Failed to apply DescriptionUpdate: {}", e.getMessage(), e);
    }
  }

  private void applyMergeTagsAction(
      Task task,
      EntityInterface entity,
      EntityRepository<?> repository,
      String user,
      String newValue,
      Object payload,
      TaskExecutionAction action) {
    try {
      String targetFqn = entity.getFullyQualifiedName();
      List<TagLabel> tagsToAdd = null;
      List<TagLabel> tagsToRemove = null;

      // Try to get tags from payload first (new format with tagsToAdd/tagsToRemove)
      if (payload != null) {
        JsonNode payloadNode = JsonUtils.valueToTree(payload);
        String fieldPath = readPayloadString(payloadNode, action.fieldPathField(), "fieldPath");
        if (fieldPath != null && !fieldPath.isEmpty()) {
          targetFqn = resolveTagTargetFqn(entity, fieldPath);
        }

        tagsToAdd =
            readTagLabels(payloadNode, action.addTagsField(), "tagsToAdd", "suggestedValue");
        tagsToRemove = readTagLabels(payloadNode, action.removeTagsField(), "tagsToRemove", null);
      }

      // If newValue is provided (from resolution), parse it as the final tags to apply
      // This is used when user edits the suggestion before accepting
      if (newValue != null && !newValue.isEmpty()) {
        List<TagLabel> newTags =
            JsonUtils.readValue(newValue, new TypeReference<List<TagLabel>>() {});
        if (newTags != null && !newTags.isEmpty()) {
          tagsToAdd = newTags;
          // When using newValue, we're replacing, so don't process tagsToRemove separately
          tagsToRemove = null;
        }
      }

      if (tagsToRemove != null && !tagsToRemove.isEmpty()) {
        repository.applyTagsDelete(tagsToRemove, targetFqn);
        LOG.info("[TaskWorkflowHandler] Removed {} tags from '{}'", tagsToRemove.size(), targetFqn);
      }

      if (tagsToAdd != null && !tagsToAdd.isEmpty()) {
        repository.applyTags(tagsToAdd, targetFqn);
        LOG.info("[TaskWorkflowHandler] Added {} tags to '{}'", tagsToAdd.size(), targetFqn);
      }
    } catch (Exception e) {
      LOG.error("[TaskWorkflowHandler] Failed to apply TagUpdate", e);
    }
  }

  private String resolveTagTargetFqn(EntityInterface entity, String fieldPath) {
    if (fieldPath == null || fieldPath.isEmpty()) {
      return entity.getFullyQualifiedName();
    }

    String normalizedFieldPath = fieldPath.replace("\"", "");

    if (normalizedFieldPath.startsWith("requestSchema.schemaFields.")) {
      return entity.getFullyQualifiedName()
          + ".requestSchema."
          + normalizedFieldPath.substring("requestSchema.schemaFields.".length());
    }

    if (normalizedFieldPath.startsWith("responseSchema.schemaFields.")) {
      return entity.getFullyQualifiedName()
          + ".responseSchema."
          + normalizedFieldPath.substring("responseSchema.schemaFields.".length());
    }

    if (normalizedFieldPath.startsWith("requestSchema.")) {
      return entity.getFullyQualifiedName() + "." + normalizedFieldPath;
    }

    if (normalizedFieldPath.startsWith("responseSchema.")) {
      return entity.getFullyQualifiedName() + "." + normalizedFieldPath;
    }

    String[] supportedPrefixes = {
      "columns.",
      "messageSchema.schemaFields.",
      "messageSchema.",
      "dataModel.columns.",
      "dataModel."
    };

    for (String prefix : supportedPrefixes) {
      if (normalizedFieldPath.startsWith(prefix)) {
        return entity.getFullyQualifiedName()
            + "."
            + normalizedFieldPath.substring(prefix.length());
      }
    }

    return entity.getFullyQualifiedName() + "." + normalizedFieldPath;
  }

  private String readPayloadString(
      JsonNode payloadNode, String preferredField, String fallbackField) {
    if (preferredField != null) {
      String preferredValue = payloadNode.path(preferredField).asText(null);
      if (preferredValue != null && !preferredValue.isEmpty()) {
        return preferredValue;
      }
    }

    if (fallbackField == null) {
      return null;
    }

    String fallbackValue = payloadNode.path(fallbackField).asText(null);
    return fallbackValue == null || fallbackValue.isEmpty() ? null : fallbackValue;
  }

  private List<TagLabel> readTagLabels(
      JsonNode payloadNode,
      String preferredField,
      String fallbackField,
      String jsonEncodedFallbackField) {
    JsonNode node = preferredField != null ? payloadNode.get(preferredField) : null;
    if (node == null && fallbackField != null) {
      node = payloadNode.get(fallbackField);
    }

    if (node != null && !node.isNull()) {
      return JsonUtils.convertValue(node, new TypeReference<List<TagLabel>>() {});
    }

    if (jsonEncodedFallbackField != null) {
      String jsonValue = payloadNode.path(jsonEncodedFallbackField).asText(null);
      if (jsonValue != null && !jsonValue.isEmpty()) {
        return JsonUtils.readValue(jsonValue, new TypeReference<List<TagLabel>>() {});
      }
    }

    return null;
  }

  private void applyReplaceOwnersAction(
      Task task,
      EntityInterface entity,
      EntityRepository<?> repository,
      String user,
      Object payload,
      TaskExecutionAction action) {
    if (payload == null) {
      LOG.warn("[TaskWorkflowHandler] No payload for OwnershipUpdate task '{}'", task.getId());
      return;
    }

    try {
      List<EntityReference> newOwners =
          readEntityReferences(payload, action.payloadField(), "newOwners");
      if (newOwners == null || newOwners.isEmpty()) {
        LOG.warn("[TaskWorkflowHandler] No new owners specified in OwnershipUpdate payload");
        return;
      }

      String originalJson = JsonUtils.pojoToJson(entity);
      entity.setOwners(newOwners);
      String updatedJson = JsonUtils.pojoToJson(entity);

      jakarta.json.JsonPatch patch = JsonUtils.getJsonPatch(originalJson, updatedJson);
      if (patch != null && !patch.toJsonArray().isEmpty()) {
        repository.patch(null, entity.getId(), user, patch, null, null);
        LOG.info(
            "[TaskWorkflowHandler] Applied OwnershipUpdate for entity '{}': {} owners",
            entity.getName(),
            newOwners.size());
      }
    } catch (Exception e) {
      LOG.error("[TaskWorkflowHandler] Failed to apply OwnershipUpdate: {}", e.getMessage(), e);
    }
  }

  private void applyApplyTierAction(
      Task task,
      EntityInterface entity,
      EntityRepository<?> repository,
      String user,
      Object payload,
      TaskExecutionAction action) {
    if (payload == null) {
      LOG.warn("[TaskWorkflowHandler] No payload for TierUpdate task '{}'", task.getId());
      return;
    }

    try {
      TagLabel newTier = readTagLabel(payload, action.payloadField(), "newTier");
      if (newTier == null) {
        LOG.warn("[TaskWorkflowHandler] No new tier specified in TierUpdate payload");
        return;
      }

      String targetFqn = entity.getFullyQualifiedName();
      repository.applyTags(List.of(newTier), targetFqn);
      LOG.info(
          "[TaskWorkflowHandler] Applied TierUpdate for entity '{}': tier={}",
          entity.getName(),
          newTier.getTagFQN());
    } catch (Exception e) {
      LOG.error("[TaskWorkflowHandler] Failed to apply TierUpdate: {}", e.getMessage(), e);
    }
  }

  private void applyReplaceDomainsAction(
      Task task,
      EntityInterface entity,
      EntityRepository<?> repository,
      String user,
      Object payload,
      TaskExecutionAction action) {
    if (payload == null) {
      LOG.warn("[TaskWorkflowHandler] No payload for DomainUpdate task '{}'", task.getId());
      return;
    }

    try {
      List<EntityReference> newDomains =
          readEntityReferences(payload, action.payloadField(), "newDomain");
      if (newDomains == null || newDomains.isEmpty()) {
        LOG.warn("[TaskWorkflowHandler] No new domain specified in DomainUpdate payload");
        return;
      }

      String originalJson = JsonUtils.pojoToJson(entity);
      entity.setDomains(newDomains);
      String updatedJson = JsonUtils.pojoToJson(entity);

      jakarta.json.JsonPatch patch = JsonUtils.getJsonPatch(originalJson, updatedJson);
      if (patch != null && !patch.toJsonArray().isEmpty()) {
        repository.patch(null, entity.getId(), user, patch, null, null);
        LOG.info(
            "[TaskWorkflowHandler] Applied DomainUpdate for entity '{}': domain={}",
            entity.getName(),
            newDomains.get(0).getFullyQualifiedName());
      }
    } catch (Exception e) {
      LOG.error("[TaskWorkflowHandler] Failed to apply DomainUpdate: {}", e.getMessage(), e);
    }
  }

  private void applyPatchEntityFieldAction(
      Task task, EntityInterface entity, String user, Object payload, TaskExecutionAction action) {
    if (action.entityField() == null) {
      LOG.warn(
          "[TaskWorkflowHandler] Missing entity field binding for patchEntityField action on task '{}'",
          task.getId());
      return;
    }

    try {
      Object value =
          action.payloadField() != null
              ? readPayloadObject(payload, action.payloadField(), null)
              : action.staticValue();
      EntityFieldUtils.setEntityField(
          entity,
          entity.getEntityReference().getType(),
          user,
          action.entityField(),
          value == null ? null : String.valueOf(value),
          true);
    } catch (Exception e) {
      LOG.error(
          "[TaskWorkflowHandler] Failed to apply patchEntityField action for task '{}': {}",
          task.getId(),
          e.getMessage(),
          e);
    }
  }

  private void applySuggestion(
      Task task,
      Object payload,
      EntityInterface entity,
      EntityRepository<?> repository,
      String user) {
    if (payload == null) return;

    try {
      JsonNode payloadNode = JsonUtils.valueToTree(payload);
      String suggestionType = payloadNode.path("suggestionType").asText(null);
      String fieldPath = payloadNode.path("fieldPath").asText(null);
      String suggestedValue = payloadNode.path("suggestedValue").asText(null);

      if (suggestedValue == null) {
        LOG.warn("[TaskWorkflowHandler] No suggested value for Suggestion task '{}'", task.getId());
        return;
      }

      if ("Description".equals(suggestionType)) {
        Optional<String> currentDescription = FieldPathUtils.getFieldDescription(entity, fieldPath);
        if (currentDescription.isPresent() && suggestedValue.equals(currentDescription.get())) {
          String changeSummaryField = resolveSuggestionChangeSummaryField(fieldPath);
          if (changeSummaryField != null) {
            repository.patchChangeSummary(
                entity.getId(), changeSummaryField, ChangeSource.SUGGESTED, user);
          }
          LOG.info(
              "[TaskWorkflowHandler] Recorded no-op description suggestion change summary: fieldPath={}",
              fieldPath);
          return;
        }
        boolean success =
            FieldPathUtils.updateFieldDescription(
                entity, repository, user, fieldPath, suggestedValue);
        if (success) {
          LOG.info("[TaskWorkflowHandler] Applied description suggestion: fieldPath={}", fieldPath);
        } else {
          LOG.warn(
              "[TaskWorkflowHandler] Failed to apply description suggestion: fieldPath={}",
              fieldPath);
        }
      } else if ("Tag".equals(suggestionType)) {
        List<TagLabel> tags =
            JsonUtils.readValue(suggestedValue, new TypeReference<List<TagLabel>>() {});
        if (tags != null && !tags.isEmpty()) {
          boolean isEntityLevel =
              fieldPath == null
                  || fieldPath.isEmpty()
                  || fieldPath.equals("description")
                  || !fieldPath.contains("::");

          if (isEntityLevel) {
            applyEntityLevelTags(entity, repository, user, tags);
          } else {
            String[] parts = fieldPath.split("::");
            String targetFqn = entity.getFullyQualifiedName();
            if (parts.length >= 2) {
              targetFqn = entity.getFullyQualifiedName() + "." + parts[1];
            }
            repository.applyTags(tags, targetFqn);
          }
          LOG.info(
              "[TaskWorkflowHandler] Applied tag suggestion: {} tags for entity '{}'",
              tags.size(),
              entity.getName());
        }
      } else {
        LOG.debug("[TaskWorkflowHandler] Unknown suggestion type: {}", suggestionType);
      }
    } catch (Exception e) {
      LOG.error("[TaskWorkflowHandler] Failed to apply Suggestion", e);
    }
  }

  private void applyEntityLevelTags(
      EntityInterface entity, EntityRepository<?> repository, String user, List<TagLabel> tags) {
    String originalJson = JsonUtils.pojoToJson(entity);
    List<TagLabel> mergedTags =
        org.openmetadata.service.resources.tags.TagLabelUtil.mergeTagsWithIncomingPrecedence(
            entity.getTags(), tags);
    entity.setTags(mergedTags);
    String updatedJson = JsonUtils.pojoToJson(entity);
    jakarta.json.JsonPatch patch = JsonUtils.getJsonPatch(originalJson, updatedJson);
    if (patch != null && !patch.toJsonArray().isEmpty()) {
      repository.patch(null, entity.getId(), user, patch, null, null);
    }
  }

  private String resolveSuggestionChangeSummaryField(String fieldPath) {
    if (fieldPath == null
        || fieldPath.isBlank()
        || fieldPath.equals("description")
        || fieldPath.equals("entity")) {
      return "description";
    }

    FieldPathUtils.FieldPathComponents components = FieldPathUtils.parseFieldPath(fieldPath);
    if (components == null || !"description".equals(components.property())) {
      return null;
    }

    if (components.fieldName() == null || components.fieldName().isBlank()) {
      return "description";
    }

    return FullyQualifiedName.build(
        components.containerName(), components.fieldName(), components.property());
  }

  private List<EntityReference> readEntityReferences(
      Object payload, String preferredField, String fallbackField) {
    JsonNode payloadNode = JsonUtils.valueToTree(payload);
    JsonNode node = preferredField != null ? payloadNode.get(preferredField) : null;
    if (node == null && fallbackField != null) {
      node = payloadNode.get(fallbackField);
    }

    if (node == null || node.isNull()) {
      return null;
    }

    if (node.isArray()) {
      return JsonUtils.convertValue(node, new TypeReference<List<EntityReference>>() {});
    }

    EntityReference entityReference = JsonUtils.convertValue(node, EntityReference.class);
    return entityReference == null ? null : List.of(entityReference);
  }

  private TagLabel readTagLabel(Object payload, String preferredField, String fallbackField) {
    JsonNode payloadNode = JsonUtils.valueToTree(payload);
    JsonNode node = preferredField != null ? payloadNode.get(preferredField) : null;
    if (node == null && fallbackField != null) {
      node = payloadNode.get(fallbackField);
    }

    if (node == null || node.isNull()) {
      return null;
    }

    return JsonUtils.convertValue(node, TagLabel.class);
  }

  private Object readPayloadObject(Object payload, String preferredField, String fallbackField) {
    JsonNode payloadNode = JsonUtils.valueToTree(payload);
    JsonNode node = preferredField != null ? payloadNode.get(preferredField) : null;
    if (node == null && fallbackField != null) {
      node = payloadNode.get(fallbackField);
    }

    if (node == null || node.isNull()) {
      return null;
    }

    return JsonUtils.convertValue(node, Object.class);
  }

  /**
   * Update task to reflect that a user has voted (for multi-approval tasks).
   */
  private void updateTaskVotes(Task task, String user, boolean approved) {
    // This updates metadata to track who has voted
    // The actual vote tracking is in Flowable variables
    LOG.debug(
        "[TaskWorkflowHandler] User '{}' voted {} on task '{}'",
        user,
        approved ? "approve" : "reject",
        task.getId());
  }

  /**
   * Reopen a previously resolved task.
   */
  public Task reopenTask(Task task, String user) {
    if (task.getStatus() == TaskEntityStatus.Open
        || task.getStatus() == TaskEntityStatus.InProgress) {
      LOG.warn("[TaskWorkflowHandler] Task '{}' is already open", task.getId());
      return task;
    }

    TaskRepository taskRepository = (TaskRepository) Entity.getEntityRepository(Entity.TASK);

    task.setStatus(TaskEntityStatus.Open);
    task.setResolution(null);
    task.setUpdatedBy(user);
    task.setUpdatedAt(System.currentTimeMillis());

    taskRepository.createOrUpdate(null, task, user);

    LOG.info("[TaskWorkflowHandler] Task '{}' reopened by '{}'", task.getId(), user);
    return task;
  }

  /**
   * Close a task without applying any entity changes.
   */
  public Task closeTask(Task task, String user, String comment) {
    TaskRepository taskRepository = (TaskRepository) Entity.getEntityRepository(Entity.TASK);

    EntityReference resolvedByRef =
        Entity.getEntityReferenceByName(Entity.USER, user, Include.NON_DELETED);

    TaskResolution resolution =
        new TaskResolution()
            .withType(TaskResolutionType.Cancelled)
            .withResolvedBy(resolvedByRef)
            .withResolvedAt(System.currentTimeMillis())
            .withComment(comment);

    task = taskRepository.resolveTask(task, resolution, user);

    LOG.info("[TaskWorkflowHandler] Task '{}' closed by '{}'", task.getId(), user);
    return task;
  }

  /**
   * Check if a task supports multi-approval.
   */
  public boolean supportsMultiApproval(Task task) {
    if (!isWorkflowManaged(task)) {
      return false;
    }
    return WorkflowHandler.getInstance().hasMultiApprovalSupport(task.getId());
  }

  private boolean isWorkflowManaged(Task task) {
    if (task.getWorkflowInstanceId() != null) {
      return true;
    }
    try {
      return WorkflowHandler.getInstance().hasActiveRuntimeTask(task.getId());
    } catch (Exception e) {
      LOG.debug(
          "[TaskWorkflowHandler] Could not determine runtime workflow state for task '{}': {}",
          task.getId(),
          e.getMessage());
      return false;
    }
  }

  private Task refreshTask(UUID taskId) {
    return refreshTask(taskId, null);
  }

  private Task refreshTask(UUID taskId, Task fallbackTask) {
    try {
      TaskRepository taskRepository = (TaskRepository) Entity.getEntityRepository(Entity.TASK);

      return taskRepository.get(
          null,
          taskId,
          taskRepository.getFields(
              "assignees,reviewers,watchers,about,domains,comments,createdBy,payload,resolution"));
    } catch (Exception e) {
      LOG.warn(
          "[TaskWorkflowHandler] Failed to refresh task '{}' after workflow update: {}",
          taskId,
          e.getMessage());

      return fallbackTask;
    }
  }

  private boolean isPositiveResolution(TaskResolutionType resolutionType) {
    return resolutionType == TaskResolutionType.Approved
        || resolutionType == TaskResolutionType.AutoApproved
        || resolutionType == TaskResolutionType.Completed;
  }

  private String defaultWorkflowResult(TaskResolutionType resolutionType) {
    if (resolutionType == null) {
      return "approve";
    }
    return switch (resolutionType) {
      case Approved, AutoApproved -> "approve";
      case Rejected, AutoRejected -> "reject";
      case Completed -> "complete";
      case Cancelled -> "cancel";
      case TimedOut -> "timeout";
    };
  }

  private String resolveWorkflowResult(
      Task task, String transitionId, TaskResolutionType resolutionType) {
    if (transitionId != null) {
      return transitionId;
    }

    String workflowDefinitionTransition = resolveWorkflowDefinitionTransition(task, resolutionType);
    if (workflowDefinitionTransition != null) {
      return workflowDefinitionTransition;
    }

    String defaultTransitionId =
        TaskWorkflowLifecycleResolver.defaultTransitionId(task, resolutionType);
    if (defaultTransitionId != null) {
      return defaultTransitionId;
    }

    if (task != null && TaskEntityType.DataQualityReview == task.getType()) {
      return isPositiveResolution(resolutionType) ? "true" : "false";
    }

    return defaultWorkflowResult(resolutionType);
  }

  private TaskResolutionType resolveResolutionType(
      Task task,
      TaskResolutionType requestedResolutionType,
      TaskAvailableTransition selectedTransition) {
    if (requestedResolutionType != null) {
      return requestedResolutionType;
    }

    if (selectedTransition != null && selectedTransition.getResolutionType() != null) {
      return selectedTransition.getResolutionType();
    }

    if (selectedTransition != null && selectedTransition.getTargetTaskStatus() != null) {
      return switch (selectedTransition.getTargetTaskStatus()) {
        case Approved -> TaskResolutionType.Approved;
        case Rejected -> TaskResolutionType.Rejected;
        case Completed -> TaskResolutionType.Completed;
        case Cancelled -> TaskResolutionType.Cancelled;
        case Failed -> TaskResolutionType.TimedOut;
        case Open, InProgress, Pending -> null;
      };
    }

    String defaultTransitionId =
        TaskWorkflowLifecycleResolver.defaultTransitionId(task, TaskResolutionType.Approved);
    if ("reject".equals(defaultTransitionId)) {
      return TaskResolutionType.Rejected;
    }
    return TaskResolutionType.Approved;
  }

  private String resolveWorkflowDefinitionTransition(Task task, TaskResolutionType resolutionType) {
    if (task == null || task.getWorkflowDefinitionId() == null || resolutionType == null) {
      return null;
    }

    try {
      WorkflowDefinition workflowDefinition =
          Entity.getEntity(
              Entity.WORKFLOW_DEFINITION,
              task.getWorkflowDefinitionId(),
              "edges",
              Include.NON_DELETED);
      if (workflowDefinition == null || workflowDefinition.getEdges() == null) {
        return null;
      }

      Set<String> conditions = new HashSet<>();
      for (EdgeDefinition edge : workflowDefinition.getEdges()) {
        if (edge.getCondition() != null && !edge.getCondition().isBlank()) {
          conditions.add(edge.getCondition());
        }
      }

      String namedResult = defaultWorkflowResult(resolutionType);
      if (conditions.contains(namedResult)) {
        return namedResult;
      }

      String booleanResult = isPositiveResolution(resolutionType) ? "true" : "false";
      if (conditions.contains(booleanResult)) {
        return booleanResult;
      }
    } catch (Exception e) {
      LOG.debug(
          "[TaskWorkflowHandler] Unable to inspect workflow definition '{}' for task '{}': {}",
          task.getWorkflowDefinitionId(),
          task.getId(),
          e.getMessage());
    }

    return null;
  }

  private Object serializeWorkflowVariable(Object value) {
    if (value == null
        || value instanceof String
        || value instanceof Number
        || value instanceof Boolean) {
      return value;
    }
    return JsonUtils.pojoToJson(value);
  }

  @SuppressWarnings("unchecked")
  private List<EntityReference> extractAssigneesFromPayload(Object payload) {
    if (payload == null) {
      return null;
    }
    try {
      Map<String, Object> payloadMap = JsonUtils.convertValue(payload, Map.class);
      if (payloadMap == null) {
        return null;
      }
      Object assigneesObj = payloadMap.get("assignees");
      if (assigneesObj == null) {
        return null;
      }
      return JsonUtils.convertValue(assigneesObj, new TypeReference<List<EntityReference>>() {});
    } catch (Exception e) {
      LOG.warn("Failed to extract assignees from resolve payload: {}", e.getMessage());
      return null;
    }
  }
}
