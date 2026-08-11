/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.tasks;

import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.feed.TaskFormSchema;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.TaskCategory;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.TaskFormSchemaRepository;

/** Resolves schema-driven task execution metadata from TaskFormSchema uiSchema bindings. */
@Slf4j
public final class TaskFormExecutionResolver {

  public enum HandlerType {
    DESCRIPTION_UPDATE,
    TAG_UPDATE,
    OWNERSHIP_UPDATE,
    TIER_UPDATE,
    DOMAIN_UPDATE,
    APPROVAL,
    INCIDENT,
    FEEDBACK_APPROVAL,
    SUGGESTION,
    CUSTOM
  }

  public record TaskExecutionBinding(
      HandlerType handlerType,
      MetadataOperation permissionOperation,
      String fieldPathField,
      String valueField,
      String currentTagsField,
      String addTagsField,
      String removeTagsField) {}

  public enum ActionType {
    SET_DESCRIPTION,
    MERGE_TAGS,
    REPLACE_OWNERS,
    APPLY_TIER,
    REPLACE_DOMAINS,
    PATCH_ENTITY_FIELD,
    APPLY_SUGGESTION
  }

  public record TaskExecutionAction(
      ActionType actionType,
      String fieldPathField,
      String valueField,
      String currentTagsField,
      String addTagsField,
      String removeTagsField,
      String payloadField,
      String entityField,
      Object staticValue) {}

  public record TaskExecutionPlan(
      List<TaskExecutionAction> approveActions, List<TaskExecutionAction> rejectActions) {}

  private TaskFormExecutionResolver() {}

  public static TaskExecutionBinding resolve(Task task) {
    TaskExecutionBinding defaults = defaultBinding(task);
    if (task == null || task.getType() == null) {
      return defaults;
    }

    try {
      TaskFormSchemaRepository schemaRepository =
          (TaskFormSchemaRepository) Entity.getEntityRepository(Entity.TASK_FORM_SCHEMA);

      return schemaRepository
          .resolve(
              task.getType().value(),
              task.getCategory() != null ? task.getCategory().value() : null,
              task.getPayload())
          .map(schema -> merge(defaults, fromSchema(schema)))
          .orElse(defaults);
    } catch (Exception e) {
      LOG.debug(
          "Falling back to default task execution binding for task '{}' due to schema resolution error: {}",
          task.getId(),
          e.getMessage());
      return defaults;
    }
  }

  public static TaskExecutionPlan resolveExecutionPlan(Task task) {
    TaskExecutionPlan defaults = defaultExecutionPlan(task);
    if (task == null || task.getType() == null) {
      return defaults;
    }

    try {
      TaskFormSchemaRepository schemaRepository =
          (TaskFormSchemaRepository) Entity.getEntityRepository(Entity.TASK_FORM_SCHEMA);

      return schemaRepository
          .resolve(
              task.getType().value(),
              task.getCategory() != null ? task.getCategory().value() : null,
              task.getPayload())
          .map(schema -> merge(defaults, fromExecutionSchema(schema)))
          .orElse(defaults);
    } catch (Exception e) {
      LOG.debug(
          "Falling back to default task execution plan for task '{}' due to schema resolution error: {}",
          task.getId(),
          e.getMessage());
      return defaults;
    }
  }

  static TaskExecutionBinding fromSchema(TaskFormSchema schema) {
    if (schema == null || schema.getUiSchema() == null) {
      return null;
    }

    Map<String, Object> uiSchema = JsonUtils.readOrConvertValue(schema.getUiSchema(), Map.class);
    Object handlerConfigObject = uiSchema.get("ui:handler");
    if (!(handlerConfigObject instanceof Map<?, ?> rawHandlerConfig)) {
      return null;
    }

    String handlerTypeValue = stringValue(rawHandlerConfig.get("type"));
    HandlerType handlerType = parseHandlerType(handlerTypeValue);
    if (handlerType == null) {
      return null;
    }

    return new TaskExecutionBinding(
        handlerType,
        parseOperation(stringValue(rawHandlerConfig.get("permission"))),
        stringValue(rawHandlerConfig.get("fieldPathField")),
        stringValue(rawHandlerConfig.get("valueField")),
        stringValue(rawHandlerConfig.get("currentTagsField")),
        stringValue(rawHandlerConfig.get("addTagsField")),
        stringValue(rawHandlerConfig.get("removeTagsField")));
  }

  static TaskExecutionPlan fromExecutionSchema(TaskFormSchema schema) {
    if (schema == null || schema.getUiSchema() == null) {
      return null;
    }

    Map<String, Object> uiSchema = JsonUtils.readOrConvertValue(schema.getUiSchema(), Map.class);
    Object executionConfigObject = uiSchema.get("ui:execution");
    if (!(executionConfigObject instanceof Map<?, ?> rawExecutionConfig)) {
      return null;
    }

    return new TaskExecutionPlan(
        parseActions(rawExecutionConfig.get("approve")),
        parseActions(rawExecutionConfig.get("reject")));
  }

  private static TaskExecutionBinding defaultBinding(Task task) {
    if (task == null || task.getType() == null) {
      return new TaskExecutionBinding(HandlerType.CUSTOM, null, null, null, null, null, null);
    }

    if (task.getCategory() == TaskCategory.Review && hasFeedbackPayload(task)) {
      return new TaskExecutionBinding(
          HandlerType.FEEDBACK_APPROVAL, MetadataOperation.EDIT_ALL, null, null, null, null, null);
    }

    return switch (task.getType()) {
      case DescriptionUpdate -> new TaskExecutionBinding(
          HandlerType.DESCRIPTION_UPDATE,
          MetadataOperation.EDIT_DESCRIPTION,
          "fieldPath",
          "newDescription",
          null,
          null,
          null);
      case TagUpdate -> new TaskExecutionBinding(
          HandlerType.TAG_UPDATE,
          MetadataOperation.EDIT_TAGS,
          "fieldPath",
          null,
          "currentTags",
          "tagsToAdd",
          "tagsToRemove");
      case OwnershipUpdate -> new TaskExecutionBinding(
          HandlerType.OWNERSHIP_UPDATE,
          MetadataOperation.EDIT_OWNERS,
          null,
          null,
          null,
          null,
          null);
      case TierUpdate -> new TaskExecutionBinding(
          HandlerType.TIER_UPDATE, MetadataOperation.EDIT_TIER, null, null, null, null, null);
      case DomainUpdate -> new TaskExecutionBinding(
          HandlerType.DOMAIN_UPDATE, MetadataOperation.EDIT_ALL, null, null, null, null, null);
      case GlossaryApproval, RequestApproval -> new TaskExecutionBinding(
          HandlerType.APPROVAL, MetadataOperation.EDIT_ALL, null, null, null, null, null);
      case TestCaseResolution, IncidentResolution -> new TaskExecutionBinding(
          HandlerType.INCIDENT, null, null, null, null, null, null);
      case Suggestion -> new TaskExecutionBinding(
          HandlerType.SUGGESTION, null, null, null, null, null, null);
      default -> new TaskExecutionBinding(HandlerType.CUSTOM, null, null, null, null, null, null);
    };
  }

  private static TaskExecutionPlan defaultExecutionPlan(Task task) {
    if (task == null || task.getType() == null) {
      return new TaskExecutionPlan(List.of(), List.of());
    }

    TaskExecutionBinding binding = defaultBinding(task);

    return switch (binding.handlerType()) {
      case DESCRIPTION_UPDATE -> new TaskExecutionPlan(
          List.of(
              new TaskExecutionAction(
                  ActionType.SET_DESCRIPTION,
                  binding.fieldPathField(),
                  binding.valueField(),
                  null,
                  null,
                  null,
                  null,
                  null,
                  null)),
          List.of());
      case TAG_UPDATE -> new TaskExecutionPlan(
          List.of(
              new TaskExecutionAction(
                  ActionType.MERGE_TAGS,
                  binding.fieldPathField(),
                  null,
                  binding.currentTagsField(),
                  binding.addTagsField(),
                  binding.removeTagsField(),
                  null,
                  null,
                  null)),
          List.of());
      case OWNERSHIP_UPDATE -> new TaskExecutionPlan(
          List.of(
              new TaskExecutionAction(
                  ActionType.REPLACE_OWNERS,
                  null,
                  null,
                  null,
                  null,
                  null,
                  "newOwners",
                  null,
                  null)),
          List.of());
      case TIER_UPDATE -> new TaskExecutionPlan(
          List.of(
              new TaskExecutionAction(
                  ActionType.APPLY_TIER, null, null, null, null, null, "newTier", null, null)),
          List.of());
      case DOMAIN_UPDATE -> new TaskExecutionPlan(
          List.of(
              new TaskExecutionAction(
                  ActionType.REPLACE_DOMAINS,
                  null,
                  null,
                  null,
                  null,
                  null,
                  "newDomain",
                  null,
                  null)),
          List.of());
      case APPROVAL -> new TaskExecutionPlan(
          List.of(
              new TaskExecutionAction(
                  ActionType.PATCH_ENTITY_FIELD,
                  null,
                  null,
                  null,
                  null,
                  null,
                  null,
                  "entityStatus",
                  "Approved")),
          List.of());
      case SUGGESTION -> new TaskExecutionPlan(
          List.of(
              new TaskExecutionAction(
                  ActionType.APPLY_SUGGESTION, null, null, null, null, null, null, null, null)),
          List.of());
      default -> new TaskExecutionPlan(List.of(), List.of());
    };
  }

  private static TaskExecutionBinding merge(
      TaskExecutionBinding defaults, TaskExecutionBinding configured) {
    if (configured == null) {
      return defaults;
    }

    return new TaskExecutionBinding(
        configured.handlerType() != null ? configured.handlerType() : defaults.handlerType(),
        configured.permissionOperation() != null
            ? configured.permissionOperation()
            : defaults.permissionOperation(),
        configured.fieldPathField() != null
            ? configured.fieldPathField()
            : defaults.fieldPathField(),
        configured.valueField() != null ? configured.valueField() : defaults.valueField(),
        configured.currentTagsField() != null
            ? configured.currentTagsField()
            : defaults.currentTagsField(),
        configured.addTagsField() != null ? configured.addTagsField() : defaults.addTagsField(),
        configured.removeTagsField() != null
            ? configured.removeTagsField()
            : defaults.removeTagsField());
  }

  private static TaskExecutionPlan merge(TaskExecutionPlan defaults, TaskExecutionPlan configured) {
    if (configured == null) {
      return defaults;
    }

    return new TaskExecutionPlan(
        configured.approveActions() != null
            ? configured.approveActions()
            : defaults.approveActions(),
        configured.rejectActions() != null ? configured.rejectActions() : defaults.rejectActions());
  }

  private static boolean hasFeedbackPayload(Task task) {
    return task.getPayload() != null && JsonUtils.valueToTree(task.getPayload()).has("feedback");
  }

  private static String stringValue(Object value) {
    return value instanceof String string && !string.isBlank() ? string : null;
  }

  private static MetadataOperation parseOperation(String value) {
    if (value == null) {
      return null;
    }
    try {
      return MetadataOperation.fromValue(value);
    } catch (Exception e) {
      try {
        return MetadataOperation.valueOf(value);
      } catch (Exception ignored) {
        LOG.debug("Unsupported metadata operation binding '{}'", value);
        return null;
      }
    }
  }

  private static List<TaskExecutionAction> parseActions(Object configObject) {
    if (!(configObject instanceof Map<?, ?> configMap)) {
      return null;
    }

    Object actionsObject = configMap.get("actions");
    if (!(actionsObject instanceof List<?> rawActions)) {
      return null;
    }

    return rawActions.stream()
        .filter(Map.class::isInstance)
        .map(Map.class::cast)
        .map(TaskFormExecutionResolver::parseAction)
        .filter(action -> action.actionType() != null)
        .toList();
  }

  private static TaskExecutionAction parseAction(Map<?, ?> rawAction) {
    return new TaskExecutionAction(
        parseActionType(stringValue(rawAction.get("type"))),
        stringValue(rawAction.get("fieldPathField")),
        stringValue(rawAction.get("valueField")),
        stringValue(rawAction.get("currentTagsField")),
        stringValue(rawAction.get("addTagsField")),
        stringValue(rawAction.get("removeTagsField")),
        stringValue(rawAction.get("payloadField")),
        stringValue(rawAction.get("entityField")),
        rawAction.get("value"));
  }

  private static HandlerType parseHandlerType(String value) {
    if (value == null) {
      return null;
    }

    return switch (value.trim()) {
      case "descriptionUpdate" -> HandlerType.DESCRIPTION_UPDATE;
      case "tagUpdate" -> HandlerType.TAG_UPDATE;
      case "ownershipUpdate" -> HandlerType.OWNERSHIP_UPDATE;
      case "tierUpdate" -> HandlerType.TIER_UPDATE;
      case "domainUpdate" -> HandlerType.DOMAIN_UPDATE;
      case "approval" -> HandlerType.APPROVAL;
      case "incident" -> HandlerType.INCIDENT;
      case "feedbackApproval" -> HandlerType.FEEDBACK_APPROVAL;
      case "suggestion" -> HandlerType.SUGGESTION;
      case "custom" -> HandlerType.CUSTOM;
      default -> null;
    };
  }

  private static ActionType parseActionType(String value) {
    if (value == null) {
      return null;
    }

    return switch (value.trim()) {
      case "setDescription" -> ActionType.SET_DESCRIPTION;
      case "mergeTags" -> ActionType.MERGE_TAGS;
      case "replaceOwners" -> ActionType.REPLACE_OWNERS;
      case "applyTier" -> ActionType.APPLY_TIER;
      case "replaceDomains" -> ActionType.REPLACE_DOMAINS;
      case "patchEntityField" -> ActionType.PATCH_ENTITY_FIELD;
      case "applySuggestion" -> ActionType.APPLY_SUGGESTION;
      default -> null;
    };
  }
}
