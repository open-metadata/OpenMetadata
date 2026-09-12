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
import static org.openmetadata.service.Entity.FIELD_TAGS;
import static org.openmetadata.service.Entity.populateEntityFieldTags;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.DashboardDataModel;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.entity.EntityModuleDependencies;
import org.openmetadata.service.entity.EntityModuleFactory;
import org.openmetadata.service.entity.metadata.DerivedTagLoader;
import org.openmetadata.service.entity.policy.EntityPolicy;
import org.openmetadata.service.entity.policy.EntityPolicyContext;
import org.openmetadata.service.entity.read.EntityReadService;
import org.openmetadata.service.entity.write.EntityColumnMutation;
import org.openmetadata.service.entity.write.EntityColumnUpdater;
import org.openmetadata.service.entity.write.EntityOperation;
import org.openmetadata.service.entity.write.EntityUpdateRequest;
import org.openmetadata.service.entity.write.EntityUpdater;
import org.openmetadata.service.resources.databases.DatabaseUtil;
import org.openmetadata.service.resources.datamodels.DashboardDataModelResource;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.FullyQualifiedName;

@Slf4j
@Repository()
public class DashboardDataModelRepository implements EntityPolicy<DashboardDataModel> {

  private static final Set<String> CHANGE_SUMMARY_FIELDS = Set.of("columns.description");

  public DashboardDataModelRepository() {
    this.entityContext =
        new EntityPolicyContext<>(
            new EntityPolicyContext.Schema<>(
                DashboardDataModelResource.COLLECTION_PATH,
                Entity.DASHBOARD_DATA_MODEL,
                DashboardDataModel.class,
                Entity.getCollectionDAO().dashboardDataModelDAO()),
            new EntityPolicyContext.WriteFields("", "", CHANGE_SUMMARY_FIELDS),
            EntityModuleDependencies.standard());
    EntityModuleFactory.initialize(this, true);
    context().options().setSupportsSearch(true);
    // Covered by the parent service delete cascade: search docs by service.id
    // (SearchRepository.deleteOrUpdateChildren) and field_relationship / tag_usage by
    // the root cleanup() FQN prefix. See EntityRepository#descendantsCoveredByAncestorCascade.
    context().options().setDescendantsCoveredByAncestorCascade(true);
    // Register bulk field fetchers for efficient database operations
    fieldLoading().register(FIELD_TAGS, this::fetchAndSetColumnTags);
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
  public void prepare(DashboardDataModel dashboardDataModel, boolean update) {
    var dashboardService =
        (DashboardService) getCachedParentOrLoad(dashboardDataModel.getService(), "", Include.ALL);
    dashboardDataModel.setService(dashboardService.getEntityReference());
    dashboardDataModel.setServiceType(dashboardService.getServiceType());
  }

  @Override
  public List<String> getFieldsStrippedFromStorageJson() {
    return List.of("service");
  }

  @Override
  public void storeEntity(DashboardDataModel dashboardDataModel, boolean update) {
    persistence().store(dashboardDataModel, update);
  }

  @Override
  public void storeEntities(List<DashboardDataModel> entities) {
    persistence().insertMany(entities);
  }

  @Override
  public List<Column> getColumnsForExtensionPersistence(DashboardDataModel entity) {
    return entity.getColumns();
  }

  @Override
  public void clearEntitySpecificRelationshipsForMany(List<DashboardDataModel> entities) {
    if (entities.isEmpty()) return;
    List<UUID> ids = entities.stream().map(DashboardDataModel::getId).toList();
    deleteToMany(ids, context().schema().entityType(), Relationship.CONTAINS, null);
  }

  @Override
  @SneakyThrows
  public void storeRelationships(DashboardDataModel dashboardDataModel) {
    addServiceRelationship(dashboardDataModel, dashboardDataModel.getService());
  }

  @Override
  public void storeEntitySpecificRelationshipsForMany(List<DashboardDataModel> entities) {
    List<CollectionDAO.EntityRelationshipObject> relationships = new ArrayList<>();
    for (DashboardDataModel dataModel : entities) {
      EntityReference service = dataModel.getService();
      if (service == null || service.getId() == null) {
        continue;
      }
      relationships.add(
          newRelationship(
              service.getId(),
              dataModel.getId(),
              service.getType(),
              context().schema().entityType(),
              Relationship.CONTAINS));
    }
    bulkInsertRelationships(relationships);
  }

  @Override
  public void setFields(
      DashboardDataModel dashboardDataModel, Fields fields, RelationIncludes relationIncludes) {
    setDefaultFields(dashboardDataModel);
    populateEntityFieldTags(
        context().schema().entityType(),
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
    EntityReference service = relationships().container(dashboardDataModel.getId(), null);
    dashboardDataModel.withService(service);
  }

  private Object getColumnExtension(UUID dataModelId, String columnFQN) {
    try {
      String extensionKey = FullyQualifiedName.buildHash(columnFQN);
      String extensionJson =
          context()
              .dependencies()
              .daos()
              .entityExtensionDAO()
              .getExtension(dataModelId, extensionKey);
      if (extensionJson != null) {
        return JsonUtils.readValue(extensionJson, Object.class);
      }
    } catch (Exception e) {
      LOG.warn("Failed to get extension for column {}: {}", columnFQN, e.getMessage());
    }
    return null;
  }

  // Individual field fetchers registered in constructor
  @Override
  public DerivedTagLoader.FailureMode derivedTagFailureMode() {
    return DerivedTagLoader.FailureMode.FALL_BACK_TO_INDIVIDUAL;
  }

  private void fetchAndSetColumnTags(List<DashboardDataModel> dataModels, Fields fields) {
    if (!fields.contains(FIELD_TAGS) || dataModels == null || dataModels.isEmpty()) {
      return;
    }
    // Then, if columns field is requested, also fetch column-level tags
    if (fields.contains("columns")) {
      // Use bulk tag fetching to avoid N+1 queries
      fieldTags().populate(dataModels, DashboardDataModel::getColumns);
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
    fieldLoading().populate(dataModels, fields);
    setInheritedFields(dataModels, fields);
  }

  @Override
  public void restorePatchAttributes(DashboardDataModel original, DashboardDataModel updated) {
    // Patch can't make changes to following fields. Ignore the changes
    EntityPolicy.super.restorePatchAttributes(original, updated);
    updated.withService(original.getService());
  }

  @Override
  public void applyTags(DashboardDataModel dashboardDataModel) {
    // Add table level tags by adding tag to table relationship
    EntityPolicy.super.applyTags(dashboardDataModel);
    tagWrites().addColumns(dashboardDataModel.getColumns());
  }

  @Override
  public EntityReference getParentReference(DashboardDataModel entity) {
    return entity.getService();
  }

  @Override
  public EntityInterface getParentEntity(DashboardDataModel entity, String fields) {
    if (entity.getService() == null) {
      return null;
    }
    return Entity.getEntity(entity.getService(), fields, ALL);
  }

  @Override
  public EntityUpdater<DashboardDataModel> getUpdater(
      DashboardDataModel original,
      DashboardDataModel updated,
      EntityOperation operation,
      ChangeSource changeSource) {
    return new DataModelUpdater(original, updated, operation).mutation();
  }

  @Override
  public void validateTags(DashboardDataModel entity) {
    EntityPolicy.super.validateTags(entity);
    validateColumnTags(entity.getColumns());
  }

  public class DataModelUpdater implements EntityColumnMutation<DashboardDataModel> {

    public DataModelUpdater(
        DashboardDataModel original, DashboardDataModel updated, EntityOperation operation) {
      this.entityUpdate =
          new EntityUpdater<>(
              context().services().getUpdaterServices(),
              new EntityUpdateRequest<>(original, updated, operation, null, false),
              this);
      this.columnUpdate = new EntityColumnUpdater<>(entityUpdate, this);
    }

    @Transaction
    @Override
    public void update(
        EntityUpdater<DashboardDataModel> entityUpdate, boolean consolidatingChanges) {
      entityUpdate.compareAndUpdate(
          "columns",
          () -> {
            DatabaseUtil.validateColumns(entityUpdate.getOriginal().getColumns());
            columnUpdate.updateColumns(
                "columns",
                entityUpdate.getOriginal().getColumns(),
                entityUpdate.getUpdated().getColumns(),
                EntityUtil.columnMatch);
          });
      entityUpdate.compareAndUpdate(
          "sourceUrl",
          () ->
              entityUpdate.recordChange(
                  "sourceUrl",
                  entityUpdate.getOriginal().getSourceUrl(),
                  entityUpdate.getUpdated().getSourceUrl()));
      entityUpdate.compareAndUpdate(
          "sourceHash",
          () ->
              entityUpdate.recordChange(
                  "sourceHash",
                  entityUpdate.getOriginal().getSourceHash(),
                  entityUpdate.getUpdated().getSourceHash(),
                  false,
                  EntityUtil.objectMatch,
                  false));
      entityUpdate.compareAndUpdate(
          "sql",
          () ->
              entityUpdate.recordChange(
                  "sql", entityUpdate.getOriginal().getSql(), entityUpdate.getUpdated().getSql()));
    }

    private final EntityUpdater<DashboardDataModel> entityUpdate;

    public EntityUpdater<DashboardDataModel> mutation() {
      return entityUpdate;
    }

    private final EntityColumnUpdater<DashboardDataModel> columnUpdate;
  }

  public ResultList<Column> getDataModelColumns(
      UUID dataModelId, int limit, int offset, String fieldsParam, Include include) {
    DashboardDataModel dataModel = lookup().byId(dataModelId, include);
    return getDataModelColumnsInternal(dataModel, limit, offset, fieldsParam, include);
  }

  public ResultList<Column> getDataModelColumnsByFQN(
      String fqn, int limit, int offset, String fieldsParam, Include include) {
    DashboardDataModel dataModel = lookup().byName(fqn, include);
    return getDataModelColumnsInternal(dataModel, limit, offset, fieldsParam, include);
  }

  private ResultList<Column> getDataModelColumnsInternal(
      DashboardDataModel dataModel, int limit, int offset, String fieldsParam, Include include) {
    // For paginated column access, we need to load the data model with columns
    // but we'll optimize the field loading to only process what we need
    DashboardDataModel fullDataModel =
        reads()
            .byId(
                dataModel.getId(),
                new EntityReadService.Query(
                    null,
                    fieldPolicy().parse(Set.of("columns")),
                    RelationIncludes.fromInclude(include),
                    false));
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
          context().schema().entityType(),
          paginatedColumns,
          dataModel.getFullyQualifiedName(),
          true);
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

  public Column enrichSingleColumnFields(
      DashboardDataModel dataModel, Column column, String fieldsParam) {
    if (fieldsParam == null) {
      return column;
    }
    List<Column> singleton = new ArrayList<>(List.of(column));
    if (fieldsParam.contains("tags")) {
      populateEntityFieldTags(
          context().schema().entityType(), singleton, dataModel.getFullyQualifiedName(), true);
    }
    if (fieldsParam.contains("extension")) {
      column.setExtension(getColumnExtension(dataModel.getId(), column.getFullyQualifiedName()));
    }
    return column;
  }

  public ResultList<Column> searchDataModelColumnsById(
      UUID id, String query, int limit, int offset, String fieldsParam, Include include) {
    DashboardDataModel dataModel =
        reads()
            .byId(
                id,
                new EntityReadService.Query(
                    null,
                    fieldPolicy().parse(fieldsParam),
                    RelationIncludes.fromInclude(include),
                    false));
    return searchDataModelColumnsInternal(dataModel, query, limit, offset, fieldsParam);
  }

  public ResultList<Column> searchDataModelColumnsByFQN(
      String fqn, String query, int limit, int offset, String fieldsParam, Include include) {
    DashboardDataModel dataModel =
        reads()
            .byName(
                fqn,
                new EntityReadService.Query(
                    null,
                    fieldPolicy().parse(fieldsParam),
                    RelationIncludes.fromInclude(include),
                    false));
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
    Fields fields = fieldPolicy().parse(fieldsParam);
    if (fields.contains("tags") || fields.contains("*")) {
      populateEntityFieldTags(
          context().schema().entityType(),
          paginatedResults,
          dataModel.getFullyQualifiedName(),
          true);
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

  private final EntityPolicyContext<DashboardDataModel> entityContext;

  @Override
  public final EntityPolicyContext<DashboardDataModel> context() {
    return entityContext;
  }
}
