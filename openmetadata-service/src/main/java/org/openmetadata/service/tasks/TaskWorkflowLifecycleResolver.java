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

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.feed.FormSchema;
import org.openmetadata.schema.entity.feed.TaskFormSchema;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.governance.workflows.elements.WorkflowNodeDefinitionInterface;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TaskAvailableTransition;
import org.openmetadata.schema.type.TaskCategory;
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.schema.type.TaskEntityType;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.TaskFormSchemaRepository;

/** Resolves workflow lifecycle bindings for configurable task forms. */
@Slf4j
public final class TaskWorkflowLifecycleResolver {

  public record TaskWorkflowBinding(
      TaskFormSchema schema,
      String workflowDefinitionRef,
      Object createFormSchema,
      Object createUiSchema,
      Map<String, Object> transitionForms,
      Map<String, Object> defaultStageMappings) {}

  private TaskWorkflowLifecycleResolver() {}

  public static Optional<TaskFormSchema> resolveSchema(Task task) {
    if (task == null || task.getType() == null) {
      return Optional.empty();
    }

    return resolveSchema(task.getType(), task.getCategory(), task.getPayload());
  }

  public static Optional<TaskFormSchema> resolveSchema(
      TaskEntityType taskType, TaskCategory taskCategory, Object payload) {
    if (taskType == null) {
      return Optional.empty();
    }

    TaskFormSchemaRepository schemaRepository =
        (TaskFormSchemaRepository) Entity.getEntityRepository(Entity.TASK_FORM_SCHEMA);
    TaskCategory defaultCategory = defaultTaskCategory(taskType);
    TaskCategory effectiveCategory = taskCategory != null ? taskCategory : defaultCategory;

    Optional<TaskFormSchema> exactMatch =
        schemaRepository.resolve(
            taskType.value(),
            effectiveCategory != null ? effectiveCategory.value() : null,
            payload);
    if (exactMatch.isPresent()) {
      return exactMatch;
    }

    if (defaultCategory != null && defaultCategory != effectiveCategory) {
      Optional<TaskFormSchema> defaultCategoryMatch =
          schemaRepository.resolve(taskType.value(), defaultCategory.value(), payload);
      if (defaultCategoryMatch.isPresent()) {
        return defaultCategoryMatch;
      }
    }

    TaskFormSchema exactDefaultSchema = getDefaultSchema(taskType, effectiveCategory);
    if (exactDefaultSchema != null) {
      return Optional.of(exactDefaultSchema);
    }

    return Optional.ofNullable(getDefaultSchema(taskType, defaultCategory));
  }

  public static Optional<TaskWorkflowBinding> resolveBinding(Task task) {
    if (task == null || task.getType() == null) {
      return Optional.empty();
    }
    return resolveBinding(task.getType(), task.getCategory(), task.getPayload());
  }

  public static Optional<TaskWorkflowBinding> resolveBinding(
      TaskEntityType taskType, TaskCategory taskCategory, Object payload) {
    if (taskType == null) {
      return Optional.empty();
    }

    TaskCategory effectiveCategory = resolveDefaultTaskCategory(taskType, taskCategory);

    Optional<TaskFormSchema> resolvedSchema = resolveSchema(taskType, effectiveCategory, payload);

    String workflowDefinitionRef =
        resolvedSchema
            .map(TaskFormSchema::getWorkflowDefinitionRef)
            .filter(ref -> !nullOrEmpty(ref))
            .orElse(defaultWorkflowDefinitionRef(taskType));

    if (nullOrEmpty(workflowDefinitionRef)) {
      return Optional.empty();
    }

    TaskFormSchema schema = resolvedSchema.orElse(null);
    return Optional.of(
        new TaskWorkflowBinding(
            schema,
            workflowDefinitionRef,
            schema != null && schema.getCreateFormSchema() != null
                ? schema.getCreateFormSchema()
                : schema != null ? schema.getFormSchema() : null,
            schema != null && schema.getCreateUiSchema() != null
                ? schema.getCreateUiSchema()
                : schema != null ? schema.getUiSchema() : null,
            schema != null && schema.getTransitionForms() != null
                ? JsonUtils.convertValue(schema.getTransitionForms(), Map.class)
                : Map.of(),
            schema != null && schema.getDefaultStageMappings() != null
                ? JsonUtils.convertValue(schema.getDefaultStageMappings(), Map.class)
                : Map.of()));
  }

  public static TaskCategory resolveDefaultTaskCategory(
      TaskEntityType taskType, TaskCategory taskCategory) {
    if (taskCategory != null || taskType == null) {
      return taskCategory;
    }

    return defaultTaskCategory(taskType);
  }

  private static TaskCategory defaultTaskCategory(TaskEntityType taskType) {
    if (taskType == null) {
      return null;
    }

    return defaultTaskCategoryForWorkflowDefinitionRef(defaultWorkflowDefinitionRef(taskType));
  }

  public static Object resolveTransitionFormSchema(
      TaskFormSchema schema, String transitionId, TaskAvailableTransition transition) {
    Object transitionConfig = resolveTransitionForm(schema, transitionId, transition);
    if (!(transitionConfig instanceof Map<?, ?> transitionMap)) {
      return schema != null ? schema.getFormSchema() : null;
    }

    Object inlineSchema = transitionMap.get("formSchema");
    if (inlineSchema != null) {
      return inlineSchema;
    }

    return schema != null ? schema.getFormSchema() : null;
  }

  public static Object resolveTransitionUiSchema(
      TaskFormSchema schema, String transitionId, TaskAvailableTransition transition) {
    Object transitionConfig = resolveTransitionForm(schema, transitionId, transition);
    if (!(transitionConfig instanceof Map<?, ?> transitionMap)) {
      return schema != null ? schema.getUiSchema() : null;
    }

    Object inlineUiSchema = transitionMap.get("uiSchema");
    if (inlineUiSchema != null) {
      return inlineUiSchema;
    }

    return schema != null ? schema.getUiSchema() : null;
  }

  public static String defaultWorkflowDefinitionRef(TaskEntityType taskType) {
    if (taskType == null) {
      return null;
    }

    return switch (taskType) {
      case DescriptionUpdate -> "DescriptionUpdateTaskWorkflow";
      case TagUpdate -> "TagUpdateTaskWorkflow";
      case OwnershipUpdate -> "OwnershipUpdateTaskWorkflow";
      case TierUpdate -> "TierUpdateTaskWorkflow";
      case DomainUpdate -> "DomainUpdateTaskWorkflow";
      case GlossaryApproval -> "GlossaryApprovalTaskWorkflow";
      case RequestApproval -> "RequestApprovalTaskWorkflow";
      case DataAccessRequest -> "DataAccessRequestTaskWorkflow";
      case Suggestion -> "SuggestionTaskWorkflow";
      case TestCaseResolution -> "TestCaseResolutionTaskWorkflow";
      case IncidentResolution -> "IncidentResolutionTaskWorkflow";
      case PipelineReview -> "PipelineReviewTaskWorkflow";
      case DataQualityReview -> "DataQualityReviewTaskWorkflow";
      case RecognizerFeedbackApproval -> "RecognizerFeedbackReviewWorkflow";
      case CustomTask -> "CustomTaskWorkflow";
      default -> "CustomTaskWorkflow";
    };
  }

  public static TaskEntityType defaultTaskTypeForWorkflowDefinitionRef(
      String workflowDefinitionRef) {
    if (nullOrEmpty(workflowDefinitionRef)) {
      return TaskEntityType.CustomTask;
    }

    return switch (workflowDefinitionRef) {
      case "DescriptionUpdateTaskWorkflow" -> TaskEntityType.DescriptionUpdate;
      case "TagUpdateTaskWorkflow" -> TaskEntityType.TagUpdate;
      case "OwnershipUpdateTaskWorkflow" -> TaskEntityType.OwnershipUpdate;
      case "TierUpdateTaskWorkflow" -> TaskEntityType.TierUpdate;
      case "DomainUpdateTaskWorkflow" -> TaskEntityType.DomainUpdate;
      case "GlossaryApprovalTaskWorkflow" -> TaskEntityType.GlossaryApproval;
      case "RequestApprovalTaskWorkflow" -> TaskEntityType.RequestApproval;
      case "DataAccessRequestTaskWorkflow" -> TaskEntityType.DataAccessRequest;
      case "SuggestionTaskWorkflow" -> TaskEntityType.Suggestion;
      case "TestCaseResolutionTaskWorkflow" -> TaskEntityType.TestCaseResolution;
      case "IncidentResolutionTaskWorkflow" -> TaskEntityType.IncidentResolution;
      case "PipelineReviewTaskWorkflow" -> TaskEntityType.PipelineReview;
      case "DataQualityReviewTaskWorkflow" -> TaskEntityType.DataQualityReview;
      case "RecognizerFeedbackReviewWorkflow" -> TaskEntityType.RecognizerFeedbackApproval;
      case "GenericReviewTaskWorkflow" -> TaskEntityType.RequestApproval;
      case "GenericIncidentTaskWorkflow" -> TaskEntityType.IncidentResolution;
      case "CustomTaskWorkflow" -> TaskEntityType.CustomTask;
      default -> TaskEntityType.CustomTask;
    };
  }

  public static TaskCategory defaultTaskCategoryForWorkflowDefinitionRef(
      String workflowDefinitionRef) {
    if (nullOrEmpty(workflowDefinitionRef)) {
      return TaskCategory.Custom;
    }

    return switch (defaultTaskTypeForWorkflowDefinitionRef(workflowDefinitionRef)) {
      case DescriptionUpdate,
          TagUpdate,
          OwnershipUpdate,
          TierUpdate,
          DomainUpdate,
          Suggestion -> TaskCategory.MetadataUpdate;
      case GlossaryApproval, RequestApproval -> TaskCategory.Approval;
      case DataAccessRequest -> TaskCategory.DataAccess;
      case IncidentResolution, TestCaseResolution -> TaskCategory.Incident;
      case DataQualityReview, PipelineReview, RecognizerFeedbackApproval -> TaskCategory.Review;
      case CustomTask -> TaskCategory.Custom;
    };
  }

  public static Set<String> defaultWorkflowDefinitionRefs() {
    return Set.of(
        "DescriptionUpdateTaskWorkflow",
        "TagUpdateTaskWorkflow",
        "OwnershipUpdateTaskWorkflow",
        "TierUpdateTaskWorkflow",
        "DomainUpdateTaskWorkflow",
        "GlossaryApprovalTaskWorkflow",
        "RequestApprovalTaskWorkflow",
        "SuggestionTaskWorkflow",
        "TestCaseResolutionTaskWorkflow",
        "IncidentResolutionTaskWorkflow",
        "PipelineReviewTaskWorkflow",
        "DataQualityReviewTaskWorkflow",
        "RecognizerFeedbackReviewWorkflow",
        "CustomTaskWorkflow",
        // Keep legacy generic defaults seedable during cutover so older bindings remain valid.
        "GenericReviewTaskWorkflow",
        "GenericIncidentTaskWorkflow");
  }

  public static List<TaskAvailableTransition> parseTransitions(Object transitionMetadata) {
    List<TaskAvailableTransition> transitions = new ArrayList<>();
    if (transitionMetadata == null) {
      return transitions;
    }

    if (transitionMetadata instanceof String transitionString) {
      if (nullOrEmpty(transitionString) || "null".equalsIgnoreCase(transitionString.trim())) {
        return transitions;
      }
    }

    List<?> rawTransitions = JsonUtils.readOrConvertValue(transitionMetadata, List.class);
    for (Object rawTransition : rawTransitions) {
      if (!(rawTransition instanceof Map<?, ?> rawTransitionMap)) {
        continue;
      }

      TaskAvailableTransition transition =
          new TaskAvailableTransition()
              .withId(stringValue(rawTransitionMap.get("id")))
              .withLabel(stringValue(rawTransitionMap.get("label")))
              .withTargetStageId(stringValue(rawTransitionMap.get("targetStageId")))
              .withFormRef(stringValue(rawTransitionMap.get("formRef")))
              .withRequiresComment(booleanValue(rawTransitionMap.get("requiresComment")));

      String targetTaskStatus = stringValue(rawTransitionMap.get("targetTaskStatus"));
      if (!nullOrEmpty(targetTaskStatus)) {
        transition.withTargetTaskStatus(TaskEntityStatus.fromValue(targetTaskStatus));
      }

      String resolutionType = stringValue(rawTransitionMap.get("resolutionType"));
      if (!nullOrEmpty(resolutionType)) {
        transition.withResolutionType(TaskResolutionType.fromValue(resolutionType));
      }

      transitions.add(transition);
    }

    return transitions;
  }

  public static List<TaskAvailableTransition> resolveTransitionsForStage(
      UUID workflowDefinitionId, String workflowStageId) {
    if (workflowDefinitionId == null || nullOrEmpty(workflowStageId)) {
      return List.of();
    }

    try {
      WorkflowDefinition workflowDefinition =
          Entity.getEntity(
              Entity.WORKFLOW_DEFINITION, workflowDefinitionId, "nodes", Include.NON_DELETED);
      return resolveTransitionsForStage(workflowDefinition, workflowStageId);
    } catch (Exception e) {
      LOG.debug(
          "Failed to resolve workflow transitions from definition '{}' for stage '{}': {}",
          workflowDefinitionId,
          workflowStageId,
          e.getMessage());
      return List.of();
    }
  }

  public static List<TaskAvailableTransition> resolveTransitionsForStage(
      WorkflowDefinition workflowDefinition, String workflowStageId) {
    if (workflowDefinition == null
        || nullOrEmpty(workflowStageId)
        || nullOrEmpty(workflowDefinition.getNodes())) {
      return List.of();
    }

    for (WorkflowNodeDefinitionInterface node : workflowDefinition.getNodes()) {
      if (node == null
          || !"userApprovalTask".equals(node.getSubType())
          || node.getConfig() == null) {
        continue;
      }

      Map<String, Object> config = JsonUtils.readOrConvertValue(node.getConfig(), Map.class);
      if (config == null) {
        continue;
      }

      String nodeStageId = stringValue(config.get("stageId"));
      if (!workflowStageId.equals(nodeStageId)) {
        continue;
      }

      return parseTransitions(config.get("transitionMetadata"));
    }

    return List.of();
  }

  public static TaskAvailableTransition findTransition(Task task, String transitionId) {
    if (task == null || nullOrEmpty(transitionId) || nullOrEmpty(task.getAvailableTransitions())) {
      return null;
    }

    return task.getAvailableTransitions().stream()
        .filter(transition -> transitionId.equals(transition.getId()))
        .findFirst()
        .orElse(null);
  }

  public static String defaultTransitionId(Task task, TaskResolutionType resolutionType) {
    if (task == null || nullOrEmpty(task.getAvailableTransitions())) {
      return null;
    }

    if (task != null && !nullOrEmpty(task.getAvailableTransitions()) && resolutionType != null) {
      Optional<TaskAvailableTransition> byResolution =
          task.getAvailableTransitions().stream()
              .filter(transition -> resolutionType.equals(transition.getResolutionType()))
              .findFirst();
      if (byResolution.isPresent()) {
        return byResolution.get().getId();
      }
    }

    if (resolutionType == null) {
      return null;
    }

    return switch (resolutionType) {
      case Approved, AutoApproved -> "approve";
      case Rejected, AutoRejected -> "reject";
      case Completed -> "complete";
      case Cancelled -> "cancel";
      case Revoked -> "revoke";
      case TimedOut -> "timeout";
      case Expired -> "expired";
    };
  }

  public static Map<String, Object> buildWorkflowStartVariables(Task draftTask) {
    return WorkflowStartVariables.of(draftTask).toVariables();
  }

  /**
   * Typed carrier for a workflow-managed task's start variables. Owns the variable-name contract in
   * one place (the constants below) so the process-variable map is built from a typed {@link Task}
   * instead of scattered {@code put("literal", …)} calls. {@link #toVariables()} produces the exact
   * map the Flowable engine is started with; it stays a null-tolerant {@link LinkedHashMap} because
   * several fields (display name, description, due date, priority, …) are optional.
   */
  public record WorkflowStartVariables(Task task) {
    public static final String TASK_ENTITY_ID = "taskEntityId";
    public static final String TASK_WORKFLOW_MANAGED = "taskWorkflowManaged";
    public static final String TASK_NAME = "taskName";
    public static final String TASK_DISPLAY_NAME = "taskDisplayName";
    public static final String TASK_DESCRIPTION = "taskDescription";
    public static final String TASK_TYPE = "taskType";
    public static final String TASK_CATEGORY = "taskCategory";
    public static final String TASK_PRIORITY = "taskPriority";
    public static final String TASK_PAYLOAD = "taskPayload";
    public static final String TASK_DUE_DATE = "taskDueDate";
    public static final String TASK_EXTERNAL_REFERENCE = "taskExternalReference";
    public static final String TASK_TAGS = "taskTags";
    public static final String TASK_CREATED_BY = "taskCreatedBy";
    public static final String TASK_UPDATED_BY = "taskUpdatedBy";
    public static final String TASK_REVIEWERS = "taskReviewers";
    public static final String TASK_ASSIGNEES = "taskAssignees";

    // Trigger-supplied start variables: these need the resolved WorkflowDefinition / form-schema
    // binding, so they aren't derivable from Task and toVariables() doesn't emit them. The names
    // live here so every caller that triggers a workflow shares one contract instead of repeating
    // the literals.
    public static final String TASK_FORM_SCHEMA_ID = "taskFormSchemaId";
    public static final String TASK_FORM_SCHEMA_VERSION = "taskFormSchemaVersion";
    public static final String WORKFLOW_DEFINITION_ID = "workflowDefinitionId";

    public static WorkflowStartVariables of(Task task) {
      return new WorkflowStartVariables(task);
    }

    public Map<String, Object> toVariables() {
      List<?> fallbackAssignees = !nullOrEmpty(task.getAssignees()) ? task.getAssignees() : null;
      Map<String, Object> variables = new LinkedHashMap<>();
      variables.put(TASK_ENTITY_ID, task.getId().toString());
      variables.put(TASK_WORKFLOW_MANAGED, true);
      variables.put(TASK_NAME, task.getName());
      variables.put(TASK_DISPLAY_NAME, task.getDisplayName());
      variables.put(TASK_DESCRIPTION, task.getDescription());
      variables.put(TASK_TYPE, task.getType() != null ? task.getType().value() : null);
      variables.put(TASK_CATEGORY, task.getCategory() != null ? task.getCategory().value() : null);
      variables.put(TASK_PRIORITY, task.getPriority() != null ? task.getPriority().value() : null);
      variables.put(TASK_PAYLOAD, serializeWorkflowVariable(task.getPayload()));
      variables.put(TASK_DUE_DATE, task.getDueDate());
      variables.put(
          TASK_EXTERNAL_REFERENCE, serializeWorkflowVariable(task.getExternalReference()));
      variables.put(TASK_TAGS, serializeWorkflowVariable(task.getTags()));
      variables.put(TASK_CREATED_BY, serializeWorkflowVariable(task.getCreatedBy()));
      variables.put(TASK_UPDATED_BY, task.getUpdatedBy());
      variables.put(TASK_REVIEWERS, serializeWorkflowVariable(task.getReviewers()));
      variables.put(TASK_ASSIGNEES, serializeWorkflowVariable(fallbackAssignees));
      return variables;
    }
  }

  private static Object resolveTransitionForm(
      TaskFormSchema schema, String transitionId, TaskAvailableTransition transition) {
    if (schema == null || schema.getTransitionForms() == null) {
      return null;
    }

    Map<String, Object> transitionForms =
        JsonUtils.convertValue(schema.getTransitionForms(), Map.class);
    String lookupKey =
        transition != null && !nullOrEmpty(transition.getFormRef())
            ? transition.getFormRef()
            : transitionId;
    return lookupKey == null ? null : transitionForms.get(lookupKey);
  }

  private static boolean booleanValue(Object value) {
    if (value instanceof Boolean booleanValue) {
      return booleanValue;
    }
    if (value instanceof String stringValue) {
      return Boolean.parseBoolean(stringValue);
    }
    return false;
  }

  private static String stringValue(Object value) {
    return value == null ? null : String.valueOf(value);
  }

  private static TaskFormSchema getDefaultSchema(
      TaskEntityType taskType, TaskCategory taskCategory) {
    if (taskType == null || taskCategory == null) {
      return null;
    }

    return switch (taskType) {
      case DescriptionUpdate -> taskCategory == TaskCategory.MetadataUpdate
          ? defaultSchema(
              taskType,
              taskCategory,
              defaultWorkflowDefinitionRef(taskType),
              namedObjectSchema(
                  "fieldPath", "currentDescription", "newDescription", "source", "confidence"))
          : null;
      case TagUpdate -> taskCategory == TaskCategory.MetadataUpdate
          ? defaultSchema(
              taskType,
              taskCategory,
              defaultWorkflowDefinitionRef(taskType),
              namedObjectSchema(
                  "fieldPath",
                  "currentTags",
                  "tagsToAdd",
                  "tagsToRemove",
                  "operation",
                  "source",
                  "confidence"))
          : null;
      case OwnershipUpdate -> taskCategory == TaskCategory.MetadataUpdate
          ? defaultSchema(
              taskType,
              taskCategory,
              defaultWorkflowDefinitionRef(taskType),
              schemaWithProperties(
                  Map.of(
                      "currentOwners", nullable(arrayOfObjectsProperty()),
                      "newOwners", arrayOfObjectsProperty(),
                      "reason", stringProperty())))
          : null;
      case TierUpdate -> taskCategory == TaskCategory.MetadataUpdate
          ? defaultSchema(
              taskType,
              taskCategory,
              defaultWorkflowDefinitionRef(taskType),
              schemaWithProperties(
                  Map.of(
                      "currentTier", nullable(objectProperty()),
                      "newTier", objectProperty(),
                      "reason", stringProperty())))
          : null;
      case DomainUpdate -> taskCategory == TaskCategory.MetadataUpdate
          ? defaultSchema(
              taskType,
              taskCategory,
              defaultWorkflowDefinitionRef(taskType),
              schemaWithProperties(
                  Map.of(
                      "currentDomain", nullable(objectProperty()),
                      "newDomain", objectProperty(),
                      "reason", stringProperty())))
          : null;
      case GlossaryApproval, RequestApproval -> taskCategory == TaskCategory.Approval
          ? defaultSchema(
              taskType,
              taskCategory,
              defaultWorkflowDefinitionRef(taskType),
              namedObjectSchema("comment"))
          : null;
      case DataAccessRequest -> taskCategory == TaskCategory.DataAccess
          ? defaultSchema(
              taskType,
              taskCategory,
              defaultWorkflowDefinitionRef(taskType),
              schemaWithProperties(
                  Map.of(
                      "requestedAccess", stringProperty(),
                      "reason", stringProperty(),
                      "assets", Map.of("type", "array", "items", objectProperty()),
                      "ticketId", stringProperty(),
                      "expirationDate", numberProperty())))
          : null;
      case TestCaseResolution, IncidentResolution -> taskCategory == TaskCategory.Incident
          ? defaultSchema(
              taskType,
              taskCategory,
              defaultWorkflowDefinitionRef(taskType),
              namedObjectSchema("rootCause", "resolution"))
          : null;
      case PipelineReview -> taskCategory == TaskCategory.Review
          ? defaultSchema(
              taskType,
              taskCategory,
              defaultWorkflowDefinitionRef(taskType),
              schemaWithProperties(
                  Map.of(
                      "reviewType", stringProperty(),
                      "reviewCriteria", Map.of("type", "array", "items", objectProperty()),
                      "findings", stringProperty(),
                      "recommendation", stringProperty(),
                      "attachments", Map.of("type", "array", "items", objectProperty()))))
          : null;
      case DataQualityReview, RecognizerFeedbackApproval -> taskCategory == TaskCategory.Review
          ? defaultSchema(
              taskType,
              taskCategory,
              defaultWorkflowDefinitionRef(taskType),
              namedObjectSchema("comment"))
          : null;
      case CustomTask -> taskCategory == TaskCategory.Custom
          ? defaultSchema(
              taskType, taskCategory, defaultWorkflowDefinitionRef(taskType), objectSchema())
          : null;
      default -> null;
    };
  }

  private static TaskFormSchema defaultSchema(
      TaskEntityType taskType,
      TaskCategory taskCategory,
      String workflowDefinitionRef,
      FormSchema formSchema) {
    return new TaskFormSchema()
        .withName(taskType.value())
        .withFullyQualifiedName(taskType.value())
        .withDisplayName(taskType.value())
        .withTaskType(taskType.value())
        .withTaskCategory(taskCategory.value())
        .withWorkflowDefinitionRef(workflowDefinitionRef)
        .withFormSchema(formSchema);
  }

  private static FormSchema objectSchema() {
    return JsonUtils.convertValue(
        Map.of("type", "object", "additionalProperties", true, "properties", Map.of()),
        FormSchema.class);
  }

  private static FormSchema namedObjectSchema(String... propertyNames) {
    Map<String, Object> properties = new LinkedHashMap<>();
    for (String propertyName : propertyNames) {
      properties.put(propertyName, stringProperty());
    }

    return schemaWithProperties(properties);
  }

  private static FormSchema schemaWithProperties(Map<String, Object> properties) {
    return JsonUtils.convertValue(
        Map.of("type", "object", "additionalProperties", true, "properties", properties),
        FormSchema.class);
  }

  private static Map<String, Object> stringProperty() {
    return Map.of("type", "string");
  }

  private static Map<String, Object> numberProperty() {
    return Map.of("type", "number");
  }

  private static Map<String, Object> objectProperty() {
    return Map.of("type", "object", "additionalProperties", true);
  }

  private static Map<String, Object> arrayOfObjectsProperty() {
    return Map.of("type", "array", "items", objectProperty());
  }

  private static Map<String, Object> nullable(Map<String, Object> schema) {
    return Map.of("oneOf", List.of(schema, Map.of("type", "null")));
  }

  private static Object serializeWorkflowVariable(Object value) {
    if (value == null
        || value instanceof String
        || value instanceof Number
        || value instanceof Boolean) {
      return value;
    }
    return JsonUtils.pojoToJson(value);
  }
}
