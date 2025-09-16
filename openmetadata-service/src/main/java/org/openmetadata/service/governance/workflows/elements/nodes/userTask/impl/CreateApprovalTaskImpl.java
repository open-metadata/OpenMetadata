package org.openmetadata.service.governance.workflows.elements.nodes.userTask.impl;

import static org.openmetadata.service.governance.workflows.Workflow.EXCEPTION_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.RELATED_ENTITY_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.WORKFLOW_RUNTIME_EXCEPTION;
import static org.openmetadata.service.governance.workflows.WorkflowHandler.getProcessDefinitionKeyFromId;

import java.util.ArrayList;
import java.util.HashMap;
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
import org.openmetadata.schema.type.Include;
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

    Thread thread;

    try {
      // Check for any existing open approval tasks
      thread = feedRepository.getTask(about, TaskType.RequestApproval, TaskStatus.Open);
      // If there's a Task already opened, we resolve the Flowable task before creating a new
      // UserTask in the new WorkflowInstance
      WorkflowHandler.getInstance()
          .terminateTaskProcessInstance(thread.getId(), "A Newer Process Instance is Running.");
    } catch (EntityNotFoundException ex) {
      // Also check for legacy ChangeReview tasks if they exist
      try {
        Thread changeReviewTask =
            feedRepository.getTask(about, TaskType.ChangeReview, TaskStatus.Open);
        WorkflowHandler.getInstance()
            .terminateTaskProcessInstance(
                changeReviewTask.getId(), "Superseded by new approval task.");
      } catch (EntityNotFoundException ignore) {
        // No conflict, proceed with creating the new task
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

        // Add diff information
        taskDetails
            .withOldValue(buildOldValueSummary(entity))
            .withNewValue(buildNewValueSummary(entity))
            .withSuggestion(generateContextAwareSuggestion(entity));
      } else {
        // Simple approval message for new entities or entities without changes
        taskMessage =
            "Approval required for "
                + entity.getEntityReference().getType()
                + ": "
                + entity.getFullyQualifiedName();
      }

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

      // Send WebSocket Notification
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
    message.append("Approval Required for Entity Changes\n\n");
    message.append("Entity: ").append(entity.getFullyQualifiedName()).append("\n");
    message.append("Type: ").append(entity.getEntityReference().getType()).append("\n");

    if (entity.getVersion() != null) {
      message.append("Version: ").append(String.format("%.1f", entity.getVersion())).append("\n");
    }

    if (entity.getUpdatedBy() != null) {
      message.append("Updated By: ").append(entity.getUpdatedBy()).append("\n");
    }

    message.append("\n");

    ChangeDescription changeDescription = entity.getChangeDescription();
    if (changeDescription != null) {
      message.append("Changes Made:\n\n");

      // Fields Added (excluding workflow-controlled)
      List<FieldChange> addedFields =
          changeDescription.getFieldsAdded() != null
              ? changeDescription.getFieldsAdded().stream()
                  .filter(field -> !isWorkflowControlledField(field.getName()))
                  .toList()
              : List.of();

      if (!addedFields.isEmpty()) {
        message.append("Fields Added:\n");
        for (FieldChange field : addedFields) {
          message.append("  - ").append(formatFieldName(field.getName())).append(": ");
          message.append(formatFieldValue(field.getNewValue(), field.getName())).append("\n");
        }
        message.append("\n");
      }

      // Fields Updated (excluding workflow-controlled)
      List<FieldChange> updatedFields =
          changeDescription.getFieldsUpdated() != null
              ? changeDescription.getFieldsUpdated().stream()
                  .filter(field -> !isWorkflowControlledField(field.getName()))
                  .toList()
              : List.of();

      if (!updatedFields.isEmpty()) {
        message.append("Fields Updated:\n");
        for (FieldChange field : updatedFields) {
          message.append("  - ").append(formatFieldName(field.getName())).append(":\n");
          message
              .append("    Previous: ")
              .append(formatFieldValue(field.getOldValue(), field.getName()))
              .append("\n");
          message
              .append("    New: ")
              .append(formatFieldValue(field.getNewValue(), field.getName()))
              .append("\n");
        }
        message.append("\n");
      }

      // Fields Deleted (excluding workflow-controlled)
      List<FieldChange> deletedFields =
          changeDescription.getFieldsDeleted() != null
              ? changeDescription.getFieldsDeleted().stream()
                  .filter(field -> !isWorkflowControlledField(field.getName()))
                  .toList()
              : List.of();

      if (!deletedFields.isEmpty()) {
        message.append("Fields Removed:\n");
        for (FieldChange field : deletedFields) {
          message.append("  - ").append(formatFieldName(field.getName())).append(": ");
          message.append(formatFieldValue(field.getOldValue(), field.getName())).append("\n");
        }
        message.append("\n");
      }
    }

    message.append("\nPlease review the changes and provide your approval or rejection.\n");
    if (supportsSuggestions) {
      message.append("You may also add comments with suggestions or feedback.");
    }

    return message.toString();
  }

  private String formatFieldName(String fieldName) {
    // Convert camelCase to human-readable format
    if (fieldName == null) return "Unknown Field";

    // Handle nested field paths
    if (fieldName.contains(".")) {
      String[] parts = fieldName.split("\\.");
      StringBuilder formatted = new StringBuilder();
      for (int i = 0; i < parts.length; i++) {
        if (i > 0) formatted.append(" > ");
        formatted.append(camelCaseToHumanReadable(parts[i]));
      }
      return formatted.toString();
    }

    return camelCaseToHumanReadable(fieldName);
  }

  private String camelCaseToHumanReadable(String camelCase) {
    if (camelCase == null || camelCase.isEmpty()) return camelCase;

    StringBuilder result = new StringBuilder();
    result.append(Character.toUpperCase(camelCase.charAt(0)));

    for (int i = 1; i < camelCase.length(); i++) {
      char ch = camelCase.charAt(i);
      if (Character.isUpperCase(ch)) {
        result.append(" ");
      }
      result.append(ch);
    }

    return result.toString();
  }

  private String formatFieldValue(Object value, String fieldName) {
    if (value == null) {
      return "(empty)";
    }

    // Handle different types of values based on field name
    if (fieldName != null) {
      if (fieldName.toLowerCase().contains("description")) {
        return formatDescription(value);
      } else if (fieldName.toLowerCase().contains("tag")) {
        return formatTags(value);
      } else if (fieldName.toLowerCase().contains("owner")) {
        return formatOwner(value);
      } else if (fieldName.toLowerCase().contains("tier")) {
        return formatTier(value);
      }
    }

    // Handle collections
    if (value instanceof List) {
      return formatList((List<?>) value);
    } else if (value instanceof Map) {
      return formatMap((Map<?, ?>) value);
    } else if (value instanceof String) {
      String strValue = (String) value;
      if (strValue.isEmpty()) {
        return "(empty)";
      }
      // Truncate very long values for readability
      if (strValue.length() > 500) {
        return strValue.substring(0, 497) + "...";
      }
      return strValue;
    }

    return String.valueOf(value);
  }

  private String formatDescription(Object value) {
    if (value == null) return "(no description)";
    String desc = value.toString();
    if (desc.length() > 200) {
      return desc.substring(0, 197) + "...";
    }
    return desc;
  }

  private String formatTags(Object value) {
    if (value instanceof List) {
      List<?> tags = (List<?>) value;
      if (tags.isEmpty()) return "(no tags)";
      StringBuilder result = new StringBuilder();
      for (int i = 0; i < Math.min(5, tags.size()); i++) {
        if (i > 0) result.append(", ");
        result.append(tags.get(i));
      }
      if (tags.size() > 5) {
        result.append(" and ").append(tags.size() - 5).append(" more");
      }
      return result.toString();
    }
    return String.valueOf(value);
  }

  private String formatOwner(Object value) {
    if (value instanceof Map) {
      Map<?, ?> owner = (Map<?, ?>) value;
      Object name = owner.get("name");
      Object type = owner.get("type");
      if (name != null) {
        return name.toString() + (type != null ? " (" + type + ")" : "");
      }
    }
    return String.valueOf(value);
  }

  private String formatTier(Object value) {
    if (value instanceof Map) {
      Map<?, ?> tier = (Map<?, ?>) value;
      Object name = tier.get("name");
      if (name != null) {
        return name.toString();
      }
    }
    return String.valueOf(value);
  }

  private String formatList(List<?> list) {
    if (list.isEmpty()) return "[]";

    StringBuilder result = new StringBuilder("[");
    for (int i = 0; i < Math.min(3, list.size()); i++) {
      if (i > 0) result.append(", ");
      Object item = list.get(i);
      if (item instanceof Map) {
        Map<?, ?> map = (Map<?, ?>) item;
        Object name = map.get("name");
        if (name != null) {
          result.append(name);
        } else {
          result.append("{...}");
        }
      } else {
        result.append(item);
      }
    }
    if (list.size() > 3) {
      result.append(", ... (").append(list.size()).append(" total)");
    }
    result.append("]");
    return result.toString();
  }

  private String formatMap(Map<?, ?> map) {
    if (map.isEmpty()) return "{}";

    // Try to extract meaningful information from the map
    Object name = map.get("name");
    Object displayName = map.get("displayName");
    Object type = map.get("type");

    if (displayName != null) {
      return displayName.toString();
    } else if (name != null) {
      return name.toString() + (type != null ? " (" + type + ")" : "");
    } else {
      return "{" + map.size() + " fields}";
    }
  }

  // Fields that are controlled by the workflow and should be excluded from change tracking
  private static final Set<String> WORKFLOW_CONTROLLED_FIELDS =
      Set.of("status", "workflowStatus", "lifecycleState", "state", "entityStatus");

  private boolean isWorkflowControlledField(String fieldName) {
    String lowerFieldName = fieldName.toLowerCase();
    return WORKFLOW_CONTROLLED_FIELDS.stream().anyMatch(lowerFieldName::contains);
  }

  private String buildOldValueSummary(EntityInterface entity) {
    ChangeDescription changeDescription = entity.getChangeDescription();
    if (changeDescription == null) {
      return "";
    }

    StringBuilder oldValue = new StringBuilder();

    // Add updated field's old values (excluding workflow-controlled fields)
    if (changeDescription.getFieldsUpdated() != null) {
      for (FieldChange field : changeDescription.getFieldsUpdated()) {
        if (isWorkflowControlledField(field.getName())) {
          continue; // Skip workflow-controlled fields
        }
        if (oldValue.length() > 0) {
          oldValue.append("\n");
        }
        oldValue.append(formatFieldName(field.getName())).append(": ");
        oldValue.append(formatFieldValue(field.getOldValue(), field.getName()));
      }
    }

    // Add deleted fields (excluding workflow-controlled fields)
    if (changeDescription.getFieldsDeleted() != null) {
      for (FieldChange field : changeDescription.getFieldsDeleted()) {
        if (isWorkflowControlledField(field.getName())) {
          continue; // Skip workflow-controlled fields
        }
        if (oldValue.length() > 0) {
          oldValue.append("\n");
        }
        oldValue.append(formatFieldName(field.getName())).append(": ");
        oldValue.append(formatFieldValue(field.getOldValue(), field.getName()));
      }
    }

    return oldValue.toString();
  }

  private String buildNewValueSummary(EntityInterface entity) {
    ChangeDescription changeDescription = entity.getChangeDescription();
    if (changeDescription == null) {
      return "";
    }

    StringBuilder newValue = new StringBuilder();

    // Add updated field's new values (excluding workflow-controlled fields)
    if (changeDescription.getFieldsUpdated() != null) {
      for (FieldChange field : changeDescription.getFieldsUpdated()) {
        if (isWorkflowControlledField(field.getName())) {
          continue; // Skip workflow-controlled fields
        }
        if (newValue.length() > 0) {
          newValue.append("\n");
        }
        newValue.append(formatFieldName(field.getName())).append(": ");
        newValue.append(formatFieldValue(field.getNewValue(), field.getName()));
      }
    }

    // Add added fields (excluding workflow-controlled fields)
    if (changeDescription.getFieldsAdded() != null) {
      for (FieldChange field : changeDescription.getFieldsAdded()) {
        if (isWorkflowControlledField(field.getName())) {
          continue; // Skip workflow-controlled fields
        }
        if (newValue.length() > 0) {
          newValue.append("\n");
        }
        newValue.append(formatFieldName(field.getName())).append(": ");
        newValue.append(formatFieldValue(field.getNewValue(), field.getName()));
      }
    }

    return newValue.toString();
  }

  private String generateContextAwareSuggestion(EntityInterface entity) {
    ChangeDescription changeDescription = entity.getChangeDescription();

    if (changeDescription == null) {
      return JsonUtils.pojoToJson(
          Map.of(
              "action", "review",
              "message", "Please review the entity and provide your approval."));
    }

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
    int totalChanges = fieldsAdded + fieldsUpdated + fieldsDeleted;

    // Build simple suggestion
    Map<String, Object> suggestion = new HashMap<>();
    String message;

    if (totalChanges == 0) {
      message = "Please review the entity and provide your approval.";
    } else {
      // Build a simple summary of changes
      List<String> changeSummary = new ArrayList<>();
      if (fieldsUpdated > 0) {
        changeSummary.add(fieldsUpdated + " field" + (fieldsUpdated > 1 ? "s" : "") + " updated");
      }
      if (fieldsAdded > 0) {
        changeSummary.add(fieldsAdded + " field" + (fieldsAdded > 1 ? "s" : "") + " added");
      }
      if (fieldsDeleted > 0) {
        changeSummary.add(fieldsDeleted + " field" + (fieldsDeleted > 1 ? "s" : "") + " removed");
      }

      message =
          "Review " + String.join(", ", changeSummary) + " and provide your approval or feedback.";
    }

    suggestion.put("action", "review_changes");
    suggestion.put("message", message);

    // Add simple metadata
    if (totalChanges > 0) {
      Map<String, Integer> changeStats = new HashMap<>();
      if (fieldsAdded > 0) changeStats.put("added", fieldsAdded);
      if (fieldsUpdated > 0) changeStats.put("updated", fieldsUpdated);
      if (fieldsDeleted > 0) changeStats.put("deleted", fieldsDeleted);
      suggestion.put("changeSummary", changeStats);
    }

    return JsonUtils.pojoToJson(suggestion);
  }
}
