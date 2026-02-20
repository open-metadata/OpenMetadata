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

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.Entity.ADMIN_USER_NAME;

import com.google.gson.Gson;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.openmetadata.schema.api.learning.ResourceCategory;
import org.openmetadata.schema.entity.learning.LearningResource;
import org.openmetadata.schema.entity.learning.LearningResourceContext;
import org.openmetadata.schema.entity.learning.LearningResourceSource;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.resources.databases.DatasourceConfig;
import org.openmetadata.service.resources.learning.LearningResourceResource;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.FullyQualifiedName;

@Slf4j
public class LearningResourceRepository extends EntityRepository<LearningResource> {
  private static final String UPDATE_FIELDS =
      "owners,reviewers,tags,contexts,categories,difficulty,source,estimatedDuration,status";
  private static final String PATCH_FIELDS = UPDATE_FIELDS;

  public LearningResourceRepository() {
    super(
        LearningResourceResource.COLLECTION_PATH,
        Entity.LEARNING_RESOURCE,
        LearningResource.class,
        Entity.getCollectionDAO().learningResourceDAO(),
        UPDATE_FIELDS,
        PATCH_FIELDS);
    supportsSearch = false;
  }

  /**
   * Initialize seed data with merge/update support. Unlike the default initializeEntity which skips
   * existing entities, this method will update existing resources if the seed data has changed.
   */
  public void initSeedDataWithMerge() throws java.io.IOException {
    List<LearningResource> seedEntities = getEntitiesFromSeedData();
    for (LearningResource seedEntity : seedEntities) {
      setFullyQualifiedName(seedEntity);
      LearningResource existingEntity =
          findByNameOrNull(seedEntity.getFullyQualifiedName(), Include.ALL);

      if (existingEntity == null) {
        // New entity - create it
        LOG.info("Creating new learning resource: {}", seedEntity.getName());
        seedEntity.setUpdatedBy(ADMIN_USER_NAME);
        seedEntity.setUpdatedAt(System.currentTimeMillis());
        seedEntity.setId(java.util.UUID.randomUUID());
        create(null, seedEntity);
      } else {
        // Existing entity - check if update is needed by comparing key fields
        boolean needsUpdate = hasChanges(existingEntity, seedEntity);
        if (needsUpdate) {
          LOG.info("Updating learning resource: {}", seedEntity.getName());
          seedEntity.setId(existingEntity.getId());
          seedEntity.setUpdatedBy(ADMIN_USER_NAME);
          seedEntity.setUpdatedAt(System.currentTimeMillis());
          seedEntity.setVersion(existingEntity.getVersion());
          createOrUpdate(null, seedEntity, ADMIN_USER_NAME);
        } else {
          LOG.debug("Learning resource {} is up to date", seedEntity.getName());
        }
      }
    }
  }

  private boolean hasChanges(LearningResource existing, LearningResource seed) {
    // Compare fields that matter for seed data updates
    if (!java.util.Objects.equals(existing.getDisplayName(), seed.getDisplayName())) return true;
    if (!java.util.Objects.equals(existing.getDescription(), seed.getDescription())) return true;
    if (!java.util.Objects.equals(existing.getResourceType(), seed.getResourceType())) return true;
    if (!java.util.Objects.equals(existing.getCategories(), seed.getCategories())) return true;
    if (!java.util.Objects.equals(existing.getContexts(), seed.getContexts())) return true;
    if (!java.util.Objects.equals(existing.getDifficulty(), seed.getDifficulty())) return true;
    if (!java.util.Objects.equals(existing.getSource(), seed.getSource())) return true;
    if (!java.util.Objects.equals(existing.getStatus(), seed.getStatus())) return true;
    return false;
  }

  @Override
  protected void setFields(
      LearningResource entity, Fields fields, RelationIncludes relationIncludes) {
    // No additional field resolution for now
  }

  @Override
  public void setFieldsInBulk(Fields fields, List<LearningResource> entities) {
    super.setFieldsInBulk(fields, entities);
  }

  @Override
  protected void clearFields(LearningResource entity, Fields fields) {
    // No-op
  }

  @Override
  public void setFullyQualifiedName(LearningResource entity) {
    if (StringUtils.isNotBlank(entity.getFullyQualifiedName())) {
      return;
    }
    entity.setFullyQualifiedName(FullyQualifiedName.build(entity.getName()));
  }

  @Override
  public void prepare(LearningResource entity, boolean update) {
    validateSource(entity.getSource());
    ensureCategories(entity);
    validateContexts(entity.getContexts());
    validateDuration(entity.getEstimatedDuration());
  }

  @Override
  public void storeEntity(LearningResource entity, boolean update) {
    store(entity, update);
  }

  @Override
  public void storeEntities(List<LearningResource> entities) {
    List<LearningResource> entitiesToStore = new ArrayList<>();
    Gson gson = new Gson();
    for (LearningResource entity : entities) {
      String jsonCopy = gson.toJson(entity);
      entitiesToStore.add(gson.fromJson(jsonCopy, LearningResource.class));
    }
    storeMany(entitiesToStore);
  }

  @Override
  public void storeRelationships(LearningResource entity) {
    // All relationships handled centrally (owners, reviewers, tags)
  }

  public EntityRepository<LearningResource>.EntityUpdater getUpdater(
      LearningResource original,
      LearningResource updated,
      Operation operation,
      ChangeSource changeSource) {
    return new LearningResourceUpdater(original, updated, operation);
  }

  private void validateSource(LearningResourceSource source) {
    if (source == null || source.getUrl() == null) {
      throw BadRequestException.of("Learning resource source with URL is required");
    }
  }

  private void ensureCategories(LearningResource entity) {
    List<ResourceCategory> categories = entity.getCategories();
    if (nullOrEmpty(categories)) {
      throw BadRequestException.of("Learning resource must include at least one category");
    }
    Set<ResourceCategory> unique = new LinkedHashSet<>(categories);
    if (unique.size() != categories.size()) {
      entity.setCategories(new ArrayList<>(unique));
    }
  }

  private void validateContexts(List<LearningResourceContext> contexts) {
    if (nullOrEmpty(contexts)) {
      throw BadRequestException.of("Learning resource requires at least one placement context");
    }

    Set<String> uniqueKeys = new HashSet<>();
    for (LearningResourceContext context : contexts) {
      if (context == null || StringUtils.isBlank(context.getPageId())) {
        throw BadRequestException.of("Learning resource context requires a non-empty pageId");
      }
      String componentId = StringUtils.defaultIfBlank(context.getComponentId(), "");
      String key = context.getPageId() + "::" + componentId;
      if (!uniqueKeys.add(key)) {
        throw BadRequestException.of(
            "Duplicate learning resource context for pageId '%s' and componentId '%s'"
                .formatted(context.getPageId(), componentId));
      }
    }
  }

  private void validateDuration(Integer estimatedDuration) {
    if (estimatedDuration != null && estimatedDuration < 0) {
      throw BadRequestException.of("Estimated duration must be zero or a positive integer");
    }
  }

  public static class LearningResourceFilter extends ListFilter {
    public LearningResourceFilter(Include include) {
      super(include);
    }

    @Override
    public String getCondition(String tableName) {
      ArrayList<String> conditions = new ArrayList<>();
      conditions.add(getIncludeCondition(tableName));
      String placementCondition = buildPlacementCondition(tableName);
      if (!placementCondition.isEmpty()) {
        conditions.add(placementCondition);
      }
      String condition = addCondition(conditions);
      return condition.isEmpty() ? "WHERE TRUE" : "WHERE " + condition;
    }

    private String buildPlacementCondition(String tableName) {
      List<String> conditions = new ArrayList<>();
      if (getQueryParam("pageId") != null) {
        conditions.add(pageCondition(tableName));
      }
      if (getQueryParam("componentId") != null) {
        conditions.add(componentCondition(tableName));
      }
      if (getQueryParam("category") != null) {
        conditions.add(categoryCondition(tableName));
      }
      if (getQueryParam("difficulty") != null) {
        conditions.add(difficultyCondition(tableName));
      }
      if (getQueryParam("resourceType") != null) {
        conditions.add(resourceTypeCondition(tableName));
      }
      if (getQueryParam("status") != null) {
        conditions.add(statusCondition(tableName));
      }
      if (getQueryParam("search") != null) {
        conditions.add(searchCondition(tableName));
      }
      return conditions.isEmpty() ? "" : addCondition(conditions);
    }

    private String jsonColumn(String tableName) {
      return tableName == null ? "json" : tableName + ".json";
    }

    private String nameColumn(String tableName) {
      return tableName == null ? "name" : tableName + ".name";
    }

    private String pageCondition(String tableName) {
      String column = jsonColumn(tableName);
      String pageId = getQueryParam("pageId");
      if (pageId.contains(",")) {
        return multiValuePageCondition(column, pageId);
      }
      if (Boolean.TRUE.equals(DatasourceConfig.getInstance().isMySQL())) {
        return String.format(
            "JSON_SEARCH(%s, 'one', :pageId, NULL, '$.contexts[*].pageId') IS NOT NULL", column);
      }
      return String.format(
          "EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(%s->'contexts', '[]'::jsonb)) ctx"
              + " WHERE ctx->>'pageId' = :pageId)",
          column);
    }

    private String multiValuePageCondition(String column, String pageId) {
      String[] values =
          Arrays.stream(pageId.split(","))
              .map(String::trim)
              .filter(s -> !s.isEmpty())
              .toArray(String[]::new);
      if (Boolean.TRUE.equals(DatasourceConfig.getInstance().isMySQL())) {
        StringBuilder sb = new StringBuilder("(");
        for (int i = 0; i < values.length; i++) {
          if (i > 0) sb.append(" OR ");
          sb.append(
              String.format(
                  "JSON_SEARCH(%s, 'one', '%s', NULL, '$.contexts[*].pageId') IS NOT NULL",
                  column, escapeApostrophe(values[i])));
        }
        sb.append(")");
        return sb.toString();
      }
      String inClause = getInConditionFromString(pageId);
      return String.format(
          "EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(%s->'contexts', '[]'::jsonb)) ctx"
              + " WHERE ctx->>'pageId' IN (%s))",
          column, inClause);
    }

    private String componentCondition(String tableName) {
      String column = jsonColumn(tableName);
      if (Boolean.TRUE.equals(DatasourceConfig.getInstance().isMySQL())) {
        return String.format(
            "JSON_SEARCH(%s, 'one', :componentId, NULL, '$.contexts[*].componentId') IS NOT NULL",
            column);
      }
      return String.format(
          "EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(%s->'contexts', '[]'::jsonb)) ctx"
              + " WHERE ctx->>'componentId' = :componentId)",
          column);
    }

    private String categoryCondition(String tableName) {
      String column = jsonColumn(tableName);
      String category = getQueryParam("category");
      if (category.contains(",")) {
        return multiValueCategoryCondition(column, category);
      }
      if (Boolean.TRUE.equals(DatasourceConfig.getInstance().isMySQL())) {
        return String.format(
            "JSON_SEARCH(%s, 'one', :category, NULL, '$.categories') IS NOT NULL", column);
      }
      return String.format(
          "EXISTS (SELECT 1 FROM jsonb_array_elements_text(COALESCE(%s->'categories', '[]'::jsonb)) cat"
              + " WHERE cat = :category)",
          column);
    }

    private String multiValueCategoryCondition(String column, String category) {
      String[] values =
          Arrays.stream(category.split(","))
              .map(String::trim)
              .filter(s -> !s.isEmpty())
              .toArray(String[]::new);
      if (Boolean.TRUE.equals(DatasourceConfig.getInstance().isMySQL())) {
        StringBuilder sb = new StringBuilder("(");
        for (int i = 0; i < values.length; i++) {
          if (i > 0) sb.append(" OR ");
          sb.append(
              String.format(
                  "JSON_SEARCH(%s, 'one', '%s', NULL, '$.categories') IS NOT NULL",
                  column, escapeApostrophe(values[i])));
        }
        sb.append(")");
        return sb.toString();
      }
      String inClause = getInConditionFromString(category);
      return String.format(
          "EXISTS (SELECT 1 FROM jsonb_array_elements_text(COALESCE(%s->'categories', '[]'::jsonb)) cat"
              + " WHERE cat IN (%s))",
          column, inClause);
    }

    private String difficultyCondition(String tableName) {
      String column = jsonColumn(tableName);
      if (Boolean.TRUE.equals(DatasourceConfig.getInstance().isMySQL())) {
        return String.format(
            "JSON_UNQUOTE(JSON_EXTRACT(%s, '$.difficulty')) = :difficulty", column);
      }
      return String.format("%s->>'difficulty' = :difficulty", column);
    }

    private String resourceTypeCondition(String tableName) {
      String column = jsonColumn(tableName);
      String inClause = getInConditionFromString(getQueryParam("resourceType"));
      if (Boolean.TRUE.equals(DatasourceConfig.getInstance().isMySQL())) {
        return String.format(
            "JSON_UNQUOTE(JSON_EXTRACT(%s, '$.resourceType')) IN (%s)", column, inClause);
      }
      return String.format("%s->>'resourceType' IN (%s)", column, inClause);
    }

    private String statusCondition(String tableName) {
      String column = jsonColumn(tableName);
      String inClause = getInConditionFromString(getQueryParam("status"));
      if (Boolean.TRUE.equals(DatasourceConfig.getInstance().isMySQL())) {
        return String.format(
            "JSON_UNQUOTE(JSON_EXTRACT(%s, '$.status')) IN (%s)", column, inClause);
      }
      return String.format("%s->>'status' IN (%s)", column, inClause);
    }

    private String searchCondition(String tableName) {
      String column = jsonColumn(tableName);
      String name = nameColumn(tableName);
      if (Boolean.TRUE.equals(DatasourceConfig.getInstance().isMySQL())) {
        return String.format(
            "(LOWER(%s) LIKE LOWER(:search)"
                + " OR LOWER(JSON_UNQUOTE(JSON_EXTRACT(%s, '$.displayName'))) LIKE LOWER(:search))",
            name, column);
      }
      return String.format(
          "(LOWER(%s) LIKE LOWER(:search) OR LOWER(%s->>'displayName') LIKE LOWER(:search))",
          name, column);
    }
  }

  class LearningResourceUpdater extends EntityUpdater {
    LearningResourceUpdater(
        LearningResource original, LearningResource updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate(boolean consolidatingChanges) {
      recordChange("categories", original.getCategories(), updated.getCategories());
      recordChange("contexts", original.getContexts(), updated.getContexts(), true);
      recordChange("difficulty", original.getDifficulty(), updated.getDifficulty());
      recordChange("source", original.getSource(), updated.getSource(), true);
      recordChange(
          "estimatedDuration", original.getEstimatedDuration(), updated.getEstimatedDuration());
    }
  }
}
