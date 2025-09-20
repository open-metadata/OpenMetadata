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
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.FieldsAdded;
import org.openmetadata.schema.type.FieldsDeleted;
import org.openmetadata.schema.type.FieldsUpdated;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Post;
import org.openmetadata.schema.type.StructuredDiff;
import org.openmetadata.schema.type.TaskDetails;
import org.openmetadata.schema.type.TaskStatus;
import org.openmetadata.schema.type.TaskType;
import org.openmetadata.schema.type.ThreadType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.governance.workflows.WorkflowVariableHandler;
import org.openmetadata.service.jdbi3.FeedRepository;
import org.openmetadata.service.resources.feeds.FeedMapper;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.util.WebsocketNotificationHandler;

@Slf4j
public class CreateApprovalTaskImpl implements TaskListener {
  private Expression inputNamespaceMapExpr;
  private Expression approvalThresholdExpr;
  private Expression rejectionThresholdExpr;
  private Expression supportsSuggestionsExpr;

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
      Integer approvalThreshold = 1;
      if (approvalThresholdExpr != null) {
        String thresholdStr = (String) approvalThresholdExpr.getValue(delegateTask);
        if (thresholdStr != null && !thresholdStr.isEmpty()) {
          approvalThreshold = Integer.parseInt(thresholdStr);
        }
      }

      // Get rejection threshold, default to 1 if not set
      Integer rejectionThreshold = 1;
      if (rejectionThresholdExpr != null) {
        String thresholdStr = (String) rejectionThresholdExpr.getValue(delegateTask);
        if (thresholdStr != null && !thresholdStr.isEmpty()) {
          rejectionThreshold = Integer.parseInt(thresholdStr);
        }
      }

      // Get supportsSuggestions flag from config
      boolean supportsSuggestions = false;
      if (supportsSuggestionsExpr != null) {
        String suggestionsStr = (String) supportsSuggestionsExpr.getValue(delegateTask);
        if (suggestionsStr != null && !suggestionsStr.isEmpty()) {
          supportsSuggestions = Boolean.parseBoolean(suggestionsStr);
        }
      }

      Thread task = createApprovalTask(entity, assignees, supportsSuggestions);
      WorkflowHandler.getInstance().setCustomTaskId(delegateTask.getId(), task.getId());

      // Store approval and rejection thresholds and initialize approval tracking in task variables
      delegateTask.setVariable("approvalThreshold", approvalThreshold);
      delegateTask.setVariable("rejectionThreshold", rejectionThreshold);
      // Use separate lists for approvers and rejecters - simpler and cleaner
      delegateTask.setVariable("approversList", new ArrayList<String>());
      delegateTask.setVariable("rejectersList", new ArrayList<String>());
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

  private Thread createApprovalTask(
      EntityInterface entity, List<EntityReference> assignees, boolean supportsSuggestions) {
    FeedRepository feedRepository = Entity.getFeedRepository();
    MessageParser.EntityLink about =
        new MessageParser.EntityLink(
            Entity.getEntityTypeFromObject(entity), entity.getFullyQualifiedName());

    Thread thread = null;
    boolean existingTaskFound = false;

    try {
      // Check for any existing open approval tasks
      thread = feedRepository.getTask(about, TaskType.RequestApproval, TaskStatus.Open);
      existingTaskFound = true;
      LOG.info(
          "Found existing approval task for entity: {}, updating it with new changes",
          entity.getFullyQualifiedName());
    } catch (EntityNotFoundException ex) {
      // No existing task found - we'll create a new one
      LOG.debug(
          "No existing approval task found for entity: {}, creating new one",
          entity.getFullyQualifiedName());
    }

    // Build the task message and details
    String taskMessage;
    TaskDetails taskDetails =
        new TaskDetails()
            .withAssignees(FeedMapper.formatAssignees(assignees))
            .withType(TaskType.RequestApproval)
            .withStatus(TaskStatus.Open)
            .withSupportsSuggestions(supportsSuggestions);

    // Check if we have changes to show (for updates)
    if (entity.getChangeDescription() != null
        && hasRelevantChanges(entity.getChangeDescription())) {
      // Build detailed change message
      taskMessage = buildDetailedChangeMessage(entity, supportsSuggestions);

      // Add structured diff information only - no more ugly string formats
      taskDetails.withStructuredDiff(buildStructuredDiff(entity));
    } else {
      // Simple approval message for new entities or entities without changes
      taskMessage =
          "Approval required for "
              + entity.getEntityReference().getType()
              + ": "
              + entity.getFullyQualifiedName();
    }

    if (existingTaskFound && thread != null) {
      // Update the existing thread with new task details
      thread.setMessage(taskMessage);
      thread.setTask(taskDetails);
      thread.setUpdatedBy(entity.getUpdatedBy());
      thread.setUpdatedAt(System.currentTimeMillis());

      // Update the thread in the repository using internal DAO
      Entity.getCollectionDAO().feedDAO().update(thread.getId(), JsonUtils.pojoToJson(thread));

      // Add a system post to indicate the task was updated
      Post updateNotification =
          new Post()
              .withId(UUID.randomUUID())
              .withMessage("Task updated with new changes by " + entity.getUpdatedBy())
              .withFrom(entity.getUpdatedBy())
              .withPostTs(System.currentTimeMillis());
      feedRepository.addPostToThread(thread.getId(), updateNotification, entity.getUpdatedBy());

      // Send WebSocket Notification for update
      WebsocketNotificationHandler.handleTaskNotification(thread);
    } else {
      // Create a new thread
      thread =
          new Thread()
              .withId(UUID.randomUUID())
              .withThreadTs(System.currentTimeMillis())
              .withMessage(taskMessage)
              .withCreatedBy(entity.getUpdatedBy())
              .withAbout(about.getLinkString())
              .withType(ThreadType.Task)
              .withTask(taskDetails)
              .withUpdatedBy(entity.getUpdatedBy())
              .withUpdatedAt(System.currentTimeMillis());
      feedRepository.create(thread);

      // Send WebSocket Notification for new task
      WebsocketNotificationHandler.handleTaskNotification(thread);
    }

    return thread;
  }

  private boolean hasRelevantChanges(ChangeDescription changeDescription) {
    // Check if there are any non-workflow-controlled field changes
    boolean hasAddedFields =
        changeDescription.getFieldsAdded() != null
            && changeDescription.getFieldsAdded().stream()
                .anyMatch(field -> !isWorkflowControlledField(field.getName()));

    boolean hasUpdatedFields =
        changeDescription.getFieldsUpdated() != null
            && changeDescription.getFieldsUpdated().stream()
                .anyMatch(field -> !isWorkflowControlledField(field.getName()));

    boolean hasDeletedFields =
        changeDescription.getFieldsDeleted() != null
            && changeDescription.getFieldsDeleted().stream()
                .anyMatch(field -> !isWorkflowControlledField(field.getName()));

    return hasAddedFields || hasUpdatedFields || hasDeletedFields;
  }

  private String buildDetailedChangeMessage(EntityInterface entity, boolean supportsSuggestions) {
    StringBuilder message = new StringBuilder();
    message.append("Approval Required\n\n");
    message.append("Entity: ").append(entity.getFullyQualifiedName()).append("\n");
    message.append("Type: ").append(entity.getEntityReference().getType()).append("\n");

    if (entity.getUpdatedBy() != null) {
      message.append("Updated By: ").append(entity.getUpdatedBy()).append("\n");
    }

    ChangeDescription changeDescription = entity.getChangeDescription();
    if (changeDescription != null) {
      // Count changes (excluding workflow-controlled fields)
      int fieldsAdded =
          changeDescription.getFieldsAdded() != null
              ? (int)
                  changeDescription.getFieldsAdded().stream()
                      .filter(field -> !isWorkflowControlledField(field.getName()))
                      .count()
              : 0;

      int fieldsUpdated =
          changeDescription.getFieldsUpdated() != null
              ? (int)
                  changeDescription.getFieldsUpdated().stream()
                      .filter(field -> !isWorkflowControlledField(field.getName()))
                      .count()
              : 0;

      int fieldsDeleted =
          changeDescription.getFieldsDeleted() != null
              ? (int)
                  changeDescription.getFieldsDeleted().stream()
                      .filter(field -> !isWorkflowControlledField(field.getName()))
                      .count()
              : 0;

      if (fieldsAdded > 0 || fieldsUpdated > 0 || fieldsDeleted > 0) {
        message.append("\nChanges: ");
        List<String> changes = new ArrayList<>();

        if (fieldsAdded > 0) {
          changes.add(fieldsAdded + " field" + (fieldsAdded > 1 ? "s" : "") + " added");
        }
        if (fieldsUpdated > 0) {
          changes.add(fieldsUpdated + " field" + (fieldsUpdated > 1 ? "s" : "") + " updated");
        }
        if (fieldsDeleted > 0) {
          changes.add(fieldsDeleted + " field" + (fieldsDeleted > 1 ? "s" : "") + " removed");
        }

        message.append(String.join(", ", changes));
      }
    }

    message.append("\n\nPlease review and provide your approval or rejection.");
    if (supportsSuggestions) {
      message.append("\nYou may also add comments or suggestions.");
    }

    return message.toString();
  }

  // Fields that are controlled by the workflow and should be excluded from change tracking
  private static final Set<String> WORKFLOW_CONTROLLED_FIELDS =
      Set.of("status", "workflowStatus", "lifecycleState", "state", "entityStatus");

  private boolean isWorkflowControlledField(String fieldName) {
    String lowerFieldName = fieldName.toLowerCase();
    return WORKFLOW_CONTROLLED_FIELDS.stream().anyMatch(lowerFieldName::contains);
  }

  private StructuredDiff buildStructuredDiff(EntityInterface entity) {
    ChangeDescription changeDescription = entity.getChangeDescription();
    if (changeDescription == null) {
      return null;
    }

    StructuredDiff diff = new StructuredDiff();

    // Process added fields
    if (changeDescription.getFieldsAdded() != null) {
      List<FieldsAdded> addedList = new ArrayList<>();
      for (FieldChange field : changeDescription.getFieldsAdded()) {
        if (isWorkflowControlledField(field.getName())) {
          continue;
        }
        FieldsAdded added = new FieldsAdded();
        added.setName(field.getName());
        added.setNewValue(field.getNewValue());
        addedList.add(added);
      }
      if (!addedList.isEmpty()) {
        diff.setFieldsAdded(addedList);
      }
    }

    // Process updated fields
    if (changeDescription.getFieldsUpdated() != null) {
      List<FieldsUpdated> updatedList = new ArrayList<>();
      for (FieldChange field : changeDescription.getFieldsUpdated()) {
        if (isWorkflowControlledField(field.getName())) {
          continue;
        }
        FieldsUpdated updated = new FieldsUpdated();
        updated.setName(field.getName());
        updated.setOldValue(field.getOldValue());
        updated.setNewValue(field.getNewValue());
        updatedList.add(updated);
      }
      if (!updatedList.isEmpty()) {
        diff.setFieldsUpdated(updatedList);
      }
    }

    // Process deleted fields
    if (changeDescription.getFieldsDeleted() != null) {
      List<FieldsDeleted> deletedList = new ArrayList<>();
      for (FieldChange field : changeDescription.getFieldsDeleted()) {
        if (isWorkflowControlledField(field.getName())) {
          continue;
        }
        FieldsDeleted deleted = new FieldsDeleted();
        deleted.setName(field.getName());
        deleted.setOldValue(field.getOldValue());
        deletedList.add(deleted);
      }
      if (!deletedList.isEmpty()) {
        diff.setFieldsDeleted(deletedList);
      }
    }

    // Return null if no changes to avoid empty object
    if ((diff.getFieldsAdded() == null || diff.getFieldsAdded().isEmpty())
        && (diff.getFieldsUpdated() == null || diff.getFieldsUpdated().isEmpty())
        && (diff.getFieldsDeleted() == null || diff.getFieldsDeleted().isEmpty())) {
      return null;
    }

    return diff;
  }
}
