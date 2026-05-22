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

package org.openmetadata.service.jdbi3;

import static org.openmetadata.schema.type.Include.NON_DELETED;
import static org.openmetadata.service.Entity.TASK_FORM_SCHEMA;

import java.io.IOException;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Jdbi;
import org.openmetadata.schema.entity.feed.TaskFormSchema;
import org.openmetadata.schema.type.SuggestionPayload;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.tasks.TaskFormSchemaValidator;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.FullyQualifiedName;

@Slf4j
@Repository
public class TaskFormSchemaRepository extends EntityRepository<TaskFormSchema> {

  public static final String COLLECTION_PATH = "/v1/taskFormSchemas";
  private final ConcurrentMap<String, Optional<TaskFormSchema>> schemaCache =
      new ConcurrentHashMap<>();

  public TaskFormSchemaRepository() {
    super(
        COLLECTION_PATH,
        TASK_FORM_SCHEMA,
        TaskFormSchema.class,
        Entity.getCollectionDAO().taskFormSchemaDAO(),
        "",
        "");
    supportsSearch = false;
    quoteFqn = false;
  }

  public TaskFormSchemaRepository(Jdbi jdbi) {
    super(
        COLLECTION_PATH,
        TASK_FORM_SCHEMA,
        TaskFormSchema.class,
        initializeTaskFormSchemaDao(jdbi),
        "",
        "");
    supportsSearch = false;
    quoteFqn = false;
  }

  @Override
  public List<TaskFormSchema> getEntitiesFromSeedData() throws IOException {
    return getEntitiesFromSeedData(".*json/data/taskFormSchemas/.*\\.json$");
  }

  @Override
  public void setFullyQualifiedName(TaskFormSchema schema) {
    schema.setFullyQualifiedName(FullyQualifiedName.quoteName(schema.getName()));
  }

  @Override
  public void prepare(TaskFormSchema schema, boolean update) {
    if (schema.getName() == null || schema.getName().isBlank()) {
      throw new IllegalArgumentException("Task form schema name must not be empty");
    }
    if (schema.getName().length() > 256) {
      throw new IllegalArgumentException("Task form schema name length must be <= 256");
    }
    if (schema.getTaskType() == null || schema.getTaskType().isBlank()) {
      throw new IllegalArgumentException("Task form schema taskType must not be empty");
    }
    if (schema.getTaskType().length() > 64) {
      throw new IllegalArgumentException("Task form schema taskType length must be <= 64");
    }
    if (schema.getTaskCategory() == null || schema.getTaskCategory().isBlank()) {
      throw new IllegalArgumentException("Task form schema taskCategory must not be empty");
    }
    if (schema.getTaskCategory().length() > 32) {
      throw new IllegalArgumentException("Task form schema taskCategory length must be <= 32");
    }
    TaskFormSchemaValidator.validateFormSchema(schema.getFormSchema());
    if (schema.getCreateFormSchema() != null) {
      TaskFormSchemaValidator.validateFormSchema(schema.getCreateFormSchema());
    }
    validateTransitionForms(schema);
    validateUniqueTaskSchemaBinding(schema);
  }

  private static CollectionDAO.TaskFormSchemaDAO initializeTaskFormSchemaDao(Jdbi jdbi) {
    if (Entity.getJdbi() == null) {
      Entity.setJdbi(jdbi);
    }
    if (Entity.getCollectionDAO() == null) {
      Entity.setCollectionDAO(jdbi.onDemand(CollectionDAO.class));
    }
    return Entity.getCollectionDAO().taskFormSchemaDAO();
  }

  @Override
  public void storeEntity(TaskFormSchema schema, boolean update) {
    schemaCache.clear();
    if (update) {
      daoCollection
          .taskFormSchemaDAO()
          .update(schema.getId(), schema.getFullyQualifiedName(), JsonUtils.pojoToJson(schema));
    } else {
      daoCollection
          .taskFormSchemaDAO()
          .insertTaskFormSchema(
              schema.getId().toString(),
              JsonUtils.pojoToJson(schema),
              schema.getFullyQualifiedName());
    }
  }

  @Override
  public void setFields(TaskFormSchema schema, Fields fields, RelationIncludes includes) {
    // No relational fields to set
  }

  @Override
  public void clearFields(TaskFormSchema schema, Fields fields) {
    // No extra fields to clear
  }

  @Override
  public void storeRelationships(TaskFormSchema schema) {
    // No relationships needed
  }

  @Override
  public TaskFormSchemaUpdater getUpdater(
      TaskFormSchema original,
      TaskFormSchema updated,
      Operation operation,
      org.openmetadata.schema.type.change.ChangeSource changeSource) {
    return new TaskFormSchemaUpdater(original, updated, operation, changeSource);
  }

  public class TaskFormSchemaUpdater extends EntityUpdater {
    public TaskFormSchemaUpdater(
        TaskFormSchema original,
        TaskFormSchema updated,
        Operation operation,
        org.openmetadata.schema.type.change.ChangeSource changeSource) {
      super(original, updated, operation, changeSource);
    }

    @Override
    public void entitySpecificUpdate(boolean consolidatingChanges) {
      recordChange("formSchema", original.getFormSchema(), updated.getFormSchema());
      recordChange("uiSchema", original.getUiSchema(), updated.getUiSchema());
      recordChange(
          "createFormSchema", original.getCreateFormSchema(), updated.getCreateFormSchema());
      recordChange("createUiSchema", original.getCreateUiSchema(), updated.getCreateUiSchema());
      recordChange(
          "workflowDefinitionRef",
          original.getWorkflowDefinitionRef(),
          updated.getWorkflowDefinitionRef());
      recordChange("workflowVersion", original.getWorkflowVersion(), updated.getWorkflowVersion());
      recordChange("transitionForms", original.getTransitionForms(), updated.getTransitionForms());
      recordChange(
          "defaultStageMappings",
          original.getDefaultStageMappings(),
          updated.getDefaultStageMappings());
      recordChange("taskType", original.getTaskType(), updated.getTaskType());
      recordChange("taskCategory", original.getTaskCategory(), updated.getTaskCategory());
    }
  }

  public Optional<TaskFormSchema> resolve(String taskType, String taskCategory) {
    return resolve(taskType, taskCategory, null);
  }

  public Optional<TaskFormSchema> resolve(String taskType, String taskCategory, Object payload) {
    if (taskType == null || taskType.isBlank()) {
      return Optional.empty();
    }

    String cacheKey =
        taskType
            + "::"
            + (taskCategory == null ? "" : taskCategory)
            + "::"
            + getSuggestionSchemaName(payload).orElse("");
    return schemaCache.computeIfAbsent(
        cacheKey, key -> resolveUncached(taskType, taskCategory, payload));
  }

  private Optional<TaskFormSchema> resolveUncached(String taskType, String taskCategory) {
    return resolveUncached(taskType, taskCategory, null);
  }

  private Optional<TaskFormSchema> resolveUncached(
      String taskType, String taskCategory, Object payload) {
    Optional<TaskFormSchema> directMatch = resolveSuggestionSchema(taskType, taskCategory, payload);
    if (directMatch.isPresent()) {
      return directMatch;
    }

    ListFilter filter = new ListFilter(NON_DELETED);
    filter.addQueryParam("taskFormType", taskType);
    if (taskCategory != null && !taskCategory.isBlank()) {
      filter.addQueryParam("taskFormCategory", taskCategory);
    }

    List<TaskFormSchema> matches = listAll(getFields(""), filter);
    if (matches.isEmpty()) {
      return Optional.empty();
    }
    if (matches.size() > 1) {
      Optional<TaskFormSchema> discriminated = disambiguateMatch(taskType, matches, payload);
      if (discriminated.isPresent()) {
        return discriminated;
      }
    }
    if (matches.size() > 1) {
      throw new IllegalArgumentException(
          String.format(
              "Multiple task form schemas found for taskType='%s' and taskCategory='%s'",
              taskType, taskCategory));
    }
    return Optional.of(matches.get(0));
  }

  private Optional<TaskFormSchema> resolveSuggestionSchema(
      String taskType, String taskCategory, Object payload) {
    if (!"Suggestion".equals(taskType)) {
      return Optional.empty();
    }

    Optional<String> suggestionSchemaName = getSuggestionSchemaName(payload);
    if (suggestionSchemaName.isEmpty()) {
      return Optional.empty();
    }

    TaskFormSchema schema = findByNameOrNull(suggestionSchemaName.get(), NON_DELETED);
    if (schema == null) {
      return Optional.empty();
    }

    boolean typeMatches = taskType.equals(schema.getTaskType());
    boolean categoryMatches =
        taskCategory == null
            || taskCategory.isBlank()
            || taskCategory.equals(schema.getTaskCategory());

    return typeMatches && categoryMatches ? Optional.of(schema) : Optional.empty();
  }

  private void validateUniqueTaskSchemaBinding(TaskFormSchema schema) {
    List<TaskFormSchema> matches =
        listByTaskBinding(schema.getTaskType(), schema.getTaskCategory());

    if (matches.size() > 1) {
      boolean updatingExistingVariant =
          matches.stream().anyMatch(existing -> existing.getId().equals(schema.getId()));
      if (updatingExistingVariant) {
        return;
      }
    }

    // Suggestion schemas (DescriptionSuggestion, TagSuggestion) share the same
    // taskType+taskCategory but are disambiguated by payload at resolve time via
    // resolveSuggestionSchema/disambiguateMatch. Allow multiple schemas for that
    // type. For all other types, enforce uniqueness per type+category.
    if ("Suggestion".equals(schema.getTaskType())) {
      return;
    }

    Optional<TaskFormSchema> existing =
        resolveUncached(schema.getTaskType(), schema.getTaskCategory(), null);
    if (existing.isPresent() && !existing.get().getId().equals(schema.getId())) {
      throw new IllegalArgumentException(
          String.format(
              "A task form schema already exists for taskType='%s' and taskCategory='%s'",
              schema.getTaskType(), schema.getTaskCategory()));
    }
  }

  private List<TaskFormSchema> listByTaskBinding(String taskType, String taskCategory) {
    ListFilter filter = new ListFilter(NON_DELETED);
    filter.addQueryParam("taskFormType", taskType);
    if (taskCategory != null && !taskCategory.isBlank()) {
      filter.addQueryParam("taskFormCategory", taskCategory);
    }
    return listAll(getFields(""), filter);
  }

  private void validateTransitionForms(TaskFormSchema schema) {
    if (schema.getTransitionForms() == null) {
      return;
    }

    Map<String, Object> transitionForms =
        JsonUtils.convertValue(schema.getTransitionForms(), Map.class);
    for (Map.Entry<String, Object> entry : transitionForms.entrySet()) {
      if (!(entry.getValue() instanceof Map<?, ?> transitionConfig)) {
        throw new IllegalArgumentException(
            String.format("Transition form '%s' must be an object", entry.getKey()));
      }

      Object formSchema = transitionConfig.get("formSchema");
      if (formSchema != null) {
        TaskFormSchemaValidator.validateFormSchema(formSchema);
      }
    }
  }

  private Optional<TaskFormSchema> disambiguateMatch(
      String taskType, List<TaskFormSchema> matches, Object payload) {
    if (!"Suggestion".equals(taskType)) {
      return Optional.empty();
    }

    Optional<String> suggestionSchemaName = getSuggestionSchemaName(payload);
    if (suggestionSchemaName.isEmpty()) {
      return Optional.empty();
    }

    return matches.stream()
        .filter(
            schema ->
                suggestionSchemaName.get().equals(schema.getName())
                    || suggestionSchemaName.get().equals(schema.getFullyQualifiedName()))
        .findFirst();
  }

  private Optional<String> getSuggestionSchemaName(Object payload) {
    if (payload == null) {
      return Optional.empty();
    }

    Optional<String> rawSuggestionType = getRawSuggestionType(payload);
    if (rawSuggestionType.isPresent()) {
      return mapSuggestionTypeToSchema(rawSuggestionType.get());
    }

    SuggestionPayload suggestionPayload;
    if (payload instanceof SuggestionPayload typedPayload) {
      suggestionPayload = typedPayload;
    } else {
      try {
        suggestionPayload = JsonUtils.convertValue(payload, SuggestionPayload.class);
      } catch (Exception ignored) {
        return Optional.empty();
      }
    }

    if (suggestionPayload.getSuggestionType() == null) {
      return Optional.empty();
    }

    return mapSuggestionTypeToSchema(suggestionPayload.getSuggestionType().value());
  }

  private Optional<String> getRawSuggestionType(Object payload) {
    try {
      Map<String, Object> payloadMap = JsonUtils.getMap(payload);
      Object suggestionType = payloadMap.get("suggestionType");
      if (suggestionType != null) {
        return Optional.of(String.valueOf(suggestionType));
      }
    } catch (Exception ignored) {
      // Fall back to typed conversion below.
    }

    return Optional.empty();
  }

  private Optional<String> mapSuggestionTypeToSchema(String suggestionType) {
    if (suggestionType == null || suggestionType.isBlank()) {
      return Optional.empty();
    }

    return switch (suggestionType.trim().toLowerCase(Locale.ROOT)) {
      case "description" -> Optional.of("DescriptionSuggestion");
      case "tag" -> Optional.of("TagSuggestion");
      default -> Optional.empty();
    };
  }
}
