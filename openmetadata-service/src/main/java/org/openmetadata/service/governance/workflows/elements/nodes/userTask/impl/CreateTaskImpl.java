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

package org.openmetadata.service.governance.workflows.elements.nodes.userTask.impl;

import static org.openmetadata.service.governance.workflows.Workflow.EXCEPTION_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.RELATED_ENTITY_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.WORKFLOW_RUNTIME_EXCEPTION;
import static org.openmetadata.service.governance.workflows.WorkflowHandler.getProcessDefinitionKeyFromId;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.exception.ExceptionUtils;
import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.engine.delegate.BpmnError;
import org.flowable.engine.delegate.TaskListener;
import org.flowable.identitylink.api.IdentityLink;
import org.flowable.task.service.delegate.DelegateTask;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TaskCategory;
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.schema.type.TaskEntityType;
import org.openmetadata.schema.type.TaskPriority;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.governance.workflows.WorkflowVariableHandler;
import org.openmetadata.service.jdbi3.TaskRepository;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.util.WebsocketNotificationHandler;

/**
 * Flowable TaskListener that creates a Task entity (new system) when a workflow reaches an
 * approval node. This replaces CreateApprovalTaskImpl for the new Task entity system.
 *
 * <p>Key differences from CreateApprovalTaskImpl:
 * - Creates Task entity instead of Thread entity
 * - Uses TaskRepository instead of FeedRepository
 * - Links task to WorkflowInstance via workflowInstanceId
 * - Cleaner separation from Feed/Thread complexity
 */
@Slf4j
public class CreateTaskImpl implements TaskListener {
  private Expression inputNamespaceMapExpr;
  private Expression approvalThresholdExpr;
  private Expression rejectionThresholdExpr;
  private Expression taskTypeExpr;
  private Expression taskCategoryExpr;

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
      Integer approvalThreshold = getThresholdValue(approvalThresholdExpr, delegateTask, 1);
      Integer rejectionThreshold = getThresholdValue(rejectionThresholdExpr, delegateTask, 1);

      // Get task type and category
      TaskEntityType taskType = getTaskType(delegateTask);
      TaskCategory taskCategory = getTaskCategory(delegateTask);

      // Get workflow instance ID from the process
      UUID workflowInstanceId = getWorkflowInstanceId(delegateTask);

      // Create the Task entity
      Task task =
          createTask(
              entity,
              assignees,
              taskType,
              taskCategory,
              workflowInstanceId,
              approvalThreshold,
              rejectionThreshold);

      // Register with WorkflowHandler for resolution
      WorkflowHandler.getInstance().setCustomTaskId(delegateTask.getId(), task.getId());

      // Set the thresholds as task variables for use in WorkflowHandler
      delegateTask.setVariable("approvalThreshold", approvalThreshold);
      delegateTask.setVariable("rejectionThreshold", rejectionThreshold);
      delegateTask.setVariable("approversList", new ArrayList<String>());
      delegateTask.setVariable("rejectersList", new ArrayList<String>());
      delegateTask.setVariable("taskEntityId", task.getId().toString());

      LOG.info(
          "[CreateTaskImpl] Created Task entity: id='{}', taskId='{}', type='{}', workflowInstanceId='{}'",
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

  private Integer getThresholdValue(Expression expr, DelegateTask delegateTask, int defaultValue) {
    if (expr != null) {
      String thresholdStr = (String) expr.getValue(delegateTask);
      if (thresholdStr != null && !thresholdStr.isEmpty()) {
        return Integer.parseInt(thresholdStr);
      }
    }
    return defaultValue;
  }

  private TaskEntityType getTaskType(DelegateTask delegateTask) {
    if (taskTypeExpr != null) {
      String typeStr = (String) taskTypeExpr.getValue(delegateTask);
      if (typeStr != null && !typeStr.isEmpty()) {
        return TaskEntityType.fromValue(typeStr);
      }
    }
    return TaskEntityType.GlossaryApproval; // Default for backward compatibility
  }

  private TaskCategory getTaskCategory(DelegateTask delegateTask) {
    if (taskCategoryExpr != null) {
      String categoryStr = (String) taskCategoryExpr.getValue(delegateTask);
      if (categoryStr != null && !categoryStr.isEmpty()) {
        return TaskCategory.fromValue(categoryStr);
      }
    }
    return TaskCategory.Approval; // Default for backward compatibility
  }

  private UUID getWorkflowInstanceId(DelegateTask delegateTask) {
    // Get the root process instance ID which corresponds to our WorkflowInstance
    String processInstanceId = delegateTask.getProcessInstanceId();
    // The workflow instance ID is stored as a variable by WorkflowInstanceListener
    Object workflowInstanceIdObj = delegateTask.getVariable("workflowInstanceId");
    if (workflowInstanceIdObj != null) {
      return UUID.fromString(workflowInstanceIdObj.toString());
    }
    // Fallback: use process instance ID (may not match exactly)
    return null;
  }

  private List<EntityReference> getAssignees(DelegateTask delegateTask) {
    List<EntityReference> assignees = new ArrayList<>();

    Set<IdentityLink> candidates = delegateTask.getCandidates();
    if (!candidates.isEmpty()) {
      for (IdentityLink candidate : candidates) {
        assignees.add(getEntityReferenceFromLinkString(candidate.getUserId()));
      }
    } else if (delegateTask.getAssignee() != null) {
      assignees.add(getEntityReferenceFromLinkString(delegateTask.getAssignee()));
    }
    return assignees;
  }

  private EntityReference getEntityReferenceFromLinkString(String entityLinkString) {
    MessageParser.EntityLink assigneeEntityLink = MessageParser.EntityLink.parse(entityLinkString);
    return Entity.getEntityReferenceByName(
        assigneeEntityLink.getEntityType(), assigneeEntityLink.getEntityFQN(), Include.NON_DELETED);
  }

  private Task createTask(
      EntityInterface entity,
      List<EntityReference> assignees,
      TaskEntityType taskType,
      TaskCategory taskCategory,
      UUID workflowInstanceId,
      Integer approvalThreshold,
      Integer rejectionThreshold) {

    TaskRepository taskRepository = (TaskRepository) Entity.getEntityRepository(Entity.TASK);

    // Build the about reference
    EntityReference aboutRef =
        new EntityReference()
            .withId(entity.getId())
            .withType(Entity.getEntityTypeFromObject(entity))
            .withName(entity.getName())
            .withFullyQualifiedName(entity.getFullyQualifiedName());

    // Build createdBy reference
    EntityReference createdByRef =
        Entity.getEntityReferenceByName(Entity.USER, entity.getUpdatedBy(), Include.NON_DELETED);

    // Create the task
    Task task =
        new Task()
            .withId(UUID.randomUUID())
            .withType(taskType)
            .withCategory(taskCategory)
            .withStatus(TaskEntityStatus.Open)
            .withPriority(TaskPriority.Medium)
            .withAbout(aboutRef)
            .withAssignees(assignees)
            .withCreatedBy(createdByRef)
            .withWorkflowInstanceId(workflowInstanceId)
            .withDescription(buildTaskDescription(entity, taskType))
            .withCreatedAt(System.currentTimeMillis())
            .withUpdatedAt(System.currentTimeMillis())
            .withUpdatedBy(entity.getUpdatedBy());

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
            .withUserName(entity.getUpdatedBy())
            .withTimestamp(task.getUpdatedAt())
            .withEntity(task);

    Entity.getCollectionDAO().changeEventDAO().insert(JsonUtils.pojoToMaskedJson(changeEvent));

    // Send WebSocket Notification
    WebsocketNotificationHandler.handleTaskNotification(task);

    return task;
  }

  private String buildTaskDescription(EntityInterface entity, TaskEntityType taskType) {
    return String.format(
        "Approval required for %s: %s", entity.getEntityReference().getType(), entity.getName());
  }
}
