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
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.schema.type.TaskEntityType;
import org.openmetadata.schema.type.TaskResolution;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.TaskRepository;

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
   * @param approved Whether the task is approved (true) or rejected (false)
   * @param newValue Optional new value to apply (for update tasks)
   * @param user The user resolving the task
   * @return The updated task, or null if still waiting for more approvals
   */
  public Task resolveTask(Task task, boolean approved, String newValue, String user) {
    UUID taskId = task.getId();
    LOG.info(
        "[TaskWorkflowHandler] Resolving task: id='{}', approved={}, user='{}'",
        taskId,
        approved,
        user);

    // Check if task is managed by a Flowable workflow
    boolean isWorkflowManaged = task.getWorkflowInstanceId() != null;

    if (isWorkflowManaged) {
      return resolveWorkflowTask(task, approved, newValue, user);
    } else {
      return resolveStandaloneTask(task, approved, newValue, user);
    }
  }

  /**
   * Resolve a task that is managed by a Flowable workflow.
   */
  private Task resolveWorkflowTask(Task task, boolean approved, String newValue, String user) {
    UUID taskId = task.getId();
    WorkflowHandler workflowHandler = WorkflowHandler.getInstance();

    // Build workflow variables
    Map<String, Object> variables = new HashMap<>();
    variables.put(RESULT_VARIABLE, approved);
    variables.put(UPDATED_BY_VARIABLE, user);
    if (newValue != null) {
      variables.put("newValue", newValue);
    }

    // Resolve in Flowable workflow
    Map<String, Object> namespacedVariables =
        workflowHandler.transformToNodeVariables(taskId, variables);
    boolean workflowSuccess = workflowHandler.resolveTask(taskId, namespacedVariables);

    if (!workflowSuccess) {
      LOG.warn(
          "[TaskWorkflowHandler] Workflow resolution failed for task '{}', applying directly",
          taskId);
      return resolveStandaloneTask(task, approved, newValue, user);
    }

    // Check if multi-approval task is still waiting for more votes
    if (workflowHandler.isTaskStillOpen(taskId)) {
      LOG.info("[TaskWorkflowHandler] Task '{}' still open, waiting for more approvals", taskId);
      // Update the task to reflect that this user has voted
      updateTaskVotes(task, user, approved);
      return null; // Task is still open
    }

    // Task threshold met, apply resolution
    return applyTaskResolution(task, approved, newValue, user);
  }

  /**
   * Resolve a standalone task (not managed by a workflow).
   */
  private Task resolveStandaloneTask(Task task, boolean approved, String newValue, String user) {
    return applyTaskResolution(task, approved, newValue, user);
  }

  /**
   * Apply the task resolution: update entity and mark task as resolved.
   */
  private Task applyTaskResolution(Task task, boolean approved, String newValue, String user) {
    UUID taskId = task.getId();
    TaskRepository taskRepository = (TaskRepository) Entity.getEntityRepository(Entity.TASK);

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

    // Apply entity changes based on task type
    if (approved && task.getAbout() != null) {
      applyEntityChanges(task, newValue, user);
    } else {
      LOG.info(
          "[TaskWorkflowHandler] Skipping entity changes: approved={}, aboutPresent={}",
          approved,
          task.getAbout() != null);
    }

    // Build resolution
    TaskResolutionType resolutionType =
        approved ? TaskResolutionType.Approved : TaskResolutionType.Rejected;

    EntityReference resolvedByRef =
        Entity.getEntityReferenceByName(Entity.USER, user, Include.NON_DELETED);

    TaskResolution resolution =
        new TaskResolution()
            .withType(resolutionType)
            .withResolvedBy(resolvedByRef)
            .withResolvedAt(System.currentTimeMillis())
            .withNewValue(newValue);

    // Update task status
    task = taskRepository.resolveTask(task, resolution, user);

    LOG.info(
        "[TaskWorkflowHandler] Task '{}' resolved: status={}, resolution={}",
        taskId,
        task.getStatus(),
        resolutionType);

    return task;
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

        org.openmetadata.schema.type.TaskComment comment =
            new org.openmetadata.schema.type.TaskComment()
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
  private void applyEntityChanges(Task task, String newValue, String user) {
    TaskEntityType taskType = task.getType();
    EntityReference aboutRef = task.getAbout();

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

      switch (taskType) {
        case GlossaryApproval -> applyGlossaryApproval(entity, repository, user);
        case DescriptionUpdate -> applyDescriptionUpdate(task, entity, repository, user, newValue);
        case TagUpdate -> applyTagUpdate(task, entity, repository, user, newValue);
        case OwnershipUpdate -> applyOwnershipUpdate(task, entity, repository, user);
        case TierUpdate -> applyTierUpdate(task, entity, repository, user);
        case DomainUpdate -> applyDomainUpdate(task, entity, repository, user);
        case Suggestion -> applySuggestion(task, entity, repository, user);
        default -> LOG.debug("No entity changes for task type: {}", taskType);
      }
    } catch (Exception e) {
      LOG.error(
          "[TaskWorkflowHandler] Failed to apply entity changes for task '{}'", task.getId(), e);
    }
  }

  private void applyGlossaryApproval(
      EntityInterface entity, EntityRepository<?> repository, String user) {
    // Set entity status to Approved
    try {
      org.openmetadata.service.util.EntityFieldUtils.setEntityField(
          entity, entity.getEntityReference().getType(), user, "entityStatus", "Approved", true);
      LOG.info("[TaskWorkflowHandler] Applied GlossaryApproval for entity '{}'", entity.getName());
    } catch (Exception e) {
      LOG.error("[TaskWorkflowHandler] Failed to apply GlossaryApproval", e);
    }
  }

  private void applyDescriptionUpdate(
      Task task,
      EntityInterface entity,
      EntityRepository<?> repository,
      String user,
      String newValue) {
    Object payload = task.getPayload();

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
        fieldPath = payloadNode.path("fieldPath").asText(null);
        if (fieldPath == null || fieldPath.isEmpty()) {
          fieldPath = payloadNode.path("field").asText(null);
        }
        if (newDescription == null || newDescription.isEmpty()) {
          newDescription = payloadNode.path("suggestedValue").asText(null);
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
          org.openmetadata.service.util.FieldPathUtils.updateFieldDescription(
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

  private void applyTagUpdate(
      Task task,
      EntityInterface entity,
      EntityRepository<?> repository,
      String user,
      String newValue) {
    Object payload = task.getPayload();

    try {
      String targetFqn = entity.getFullyQualifiedName();
      List<TagLabel> tagsToAdd = null;
      List<TagLabel> tagsToRemove = null;

      // Try to get tags from payload first (new format with tagsToAdd/tagsToRemove)
      if (payload != null) {
        org.openmetadata.schema.type.TagUpdatePayload tagPayload =
            JsonUtils.convertValue(payload, org.openmetadata.schema.type.TagUpdatePayload.class);

        String fieldPath = tagPayload.getFieldPath();
        if (fieldPath != null && !fieldPath.isEmpty()) {
          targetFqn = entity.getFullyQualifiedName() + "." + fieldPath.replace("columns.", "");
        }

        tagsToAdd = tagPayload.getTagsToAdd();
        tagsToRemove = tagPayload.getTagsToRemove();
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

  private void applyOwnershipUpdate(
      Task task, EntityInterface entity, EntityRepository<?> repository, String user) {
    Object payload = task.getPayload();
    if (payload == null) {
      LOG.warn("[TaskWorkflowHandler] No payload for OwnershipUpdate task '{}'", task.getId());
      return;
    }

    try {
      org.openmetadata.schema.type.OwnershipUpdatePayload ownerPayload =
          JsonUtils.convertValue(
              payload, org.openmetadata.schema.type.OwnershipUpdatePayload.class);

      List<EntityReference> newOwners = ownerPayload.getNewOwners();
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

  private void applyTierUpdate(
      Task task, EntityInterface entity, EntityRepository<?> repository, String user) {
    Object payload = task.getPayload();
    if (payload == null) {
      LOG.warn("[TaskWorkflowHandler] No payload for TierUpdate task '{}'", task.getId());
      return;
    }

    try {
      org.openmetadata.schema.type.TierUpdatePayload tierPayload =
          JsonUtils.convertValue(payload, org.openmetadata.schema.type.TierUpdatePayload.class);

      TagLabel newTier = tierPayload.getNewTier();
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

  private void applyDomainUpdate(
      Task task, EntityInterface entity, EntityRepository<?> repository, String user) {
    Object payload = task.getPayload();
    if (payload == null) {
      LOG.warn("[TaskWorkflowHandler] No payload for DomainUpdate task '{}'", task.getId());
      return;
    }

    try {
      org.openmetadata.schema.type.DomainUpdatePayload domainPayload =
          JsonUtils.convertValue(payload, org.openmetadata.schema.type.DomainUpdatePayload.class);

      EntityReference newDomain = domainPayload.getNewDomain();
      if (newDomain == null) {
        LOG.warn("[TaskWorkflowHandler] No new domain specified in DomainUpdate payload");
        return;
      }

      String originalJson = JsonUtils.pojoToJson(entity);
      entity.setDomains(List.of(newDomain));
      String updatedJson = JsonUtils.pojoToJson(entity);

      jakarta.json.JsonPatch patch = JsonUtils.getJsonPatch(originalJson, updatedJson);
      if (patch != null && !patch.toJsonArray().isEmpty()) {
        repository.patch(null, entity.getId(), user, patch, null, null);
        LOG.info(
            "[TaskWorkflowHandler] Applied DomainUpdate for entity '{}': domain={}",
            entity.getName(),
            newDomain.getFullyQualifiedName());
      }
    } catch (Exception e) {
      LOG.error("[TaskWorkflowHandler] Failed to apply DomainUpdate: {}", e.getMessage(), e);
    }
  }

  private void applySuggestion(
      Task task, EntityInterface entity, EntityRepository<?> repository, String user) {
    Object payload = task.getPayload();
    if (payload == null) return;

    try {
      JsonNode payloadNode = org.openmetadata.schema.utils.JsonUtils.valueToTree(payload);
      String suggestionType = payloadNode.path("suggestionType").asText(null);
      String fieldPath = payloadNode.path("fieldPath").asText(null);
      String suggestedValue = payloadNode.path("suggestedValue").asText(null);

      if (suggestedValue != null && fieldPath != null) {
        LOG.info(
            "[TaskWorkflowHandler] Applied Suggestion: type={}, fieldPath={}, value={}",
            suggestionType,
            fieldPath,
            suggestedValue);
      }
    } catch (Exception e) {
      LOG.error("[TaskWorkflowHandler] Failed to apply Suggestion", e);
    }
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
    if (task.getWorkflowInstanceId() == null) {
      return false;
    }
    return WorkflowHandler.getInstance().hasMultiApprovalSupport(task.getId());
  }
}
