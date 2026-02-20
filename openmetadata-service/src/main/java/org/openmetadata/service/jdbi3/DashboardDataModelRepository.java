/*
 *  Copyright 2021 Collate
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

import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.service.Entity.DASHBOARD_DATA_MODEL;
import static org.openmetadata.service.Entity.FIELD_TAGS;
import static org.openmetadata.service.Entity.populateEntityFieldTags;
import static org.openmetadata.service.resources.tags.TagLabelUtil.addDerivedTagsGracefully;

import com.google.gson.Gson;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.feed.ResolveTask;
import org.openmetadata.schema.entity.data.DashboardDataModel;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TaskType;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.FeedRepository.TaskWorkflow;
import org.openmetadata.service.jdbi3.FeedRepository.ThreadContext;
import org.openmetadata.service.resources.databases.DatabaseUtil;
import org.openmetadata.service.resources.datamodels.DashboardDataModelResource;
import org.openmetadata.service.resources.feeds.MessageParser.EntityLink;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.FullyQualifiedName;

@Slf4j
public class DashboardDataModelRepository extends EntityRepository<DashboardDataModel> {
  public DashboardDataModelRepository() {
    super(
        DashboardDataModelResource.COLLECTION_PATH,
        Entity.DASHBOARD_DATA_MODEL,
        DashboardDataModel.class,
        Entity.getCollectionDAO().dashboardDataModelDAO(),
        "",
        "");
    supportsSearch = true;

    // Register bulk field fetchers for efficient database operations
    fieldFetchers.put(FIELD_TAGS, this::fetchAndSetColumnTags);
  }

  @Override
  public void setFullyQualifiedName(DashboardDataModel dashboardDataModel) {
    // Use getFullyQualifiedName() instead of getName() to properly handle service names with dots
    // Service FQN is already properly quoted (e.g., "service.with.dots" for names containing dots)
    String serviceFqn = dashboardDataModel.getService().getFullyQualifiedName();
    dashboardDataModel.setFullyQualifiedName(
        FullyQualifiedName.add(serviceFqn + ".model", dashboardDataModel.getName()));
    ColumnUtil.setColumnFQN(
        dashboardDataModel.getFullyQualifiedName(), dashboardDataModel.getColumns());
  }

  @Override
  public TaskWorkflow getTaskWorkflow(ThreadContext threadContext) {
    validateTaskThread(threadContext);
    EntityLink entityLink = threadContext.getAbout();
    if (entityLink.getFieldName().equals("columns")) {
      TaskType taskType = threadContext.getThread().getTask().getType();
      if (EntityUtil.isDescriptionTask(taskType)) {
        return new ColumnDescriptionTaskWorkflow(threadContext);
      } else if (EntityUtil.isTagTask(taskType)) {
        return new ColumnTagTaskWorkflow(threadContext);
      } else {
        throw new IllegalArgumentException(String.format("Invalid task type %s", taskType));
      }
    }
    return super.getTaskWorkflow(threadContext);
  }

  static class ColumnDescriptionTaskWorkflow extends DescriptionTaskWorkflow {
    private final Column column;

    ColumnDescriptionTaskWorkflow(ThreadContext threadContext) {
      super(threadContext);
      DashboardDataModel dataModel =
          Entity.getEntity(
              DASHBOARD_DATA_MODEL, threadContext.getAboutEntity().getId(), "columns", ALL);
      threadContext.setAboutEntity(dataModel);
      column =
          EntityUtil.findColumn(
              dataModel.getColumns(), threadContext.getAbout().getArrayFieldName());
    }

    @Override
    public EntityInterface performTask(String user, ResolveTask resolveTask) {
      column.setDescription(resolveTask.getNewValue());
      return threadContext.getAboutEntity();
    }
  }

  static class ColumnTagTaskWorkflow extends TagTaskWorkflow {
    private final Column column;

    ColumnTagTaskWorkflow(ThreadContext threadContext) {
      super(threadContext);
      DashboardDataModel dataModel =
          Entity.getEntity(
              DASHBOARD_DATA_MODEL, threadContext.getAboutEntity().getId(), "columns,tags", ALL);
      threadContext.setAboutEntity(dataModel);
      column =
          EntityUtil.findColumn(
              dataModel.getColumns(), threadContext.getAbout().getArrayFieldName());
    }

    @Override
    public EntityInterface performTask(String user, ResolveTask resolveTask) {
      List<TagLabel> tags = JsonUtils.readObjects(resolveTask.getNewValue(), TagLabel.class);
      column.setTags(tags);
      return threadContext.getAboutEntity();
    }
  }

  @Override
  public void prepare(DashboardDataModel dashboardDataModel, boolean update) {
    DashboardService dashboardService =
        Entity.getEntity(dashboardDataModel.getService(), "", Include.ALL);
    dashboardDataModel.setService(dashboardService.getEntityReference());
    dashboardDataModel.setServiceType(dashboardService.getServiceType());
  }

  @Override
  public void storeEntity(DashboardDataModel dashboardDataModel, boolean update) {
    EntityReference service = dashboardDataModel.getService();
    dashboardDataModel.withService(null);
    store(dashboardDataModel, update);
    dashboardDataModel.withService(service);
  }

  @Override
  public void storeEntities(List<DashboardDataModel> entities) {
    List<DashboardDataModel> entitiesToStore = new ArrayList<>();
    Gson gson = new Gson();

    for (DashboardDataModel dashboardDataModel : entities) {
      EntityReference service = dashboardDataModel.getService();
      dashboardDataModel.withService(null);

      String jsonCopy = gson.toJson(dashboardDataModel);
      entitiesToStore.add(gson.fromJson(jsonCopy, DashboardDataModel.class));

      dashboardDataModel.withService(service);
    }

    storeMany(entitiesToStore);
  }

  @Override
  protected void clearEntitySpecificRelationshipsForMany(List<DashboardDataModel> entities) {
    if (entities.isEmpty()) return;
    List<UUID> ids = entities.stream().map(DashboardDataModel::getId).toList();
    deleteToMany(ids, entityType, Relationship.CONTAINS, null);
  }

  @Override
  @SneakyThrows
  public void storeRelationships(DashboardDataModel dashboardDataModel) {
    addServiceRelationship(dashboardDataModel, dashboardDataModel.getService());
  }

  @Override
  public void setFields(
      DashboardDataModel dashboardDataModel, Fields fields, RelationIncludes relationIncludes) {
    setDefaultFields(dashboardDataModel);
    populateEntityFieldTags(
        entityType,
        dashboardDataModel.getColumns(),
        dashboardDataModel.getFullyQualifiedName(),
        fields.contains(FIELD_TAGS));
    if (fields.contains("columns") && fields.contains("extension")) {
      if (dashboardDataModel.getColumns() != null) {
        for (Column column : dashboardDataModel.getColumns()) {
          column.setExtension(
              getColumnExtension(dashboardDataModel.getId(), column.getFullyQualifiedName()));
        }
      }
    }
  }

  private void setDefaultFields(DashboardDataModel dashboardDataModel) {
    EntityReference service = getContainer(dashboardDataModel.getId());
    dashboardDataModel.withService(service);
  }

  private Object getColumnExtension(UUID dataModelId, String columnFQN) {
    try {
      String extensionKey = FullyQualifiedName.buildHash(columnFQN);
      String extensionJson =
          daoCollection.entityExtensionDAO().getExtension(dataModelId, extensionKey);
      if (extensionJson != null) {
        return JsonUtils.readValue(extensionJson, Object.class);
      }
    } catch (Exception e) {
      LOG.warn("Failed to get extension for column {}: {}", columnFQN, e.getMessage());
    }
    return null;
  }

  // Individual field fetchers registered in constructor
  private void fetchAndSetColumnTags(List<DashboardDataModel> dataModels, Fields fields) {
    if (!fields.contains(FIELD_TAGS) || dataModels == null || dataModels.isEmpty()) {
      return;
    }

    // First, fetch entity-level tags (important for search indexing)
    List<String> entityFQNs =
        dataModels.stream().map(DashboardDataModel::getFullyQualifiedName).toList();
    Map<String, List<TagLabel>> tagsMap = batchFetchTags(entityFQNs);
    for (DashboardDataModel dataModel : dataModels) {
      dataModel.setTags(
          addDerivedTagsGracefully(
              tagsMap.getOrDefault(dataModel.getFullyQualifiedName(), Collections.emptyList())));
    }

    // Then, if columns field is requested, also fetch column-level tags
    if (fields.contains("columns")) {
      // Use bulk tag fetching to avoid N+1 queries
      bulkPopulateEntityFieldTags(
          dataModels,
          entityType,
          DashboardDataModel::getColumns,
          DashboardDataModel::getFullyQualifiedName);
    }
  }

  @Override
  public void clearFields(DashboardDataModel dashboardDataModel, Fields fields) {}

  @Override
  public void setFieldsInBulk(Fields fields, List<DashboardDataModel> dataModels) {
    if (dataModels.isEmpty()) {
      return;
    }

    // Set default fields (service) for all data models
    for (DashboardDataModel dataModel : dataModels) {
      setDefaultFields(dataModel);
    }

    fetchAndSetFields(dataModels, fields);
    setInheritedFields(dataModels, fields);

    // Bulk fetch tags for columns if needed
    fetchAndSetColumnTags(dataModels, fields);
  }

  @Override
  public void restorePatchAttributes(DashboardDataModel original, DashboardDataModel updated) {
    // Patch can't make changes to following fields. Ignore the changes
    super.restorePatchAttributes(original, updated);
    updated.withService(original.getService());
  }

  @Override
  public void applyTags(DashboardDataModel dashboardDataModel) {
    // Add table level tags by adding tag to table relationship
    super.applyTags(dashboardDataModel);
    applyColumnTags(dashboardDataModel.getColumns());
  }

  @Override
  public EntityInterface getParentEntity(DashboardDataModel entity, String fields) {
    if (entity.getService() == null) {
      return null;
    }
    return Entity.getEntity(entity.getService(), fields, ALL);
  }

  @Override
  public EntityRepository<DashboardDataModel>.EntityUpdater getUpdater(
      DashboardDataModel original,
      DashboardDataModel updated,
      Operation operation,
      ChangeSource changeSource) {
    return new DataModelUpdater(original, updated, operation);
  }

  @Override
  public void validateTags(DashboardDataModel entity) {
    super.validateTags(entity);
    validateColumnTags(entity.getColumns());
  }

  public class DataModelUpdater extends ColumnEntityUpdater {

    public DataModelUpdater(
        DashboardDataModel original, DashboardDataModel updated, Operation operation) {
      super(original, updated, operation);
    }

    @Transaction
    @Override
    public void entitySpecificUpdate(boolean consolidatingChanges) {
      DatabaseUtil.validateColumns(original.getColumns());
      updateColumns("columns", original.getColumns(), updated.getColumns(), EntityUtil.columnMatch);
      recordChange("sourceUrl", original.getSourceUrl(), updated.getSourceUrl());
      recordChange(
          "sourceHash",
          original.getSourceHash(),
          updated.getSourceHash(),
          false,
          EntityUtil.objectMatch,
          false);
      recordChange("sql", original.getSql(), updated.getSql());
    }
  }

  public ResultList<Column> getDataModelColumns(
      UUID dataModelId, int limit, int offset, String fieldsParam, Include include) {
    DashboardDataModel dataModel = find(dataModelId, include);
    return getDataModelColumnsInternal(dataModel, limit, offset, fieldsParam, include);
  }

  public ResultList<Column> getDataModelColumnsByFQN(
      String fqn, int limit, int offset, String fieldsParam, Include include) {
    DashboardDataModel dataModel = findByName(fqn, include);
    return getDataModelColumnsInternal(dataModel, limit, offset, fieldsParam, include);
  }

  private ResultList<Column> getDataModelColumnsInternal(
      DashboardDataModel dataModel, int limit, int offset, String fieldsParam, Include include) {
    // For paginated column access, we need to load the data model with columns
    // but we'll optimize the field loading to only process what we need
    DashboardDataModel fullDataModel =
        get(null, dataModel.getId(), getFields(Set.of("columns")), include, false);

    List<Column> allColumns = fullDataModel.getColumns();
    if (allColumns == null || allColumns.isEmpty()) {
      return new ResultList<>(new ArrayList<>(), "0", String.valueOf(offset + limit), 0);
    }

    // Apply pagination
    int total = allColumns.size();
    int fromIndex = Math.min(offset, total);
    int toIndex = Math.min(offset + limit, total);

    List<Column> paginatedColumns = allColumns.subList(fromIndex, toIndex);

    // Apply field processing if needed
    if (fieldsParam != null && fieldsParam.contains("tags")) {
      populateEntityFieldTags(
          entityType, paginatedColumns, dataModel.getFullyQualifiedName(), true);
    }

    if (fieldsParam != null && fieldsParam.contains("extension")) {
      for (Column column : paginatedColumns) {
        column.setExtension(getColumnExtension(dataModel.getId(), column.getFullyQualifiedName()));
      }
    }

    // Calculate pagination metadata
    String before = offset > 0 ? String.valueOf(Math.max(0, offset - limit)) : null;
    String after = toIndex < total ? String.valueOf(toIndex) : null;

    return new ResultList<>(paginatedColumns, before, after, total);
  }

  public ResultList<Column> searchDataModelColumnsById(
      UUID id, String query, int limit, int offset, String fieldsParam, Include include) {
    DashboardDataModel dataModel = get(null, id, getFields(fieldsParam), include, false);
    return searchDataModelColumnsInternal(dataModel, query, limit, offset, fieldsParam);
  }

  public ResultList<Column> searchDataModelColumnsByFQN(
      String fqn, String query, int limit, int offset, String fieldsParam, Include include) {
    DashboardDataModel dataModel = getByName(null, fqn, getFields(fieldsParam), include, false);
    return searchDataModelColumnsInternal(dataModel, query, limit, offset, fieldsParam);
  }

  private ResultList<Column> searchDataModelColumnsInternal(
      DashboardDataModel dataModel, String query, int limit, int offset, String fieldsParam) {
    List<Column> allColumns = dataModel.getColumns();
    if (allColumns == null || allColumns.isEmpty()) {
      return new ResultList<>(List.of(), null, null, 0);
    }

    // Flatten nested columns for search
    List<Column> flattenedColumns = flattenColumns(allColumns);

    List<Column> matchingColumns;
    if (query == null || query.trim().isEmpty()) {
      matchingColumns = flattenedColumns;
    } else {
      String searchTerm = query.toLowerCase().trim();
      matchingColumns =
          flattenedColumns.stream()
              .filter(
                  column -> {
                    if (column.getName() != null
                        && column.getName().toLowerCase().contains(searchTerm)) {
                      return true;
                    }
                    if (column.getDisplayName() != null
                        && column.getDisplayName().toLowerCase().contains(searchTerm)) {
                      return true;
                    }
                    return column.getDescription() != null
                        && column.getDescription().toLowerCase().contains(searchTerm);
                  })
              .toList();
    }

    int total = matchingColumns.size();
    int startIndex = Math.min(offset, total);
    int endIndex = Math.min(offset + limit, total);

    List<Column> paginatedResults =
        startIndex < total ? matchingColumns.subList(startIndex, endIndex) : List.of();

    Fields fields = getFields(fieldsParam);
    if (fields.contains("tags") || fields.contains("*")) {
      populateEntityFieldTags(
          entityType, paginatedResults, dataModel.getFullyQualifiedName(), true);
    }

    String before = offset > 0 ? String.valueOf(Math.max(0, offset - limit)) : null;
    String after = endIndex < total ? String.valueOf(endIndex) : null;
    return new ResultList<>(paginatedResults, before, after, total);
  }

  private List<Column> flattenColumns(List<Column> columns) {
    List<Column> flattened = new ArrayList<>();
    for (Column column : columns) {
      flattened.add(column);
      if (column.getChildren() != null && !column.getChildren().isEmpty()) {
        flattened.addAll(flattenColumns(column.getChildren()));
      }
    }
    return flattened;
  }
}
