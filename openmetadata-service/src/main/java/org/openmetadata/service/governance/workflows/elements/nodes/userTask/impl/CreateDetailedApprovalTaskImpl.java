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
import org.apache.commons.lang.exception.ExceptionUtils;
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
public class CreateDetailedApprovalTaskImpl implements TaskListener {
  private Expression inputNamespaceMapExpr;
  private Expression approvalThresholdExpr;
  private Expression rejectionThresholdExpr;

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

      Thread task = createDetailedApprovalTask(entity, assignees);
      WorkflowHandler.getInstance().setCustomTaskId(delegateTask.getId(), task.getId());

      // Store approval and rejection thresholds and initialize approval tracking in task variables
      delegateTask.setVariable("approvalThreshold", approvalThreshold);
      delegateTask.setVariable("rejectionThreshold", rejectionThreshold);
      delegateTask.setVariable("approvals", new ArrayList<Map<String, Object>>());
      delegateTask.setVariable("approvalCount", 0);
      delegateTask.setVariable("rejectionCount", 0);
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
    } else {
      assignees.add(getEntityReferenceFromLinkString(delegateTask.getAssignee()));
    }
    return assignees;
  }

  private EntityReference getEntityReferenceFromLinkString(String entityLinkString) {
    MessageParser.EntityLink assigneeEntityLink = MessageParser.EntityLink.parse(entityLinkString);
    return Entity.getEntityReferenceByName(
        assigneeEntityLink.getEntityType(), assigneeEntityLink.getEntityFQN(), Include.NON_DELETED);
  }

  private Thread createDetailedApprovalTask(
      EntityInterface entity, List<EntityReference> assignees) {
    FeedRepository feedRepository = Entity.getFeedRepository();
    MessageParser.EntityLink about =
        new MessageParser.EntityLink(
            Entity.getEntityTypeFromObject(entity), entity.getFullyQualifiedName());

    Thread thread;

    try {
      thread = feedRepository.getTask(about, TaskType.RequestApproval, TaskStatus.Open);
      // If there's a Task already opened, we resolve the Flowable task before creating a new
      // UserTask in the new WorkflowInstance
      WorkflowHandler.getInstance()
          .terminateTaskProcessInstance(thread.getId(), "A Newer Process Instance is Running.");
    } catch (EntityNotFoundException ex) {
      // Store detailed change information in the thread message
      String changeInformation = buildDetailedChangeMessage(entity);

      TaskDetails taskDetails =
          new TaskDetails()
              .withAssignees(FeedMapper.formatAssignees(assignees))
              .withType(TaskType.RequestApproval)
              .withStatus(TaskStatus.Open)
              .withOldValue("Current entity state")
              .withSuggestion("Please review and approve the changes");

      thread =
          new Thread()
              .withId(UUID.randomUUID())
              .withThreadTs(System.currentTimeMillis())
              .withMessage(changeInformation)
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

  private String buildDetailedChangeMessage(EntityInterface entity) {
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

      // Fields Added
      if (changeDescription.getFieldsAdded() != null
          && !changeDescription.getFieldsAdded().isEmpty()) {
        message.append("Fields Added:\n");
        for (FieldChange field : changeDescription.getFieldsAdded()) {
          message.append("  - ").append(formatFieldName(field.getName())).append(": ");
          message.append(formatFieldValue(field.getNewValue(), field.getName())).append("\n");
        }
        message.append("\n");
      }

      // Fields Updated
      if (changeDescription.getFieldsUpdated() != null
          && !changeDescription.getFieldsUpdated().isEmpty()) {
        message.append("Fields Updated:\n");
        for (FieldChange field : changeDescription.getFieldsUpdated()) {
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

      // Fields Deleted
      if (changeDescription.getFieldsDeleted() != null
          && !changeDescription.getFieldsDeleted().isEmpty()) {
        message.append("Fields Removed:\n");
        for (FieldChange field : changeDescription.getFieldsDeleted()) {
          message.append("  - ").append(formatFieldName(field.getName())).append(": ");
          message.append(formatFieldValue(field.getOldValue(), field.getName())).append("\n");
        }
        message.append("\n");
      }
    } else {
      message.append("No specific field changes tracked in this update.\n\n");
    }

    message.append("\nPlease review the changes and provide your approval or rejection.\n");
    message.append("You may also add comments with suggestions or feedback.");

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
}
