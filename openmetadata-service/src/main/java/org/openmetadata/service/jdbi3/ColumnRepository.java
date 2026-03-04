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

import static org.openmetadata.service.Entity.DASHBOARD_DATA_MODEL;
import static org.openmetadata.service.Entity.DASHBOARD_DATA_MODEL_COLUMN;
import static org.openmetadata.service.Entity.TABLE;
import static org.openmetadata.service.Entity.TABLE_COLUMN;
import static org.openmetadata.service.events.ChangeEventHandler.copyChangeEvent;
import static org.openmetadata.service.formatter.util.FormatterUtil.createChangeEventForEntity;
import static org.openmetadata.service.resources.tags.TagLabelUtil.addDerivedTags;

import jakarta.json.JsonPatch;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.BiConsumer;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.data.BulkColumnUpdatePreview;
import org.openmetadata.schema.api.data.BulkColumnUpdateRequest;
import org.openmetadata.schema.api.data.ColumnGridItem;
import org.openmetadata.schema.api.data.ColumnGridResponse;
import org.openmetadata.schema.api.data.ColumnMetadata;
import org.openmetadata.schema.api.data.ColumnOccurrence;
import org.openmetadata.schema.api.data.ColumnUpdate;
import org.openmetadata.schema.api.data.ColumnUpdatePreview;
import org.openmetadata.schema.api.data.GroupedColumnsResponse;
import org.openmetadata.schema.api.data.UpdateColumn;
import org.openmetadata.schema.entity.data.DashboardDataModel;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.type.api.BulkResponse;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.search.ColumnAggregator;
import org.openmetadata.service.search.SearchClient;
import org.openmetadata.service.search.elasticsearch.ElasticSearchClient;
import org.openmetadata.service.search.elasticsearch.ElasticSearchColumnAggregator;
import org.openmetadata.service.search.opensearch.OpenSearchClient;
import org.openmetadata.service.search.opensearch.OpenSearchColumnAggregator;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.RestUtil;

@Slf4j
public class ColumnRepository {
  private final Authorizer authorizer;
  private final ColumnAggregator columnAggregator;

  public ColumnRepository(Authorizer authorizer, SearchClient searchClient) {
    this.authorizer = authorizer;
    if (searchClient instanceof ElasticSearchClient) {
      this.columnAggregator =
          new ElasticSearchColumnAggregator(
              ((ElasticSearchClient) searchClient).getHighLevelClient());
    } else if (searchClient instanceof OpenSearchClient) {
      this.columnAggregator =
          new OpenSearchColumnAggregator(((OpenSearchClient) searchClient).getHighLevelClient());
    } else {
      throw new IllegalArgumentException(
          "Unsupported SearchClient type: " + searchClient.getClass().getName());
    }
  }

  public ColumnGridResponse getColumnGridPaginated(
      SecurityContext securityContext, ColumnAggregator.ColumnAggregationRequest request)
      throws IOException {
    ColumnGridResponse response = columnAggregator.aggregateColumns(request);

    if (Boolean.TRUE.equals(request.getHasConflicts())) {
      response.setColumns(
          response.getColumns().stream()
              .filter(ColumnGridItem::getHasVariations)
              .collect(Collectors.toList()));
    }

    if (Boolean.TRUE.equals(request.getHasMissingMetadata())) {
      response.setColumns(
          response.getColumns().stream()
              .filter(this::hasMissingMetadata)
              .collect(Collectors.toList()));
    }

    // Filter by INCONSISTENT status (requires post-aggregation filtering)
    if ("INCONSISTENT".equalsIgnoreCase(request.getMetadataStatus())) {
      response.setColumns(
          response.getColumns().stream()
              .filter(ColumnGridItem::getHasVariations)
              .collect(Collectors.toList()));
    }

    return response;
  }

  private boolean hasMissingMetadata(ColumnGridItem item) {
    return item.getGroups().stream()
        .anyMatch(
            group ->
                (group.getDescription() == null || group.getDescription().isEmpty())
                    || (group.getTags() == null || group.getTags().isEmpty()));
  }

  public Column updateColumnByFQN(
      UriInfo uriInfo,
      SecurityContext securityContext,
      String columnFQN,
      String entityType,
      UpdateColumn updateColumn) {
    Objects.requireNonNull(columnFQN, "columnFQN cannot be null");
    Objects.requireNonNull(updateColumn, "updateColumn cannot be null");

    if (columnFQN.isBlank()) {
      throw new IllegalArgumentException("columnFQN cannot be blank");
    }

    // Validate entity type first before any other processing
    validateEntityType(entityType);

    String parentFQN = extractParentFQN(columnFQN, entityType);
    EntityReference parentEntityRef = getParentEntityByFQN(parentFQN, entityType);
    String user = securityContext.getUserPrincipal().getName();

    return switch (entityType) {
      case TABLE -> updateTableColumn(
          uriInfo, securityContext, user, columnFQN, updateColumn, parentEntityRef);
      case DASHBOARD_DATA_MODEL -> updateDashboardDataModelColumn(
          uriInfo, securityContext, user, columnFQN, updateColumn, parentEntityRef);
      default -> throw new IllegalStateException("Unexpected entity type: " + entityType);
    };
  }

  private void validateEntityType(String entityType) {
    if (entityType == null) {
      throw new IllegalArgumentException(
          "Entity type is required. Supported types are: table, dashboardDataModel");
    }
    if (!TABLE.equals(entityType) && !DASHBOARD_DATA_MODEL.equals(entityType)) {
      throw new IllegalArgumentException(
          "Unsupported entity type: %s. Supported types are: %s, %s"
              .formatted(entityType, TABLE, DASHBOARD_DATA_MODEL));
    }
  }

  private String extractParentFQN(String columnFQN, String entityType) {
    try {
      return FullyQualifiedName.getParentEntityFQN(columnFQN, entityType);
    } catch (Exception e) {
      throw new IllegalArgumentException(
          "Invalid column FQN format: %s. Error: %s".formatted(columnFQN, e.getMessage()), e);
    }
  }

  private Column updateTableColumn(
      UriInfo uriInfo,
      SecurityContext securityContext,
      String user,
      String columnFQN,
      UpdateColumn updateColumn,
      EntityReference parentEntityRef) {
    TableRepository tableRepository = (TableRepository) Entity.getEntityRepository(TABLE);
    Table originalTable =
        tableRepository.get(
            null,
            parentEntityRef.getId(),
            tableRepository.getFields("columns,tags,tableConstraints"),
            Include.NON_DELETED,
            false);

    Table updatedTable = JsonUtils.deepCopy(originalTable, Table.class);
    ColumnUtil.setColumnFQN(updatedTable.getFullyQualifiedName(), updatedTable.getColumns());

    Column column =
        findColumnInHierarchy(updatedTable.getColumns(), columnFQN)
            .orElseThrow(
                () -> new EntityNotFoundException("Column not found: %s".formatted(columnFQN)));

    applyColumnUpdates(column, updateColumn, TABLE_COLUMN, true);

    JsonPatch jsonPatch = JsonUtils.getJsonPatch(originalTable, updatedTable);

    // Debug logging
    LOG.info(
        "Column update - columnFQN: {}, updateColumn: displayName={}, description={}, tags={}",
        columnFQN,
        updateColumn.getDisplayName(),
        updateColumn.getDescription(),
        updateColumn.getTags() != null ? updateColumn.getTags().size() : "null");
    LOG.info(
        "Column after update - displayName={}, description={}, tags={}",
        column.getDisplayName(),
        column.getDescription(),
        column.getTags() != null ? column.getTags().size() : "null");
    LOG.info("JSON Patch operations: {}", jsonPatch.toJsonArray().toString());

    authorizeAndPatch(securityContext, TABLE, parentEntityRef, jsonPatch);

    RestUtil.PatchResponse<Table> patchResponse =
        tableRepository.patch(uriInfo, parentEntityRef.getId(), user, jsonPatch);
    triggerParentChangeEvent(patchResponse.entity(), user);

    return column;
  }

  private Column updateDashboardDataModelColumn(
      UriInfo uriInfo,
      SecurityContext securityContext,
      String user,
      String columnFQN,
      UpdateColumn updateColumn,
      EntityReference parentEntityRef) {
    DashboardDataModelRepository dataModelRepository =
        (DashboardDataModelRepository) Entity.getEntityRepository(DASHBOARD_DATA_MODEL);

    DashboardDataModel originalDataModel =
        dataModelRepository.get(
            null,
            parentEntityRef.getId(),
            dataModelRepository.getFields("columns,tags"),
            Include.NON_DELETED,
            false);

    DashboardDataModel updatedDataModel =
        JsonUtils.deepCopy(originalDataModel, DashboardDataModel.class);

    setDataModelColumnFQN(updatedDataModel.getFullyQualifiedName(), updatedDataModel.getColumns());

    Column column =
        findColumnInHierarchy(updatedDataModel.getColumns(), columnFQN)
            .orElseThrow(
                () -> new EntityNotFoundException("Column not found: %s".formatted(columnFQN)));

    applyColumnUpdates(column, updateColumn, DASHBOARD_DATA_MODEL_COLUMN, false);

    JsonPatch jsonPatch = JsonUtils.getJsonPatch(originalDataModel, updatedDataModel);
    authorizeAndPatch(securityContext, DASHBOARD_DATA_MODEL, parentEntityRef, jsonPatch);

    RestUtil.PatchResponse<DashboardDataModel> patchResponse =
        dataModelRepository.patch(uriInfo, parentEntityRef.getId(), user, jsonPatch);
    triggerParentChangeEvent(patchResponse.entity(), user);

    return column;
  }

  private void applyColumnUpdates(
      Column column,
      UpdateColumn updateColumn,
      String columnEntityType,
      boolean supportsConstraints) {
    Optional.ofNullable(updateColumn.getDisplayName())
        .ifPresent(name -> column.setDisplayName(name.trim().isEmpty() ? null : name));

    Optional.ofNullable(updateColumn.getDescription())
        .ifPresent(desc -> column.setDescription(desc.trim().isEmpty() ? null : desc));

    Optional.ofNullable(updateColumn.getTags())
        .ifPresent(tags -> column.setTags(addDerivedTags(tags)));

    if (supportsConstraints) {
      if (Boolean.TRUE.equals(updateColumn.getRemoveConstraint())) {
        column.setConstraint(null);
      } else {
        Optional.ofNullable(updateColumn.getConstraint()).ifPresent(column::setConstraint);
      }
    }

    Optional.ofNullable(updateColumn.getExtension())
        .ifPresent(
            ext -> {
              Object transformedExtension =
                  EntityRepository.validateAndTransformExtension(ext, columnEntityType);
              column.setExtension(transformedExtension);
            });
  }

  private void authorizeAndPatch(
      SecurityContext securityContext,
      String entityType,
      EntityReference parentEntityRef,
      JsonPatch jsonPatch) {
    OperationContext operationContext = new OperationContext(entityType, jsonPatch);
    ResourceContextInterface resourceContext =
        new ResourceContext<>(
            entityType, parentEntityRef.getId(), null, ResourceContextInterface.Operation.PATCH);
    authorizer.authorize(securityContext, operationContext, resourceContext);
  }

  private void setDataModelColumnFQN(String parentFQN, List<Column> columns) {
    if (columns == null) {
      return;
    }
    columns.forEach(
        c -> {
          String columnFqn = FullyQualifiedName.add(parentFQN, c.getName());
          c.setFullyQualifiedName(columnFqn);
          if (c.getChildren() != null) {
            setDataModelColumnFQN(columnFqn, c.getChildren());
          }
        });
  }

  private EntityReference getParentEntityByFQN(String parentFQN, String entityType) {
    return switch (entityType) {
      case TABLE -> {
        TableRepository tableRepository = (TableRepository) Entity.getEntityRepository(TABLE);
        Table table = tableRepository.findByName(parentFQN, Include.NON_DELETED);
        yield table.getEntityReference();
      }
      case DASHBOARD_DATA_MODEL -> {
        DashboardDataModelRepository dataModelRepository =
            (DashboardDataModelRepository) Entity.getEntityRepository(DASHBOARD_DATA_MODEL);
        DashboardDataModel dataModel =
            dataModelRepository.findByName(parentFQN, Include.NON_DELETED);
        yield dataModel.getEntityReference();
      }
      default -> throw new IllegalArgumentException(
          "Unsupported entity type: %s".formatted(entityType));
    };
  }

  Optional<Column> findColumnInHierarchy(List<Column> columns, String columnFQN) {
    if (columns == null) {
      return Optional.empty();
    }

    return columns.stream()
        .map(
            column -> {
              if (columnFQN.equals(column.getFullyQualifiedName())) {
                return Optional.of(column);
              }
              return findColumnInHierarchy(column.getChildren(), columnFQN);
            })
        .flatMap(Optional::stream)
        .findFirst();
  }

  private void triggerParentChangeEvent(Object parent, String user) {
    ChangeEvent changeEvent =
        createChangeEventForEntity(user, EventType.ENTITY_UPDATED, (EntityInterface) parent);
    Object entity = changeEvent.getEntity();
    changeEvent = copyChangeEvent(changeEvent);
    changeEvent.setEntity(JsonUtils.pojoToMaskedJson(entity));
    Entity.getCollectionDAO().changeEventDAO().insert(JsonUtils.pojoToJson(changeEvent));
  }

  public List<GroupedColumnsResponse> searchColumns(
      SecurityContext securityContext,
      String columnName,
      String entityTypes,
      String serviceName,
      String databaseName,
      String schemaName,
      String domainId) {

    List<String> entityTypeList = new ArrayList<>();
    if (entityTypes != null && !entityTypes.isEmpty()) {
      entityTypeList = Arrays.asList(entityTypes.split(","));
    } else {
      entityTypeList = Arrays.asList(TABLE, DASHBOARD_DATA_MODEL);
    }

    Map<String, List<ColumnOccurrence>> groupedColumns = new HashMap<>();

    for (String entityType : entityTypeList) {
      if (TABLE.equals(entityType.trim())) {
        searchTablesForColumn(
            groupedColumns, columnName, serviceName, databaseName, schemaName, domainId);
      } else if (DASHBOARD_DATA_MODEL.equals(entityType.trim())) {
        searchDashboardDataModelsForColumn(
            groupedColumns, columnName, serviceName, databaseName, schemaName, domainId);
      }
    }

    List<GroupedColumnsResponse> responses = new ArrayList<>();
    for (Map.Entry<String, List<ColumnOccurrence>> entry : groupedColumns.entrySet()) {
      GroupedColumnsResponse response = new GroupedColumnsResponse();
      response.setColumnName(entry.getKey());
      response.setOccurrences(entry.getValue());
      response.setTotalCount(entry.getValue().size());
      responses.add(response);
    }

    return responses;
  }

  private void searchTablesForColumn(
      Map<String, List<ColumnOccurrence>> groupedColumns,
      String columnName,
      String serviceName,
      String databaseName,
      String schemaName,
      String domainId) {

    TableRepository tableRepository = (TableRepository) Entity.getEntityRepository(TABLE);
    ListFilter filter = new ListFilter(Include.NON_DELETED);

    if (serviceName != null) {
      filter.addQueryParam("service", serviceName);
    }
    if (databaseName != null) {
      filter.addQueryParam("database", databaseName);
    }
    if (schemaName != null) {
      filter.addQueryParam("databaseSchema", schemaName);
    }
    if (domainId != null) {
      filter.addQueryParam("domain", domainId);
    }

    List<Table> tables =
        tableRepository.listAll(
            tableRepository.getFields("columns,tags,service,database,databaseSchema"), filter);

    for (Table table : tables) {
      if (table.getColumns() != null) {
        searchColumnsInHierarchy(table.getColumns(), columnName, TABLE, table, groupedColumns);
      }
    }
  }

  private void searchDashboardDataModelsForColumn(
      Map<String, List<ColumnOccurrence>> groupedColumns,
      String columnName,
      String serviceName,
      String databaseName,
      String schemaName,
      String domainId) {

    DashboardDataModelRepository dataModelRepository =
        (DashboardDataModelRepository) Entity.getEntityRepository(DASHBOARD_DATA_MODEL);
    ListFilter filter = new ListFilter(Include.NON_DELETED);

    if (serviceName != null) {
      filter.addQueryParam("service", serviceName);
    }

    List<DashboardDataModel> dataModels =
        dataModelRepository.listAll(dataModelRepository.getFields("columns,tags,service"), filter);

    for (DashboardDataModel dataModel : dataModels) {
      if (dataModel.getColumns() != null) {
        setDataModelColumnFQN(dataModel.getFullyQualifiedName(), dataModel.getColumns());
        searchColumnsInHierarchy(
            dataModel.getColumns(), columnName, DASHBOARD_DATA_MODEL, dataModel, groupedColumns);
      }
    }
  }

  private void searchColumnsInHierarchy(
      List<Column> columns,
      String columnName,
      String entityType,
      Object parentEntity,
      Map<String, List<ColumnOccurrence>> groupedColumns) {

    if (columns == null) {
      return;
    }

    for (Column column : columns) {
      if (columnName == null || columnName.isEmpty() || column.getName().equals(columnName)) {
        ColumnOccurrence occurrence = createColumnOccurrence(column, entityType, parentEntity);
        groupedColumns.computeIfAbsent(column.getName(), k -> new ArrayList<>()).add(occurrence);
      }

      if (column.getChildren() != null) {
        searchColumnsInHierarchy(
            column.getChildren(), columnName, entityType, parentEntity, groupedColumns);
      }
    }
  }

  private ColumnOccurrence createColumnOccurrence(
      Column column, String entityType, Object parentEntity) {
    ColumnOccurrence occurrence = new ColumnOccurrence();
    occurrence.setColumnFQN(column.getFullyQualifiedName());
    occurrence.setEntityType(entityType);
    occurrence.setDisplayName(column.getDisplayName());
    occurrence.setDescription(column.getDescription());
    occurrence.setTags(column.getTags());
    occurrence.setDataType(column.getDataType() != null ? column.getDataType().toString() : null);

    if (TABLE.equals(entityType)) {
      Table table = (Table) parentEntity;
      occurrence.setEntityFQN(table.getFullyQualifiedName());
      occurrence.setEntityDisplayName(table.getDisplayName());
      occurrence.setServiceName(table.getService() != null ? table.getService().getName() : null);
      occurrence.setDatabaseName(
          table.getDatabase() != null ? table.getDatabase().getName() : null);
      occurrence.setSchemaName(
          table.getDatabaseSchema() != null ? table.getDatabaseSchema().getName() : null);
    } else if (DASHBOARD_DATA_MODEL.equals(entityType)) {
      DashboardDataModel dataModel = (DashboardDataModel) parentEntity;
      occurrence.setEntityFQN(dataModel.getFullyQualifiedName());
      occurrence.setEntityDisplayName(dataModel.getDisplayName());
      occurrence.setServiceName(
          dataModel.getService() != null ? dataModel.getService().getName() : null);
    }

    return occurrence;
  }

  public BulkColumnUpdatePreview previewBulkUpdateColumns(
      UriInfo uriInfo, SecurityContext securityContext, BulkColumnUpdateRequest request) {

    List<ColumnUpdate> columnUpdatesToProcess;

    // Determine which columns to preview based on request mode
    if (request.getColumnName() != null && !request.getColumnName().isEmpty()) {
      columnUpdatesToProcess = buildColumnUpdatesFromSearch(securityContext, request);
    } else if (request.getColumnUpdates() != null && !request.getColumnUpdates().isEmpty()) {
      columnUpdatesToProcess = request.getColumnUpdates();
    } else {
      throw new IllegalArgumentException(
          "Either columnName (for search-based updates) or columnUpdates (for explicit updates) must be provided");
    }

    BulkColumnUpdatePreview preview = new BulkColumnUpdatePreview();
    preview.setTotalColumns(columnUpdatesToProcess.size());

    List<ColumnUpdatePreview> columnPreviews = new ArrayList<>();

    for (ColumnUpdate columnUpdate : columnUpdatesToProcess) {
      try {
        // Fetch current column values by getting the parent entity and finding the column
        Column currentColumn =
            getColumnForPreview(
                securityContext, columnUpdate.getColumnFQN(), columnUpdate.getEntityType());

        if (currentColumn != null) {
          ColumnUpdatePreview previewItem = new ColumnUpdatePreview();
          previewItem.setColumnFQN(columnUpdate.getColumnFQN());
          previewItem.setEntityType(columnUpdate.getEntityType());

          // Get entity details from the column FQN
          String[] fqnParts = columnUpdate.getColumnFQN().split("\\.");
          if (fqnParts.length >= 4) {
            previewItem.setServiceName(fqnParts[0]);
            if (fqnParts.length >= 5) {
              previewItem.setDatabaseName(fqnParts[1]);
            }
            if (fqnParts.length >= 6) {
              previewItem.setSchemaName(fqnParts[2]);
            }
            // Entity FQN is everything except the last part (column name)
            String entityFQN =
                String.join(".", java.util.Arrays.copyOf(fqnParts, fqnParts.length - 1));
            previewItem.setEntityFQN(entityFQN);
          }

          // Set current values
          ColumnMetadata currentValues = new ColumnMetadata();
          currentValues.setDisplayName(currentColumn.getDisplayName());
          currentValues.setDescription(currentColumn.getDescription());
          currentValues.setTags(currentColumn.getTags());
          previewItem.setCurrentValues(currentValues);

          // Set new values
          ColumnMetadata newValues = new ColumnMetadata();
          newValues.setDisplayName(
              columnUpdate.getDisplayName() != null
                  ? columnUpdate.getDisplayName()
                  : currentColumn.getDisplayName());
          newValues.setDescription(
              columnUpdate.getDescription() != null
                  ? columnUpdate.getDescription()
                  : currentColumn.getDescription());
          newValues.setTags(
              columnUpdate.getTags() != null ? columnUpdate.getTags() : currentColumn.getTags());
          previewItem.setNewValues(newValues);

          // Determine if there are actual changes
          boolean hasChanges = false;
          if (columnUpdate.getDisplayName() != null
              && !columnUpdate.getDisplayName().equals(currentColumn.getDisplayName())) {
            hasChanges = true;
          }
          if (columnUpdate.getDescription() != null
              && !columnUpdate.getDescription().equals(currentColumn.getDescription())) {
            hasChanges = true;
          }
          if (columnUpdate.getTags() != null
              && !tagsEqual(columnUpdate.getTags(), currentColumn.getTags())) {
            hasChanges = true;
          }
          previewItem.setHasChanges(hasChanges);

          columnPreviews.add(previewItem);
        }
      } catch (Exception e) {
        LOG.warn("Could not fetch current values for column: {}", columnUpdate.getColumnFQN(), e);
      }
    }

    preview.setColumnPreviews(columnPreviews);
    return preview;
  }

  private Column getColumnForPreview(
      SecurityContext securityContext, String columnFQN, String entityType) {
    try {
      String parentFQN = FullyQualifiedName.getParentEntityFQN(columnFQN, entityType);
      EntityReference parentEntityRef = getParentEntityByFQN(parentFQN, entityType);

      if (TABLE.equals(entityType)) {
        TableRepository tableRepository = (TableRepository) Entity.getEntityRepository(TABLE);
        Table table =
            tableRepository.get(
                null,
                parentEntityRef.getId(),
                tableRepository.getFields("columns,tags"),
                Include.NON_DELETED,
                false);
        ColumnUtil.setColumnFQN(table.getFullyQualifiedName(), table.getColumns());
        return findColumnInHierarchy(table.getColumns(), columnFQN).orElse(null);

      } else if (DASHBOARD_DATA_MODEL.equals(entityType)) {
        DashboardDataModelRepository dataModelRepository =
            (DashboardDataModelRepository) Entity.getEntityRepository(DASHBOARD_DATA_MODEL);
        DashboardDataModel dataModel =
            dataModelRepository.get(
                null,
                parentEntityRef.getId(),
                dataModelRepository.getFields("columns,tags"),
                Include.NON_DELETED,
                false);
        ColumnUtil.setColumnFQN(dataModel.getFullyQualifiedName(), dataModel.getColumns());
        return findColumnInHierarchy(dataModel.getColumns(), columnFQN).orElse(null);
      }
    } catch (Exception e) {
      LOG.warn("Failed to fetch column for preview: {}", columnFQN, e);
    }
    return null;
  }

  private boolean tagsEqual(List<TagLabel> tags1, List<TagLabel> tags2) {
    if (tags1 == null && tags2 == null) return true;
    if (tags1 == null || tags2 == null) return false;
    if (tags1.size() != tags2.size()) return false;

    Set<String> tagFQNs1 = tags1.stream().map(TagLabel::getTagFQN).collect(Collectors.toSet());
    Set<String> tagFQNs2 = tags2.stream().map(TagLabel::getTagFQN).collect(Collectors.toSet());

    return tagFQNs1.equals(tagFQNs2);
  }

  private List<ColumnUpdate> buildColumnUpdatesFromSearch(
      SecurityContext securityContext, BulkColumnUpdateRequest request) {
    // Use searchColumns to find all matching columns
    List<GroupedColumnsResponse> searchResults =
        searchColumns(
            securityContext,
            request.getColumnName(),
            request.getEntityTypes() != null ? String.join(",", request.getEntityTypes()) : null,
            request.getServiceName(),
            request.getDatabaseName(),
            request.getSchemaName(),
            request.getDomainId() != null ? request.getDomainId().toString() : null);

    List<ColumnUpdate> columnUpdates = new ArrayList<>();

    // Convert search results to ColumnUpdate objects
    for (GroupedColumnsResponse group : searchResults) {
      for (ColumnOccurrence occurrence : group.getOccurrences()) {
        ColumnUpdate update = new ColumnUpdate();
        update.setColumnFQN(occurrence.getColumnFQN());
        update.setEntityType(occurrence.getEntityType());
        update.setDisplayName(request.getDisplayName());
        update.setDescription(request.getDescription());
        update.setTags(request.getTags());
        columnUpdates.add(update);
      }
    }

    return columnUpdates;
  }

  public BulkOperationResult bulkUpdateColumns(
      UriInfo uriInfo, SecurityContext securityContext, BulkColumnUpdateRequest request) {
    return bulkUpdateColumns(uriInfo, securityContext, request, null);
  }

  public BulkOperationResult bulkUpdateColumns(
      UriInfo uriInfo,
      SecurityContext securityContext,
      BulkColumnUpdateRequest request,
      BiConsumer<Long, Long> progressCallback) {
    BulkOperationResult result = new BulkOperationResult();
    AtomicLong successCount = new AtomicLong(0);
    AtomicLong failureCount = new AtomicLong(0);
    AtomicLong processedCount = new AtomicLong(0);
    List<BulkResponse> successResponses = new ArrayList<>();
    List<BulkResponse> failureResponses = new ArrayList<>();

    List<ColumnUpdate> columnUpdatesToProcess;

    // Mode 1: Search-based propagation - find all matching columns and apply updates
    if (request.getColumnName() != null && !request.getColumnName().isEmpty()) {
      columnUpdatesToProcess = buildColumnUpdatesFromSearch(securityContext, request);

      // If dry-run, just return the list of columns that would be updated
      if (Boolean.TRUE.equals(request.getDryRun())) {
        result.setNumberOfRowsProcessed(columnUpdatesToProcess.size());
        result.setNumberOfRowsPassed(columnUpdatesToProcess.size());
        result.setNumberOfRowsFailed(0);
        result.setStatus(ApiStatus.SUCCESS);

        // Add all columns to success responses to show what would be updated
        for (ColumnUpdate update : columnUpdatesToProcess) {
          BulkResponse response = new BulkResponse();
          response.setRequest(update);
          response.setMessage(String.format("Would update column: %s", update.getColumnFQN()));
          successResponses.add(response);
        }
        result.setSuccessRequest(successResponses);
        return result;
      }
    }
    // Mode 2: Explicit column updates - use provided list
    else if (request.getColumnUpdates() != null && !request.getColumnUpdates().isEmpty()) {
      columnUpdatesToProcess = request.getColumnUpdates();
    } else {
      throw new IllegalArgumentException(
          "Either columnName (for search-based updates) or columnUpdates (for explicit updates) must be provided");
    }

    final long totalUpdates = columnUpdatesToProcess.size();
    if (progressCallback != null) {
      progressCallback.accept(0L, totalUpdates);
    }

    // Process the updates
    for (ColumnUpdate columnUpdate : columnUpdatesToProcess) {
      try {
        UpdateColumn updateColumn = new UpdateColumn();
        updateColumn.setDisplayName(columnUpdate.getDisplayName());
        updateColumn.setDescription(columnUpdate.getDescription());
        updateColumn.setTags(columnUpdate.getTags());

        Column updatedColumn =
            updateColumnByFQN(
                uriInfo,
                securityContext,
                columnUpdate.getColumnFQN(),
                columnUpdate.getEntityType(),
                updateColumn);

        successCount.incrementAndGet();
        BulkResponse successResponse = new BulkResponse();
        successResponse.setRequest(columnUpdate);
        successResponse.setMessage(
            String.format("Successfully updated column: %s", columnUpdate.getColumnFQN()));
        successResponses.add(successResponse);

      } catch (Exception e) {
        failureCount.incrementAndGet();
        BulkResponse failureResponse = new BulkResponse();
        failureResponse.setRequest(columnUpdate);
        failureResponse.setMessage(
            String.format(
                "Failed to update column %s: %s", columnUpdate.getColumnFQN(), e.getMessage()));
        failureResponses.add(failureResponse);
        LOG.error("Error updating column: {}", columnUpdate.getColumnFQN(), e);
      } finally {
        if (progressCallback != null) {
          progressCallback.accept(processedCount.incrementAndGet(), totalUpdates);
        }
      }
    }

    result.setNumberOfRowsProcessed(columnUpdatesToProcess.size());
    result.setNumberOfRowsPassed((int) successCount.get());
    result.setNumberOfRowsFailed((int) failureCount.get());
    result.setSuccessRequest(successResponses);
    result.setFailedRequest(failureResponses);

    if (failureCount.get() == 0) {
      result.setStatus(ApiStatus.SUCCESS);
    } else if (failureCount.get() == columnUpdatesToProcess.size()) {
      result.setStatus(ApiStatus.FAILURE);
    } else {
      result.setStatus(ApiStatus.PARTIAL_SUCCESS);
    }

    return result;
  }

  public String exportUniqueColumnsCSV(
      SecurityContext securityContext,
      String columnName,
      String entityTypes,
      String serviceName,
      String databaseName,
      String schemaName,
      String domainId) {

    // Search for all matching columns
    List<GroupedColumnsResponse> groupedColumns =
        searchColumns(
            securityContext,
            columnName,
            entityTypes,
            serviceName,
            databaseName,
            schemaName,
            domainId);

    StringBuilder csv = new StringBuilder();
    // CSV Header
    csv.append(
        "column.name*,column.displayName,column.description,column.tags,column.glossaryTerms\n");

    // Export unique column names with their most common metadata
    for (GroupedColumnsResponse group : groupedColumns) {
      if (group.getOccurrences() == null || group.getOccurrences().isEmpty()) {
        continue;
      }

      // Use first occurrence as representative for export
      ColumnOccurrence firstOccurrence = group.getOccurrences().get(0);

      csv.append(quote(group.getColumnName())).append(",");
      csv.append(quote(firstOccurrence.getDisplayName())).append(",");
      csv.append(quote(firstOccurrence.getDescription())).append(",");
      csv.append(quote(formatTags(firstOccurrence.getTags(), true))).append(",");
      csv.append(quote(formatTags(firstOccurrence.getTags(), false))).append("\n");
    }

    return csv.toString();
  }

  public CsvImportResult importColumnsCSV(
      UriInfo uriInfo,
      SecurityContext securityContext,
      String csv,
      boolean dryRun,
      String entityTypes,
      String serviceName,
      String databaseName,
      String schemaName,
      String domainId) {

    CsvImportResult result = new CsvImportResult();
    result.setDryRun(dryRun);
    result.setNumberOfRowsProcessed(0);
    result.setNumberOfRowsPassed(0);
    result.setNumberOfRowsFailed(0);

    String[] lines = csv.split("\n");
    if (lines.length <= 1) {
      result.setStatus(ApiStatus.ABORTED);
      result.setAbortReason("No data to import");
      return result;
    }

    // Skip header row
    for (int i = 1; i < lines.length; i++) {
      String line = lines[i].trim();
      if (line.isEmpty()) {
        continue;
      }

      try {
        result.setNumberOfRowsProcessed(result.getNumberOfRowsProcessed() + 1);

        // Parse CSV row
        String[] fields = parseCsvLine(line);
        if (fields.length < 1) {
          result.setNumberOfRowsFailed(result.getNumberOfRowsFailed() + 1);
          continue;
        }

        String colName = fields[0];
        String displayName = fields.length > 1 ? fields[1] : null;
        String description = fields.length > 2 ? fields[2] : null;
        String tagsStr = fields.length > 3 ? fields[3] : null;
        String glossaryTermsStr = fields.length > 4 ? fields[4] : null;

        // Build bulk update request for this column
        List<TagLabel> tags = parseTags(tagsStr, glossaryTermsStr);

        if (dryRun) {
          // Just validate - find matching columns
          List<GroupedColumnsResponse> matches =
              searchColumns(
                  securityContext,
                  colName,
                  entityTypes,
                  serviceName,
                  databaseName,
                  schemaName,
                  domainId);
          if (matches.isEmpty() || matches.get(0).getOccurrences().isEmpty()) {
            result.setNumberOfRowsFailed(result.getNumberOfRowsFailed() + 1);
          } else {
            result.setNumberOfRowsPassed(result.getNumberOfRowsPassed() + 1);
          }
        } else {
          // Actually apply the update
          BulkColumnUpdateRequest updateRequest =
              new BulkColumnUpdateRequest()
                  .withColumnName(colName)
                  .withDisplayName(displayName)
                  .withDescription(description)
                  .withTags(tags)
                  .withEntityTypes(
                      entityTypes != null ? Arrays.asList(entityTypes.split(",")) : null);

          BulkOperationResult updateResult =
              bulkUpdateColumns(uriInfo, securityContext, updateRequest);

          if (updateResult.getNumberOfRowsPassed() > 0) {
            result.setNumberOfRowsPassed(result.getNumberOfRowsPassed() + 1);
          } else {
            result.setNumberOfRowsFailed(result.getNumberOfRowsFailed() + 1);
          }
        }
      } catch (Exception e) {
        result.setNumberOfRowsFailed(result.getNumberOfRowsFailed() + 1);
        LOG.error("Error processing CSV row {}: {}", i, line, e);
      }
    }

    if (result.getNumberOfRowsFailed() == 0) {
      result.setStatus(ApiStatus.SUCCESS);
    } else if (result.getNumberOfRowsPassed() == 0) {
      result.setStatus(ApiStatus.FAILURE);
    } else {
      result.setStatus(ApiStatus.PARTIAL_SUCCESS);
    }

    return result;
  }

  private String quote(String value) {
    if (value == null || value.isEmpty()) {
      return "";
    }
    // Escape quotes and wrap in quotes if contains comma or newline
    String escaped = value.replace("\"", "\"\"");
    if (escaped.contains(",") || escaped.contains("\n") || escaped.contains("\"")) {
      return "\"" + escaped + "\"";
    }
    return escaped;
  }

  private String formatTags(List<TagLabel> tags, boolean classificationsOnly) {
    if (tags == null || tags.isEmpty()) {
      return "";
    }

    return tags.stream()
        .filter(
            tag -> {
              if (classificationsOnly) {
                return tag.getSource() == TagLabel.TagSource.CLASSIFICATION;
              } else {
                return tag.getSource() == TagLabel.TagSource.GLOSSARY;
              }
            })
        .map(TagLabel::getTagFQN)
        .collect(Collectors.joining(";"));
  }

  private String[] parseCsvLine(String line) {
    List<String> fields = new ArrayList<>();
    StringBuilder currentField = new StringBuilder();
    boolean inQuotes = false;

    for (int i = 0; i < line.length(); i++) {
      char c = line.charAt(i);

      if (c == '"') {
        if (inQuotes && i + 1 < line.length() && line.charAt(i + 1) == '"') {
          // Escaped quote
          currentField.append('"');
          i++;
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (c == ',' && !inQuotes) {
        // End of field
        fields.add(currentField.toString().trim());
        currentField = new StringBuilder();
      } else {
        currentField.append(c);
      }
    }

    // Add last field
    fields.add(currentField.toString().trim());

    return fields.toArray(new String[0]);
  }

  private List<TagLabel> parseTags(String tagsStr, String glossaryTermsStr) {
    List<TagLabel> tags = new ArrayList<>();

    // Parse classification tags
    if (tagsStr != null && !tagsStr.trim().isEmpty()) {
      String[] tagFQNs = tagsStr.split(";");
      for (String tagFQN : tagFQNs) {
        tagFQN = tagFQN.trim();
        if (!tagFQN.isEmpty()) {
          tags.add(new TagLabel().withTagFQN(tagFQN).withSource(TagLabel.TagSource.CLASSIFICATION));
        }
      }
    }

    // Parse glossary terms
    if (glossaryTermsStr != null && !glossaryTermsStr.trim().isEmpty()) {
      String[] termFQNs = glossaryTermsStr.split(";");
      for (String termFQN : termFQNs) {
        termFQN = termFQN.trim();
        if (!termFQN.isEmpty()) {
          tags.add(new TagLabel().withTagFQN(termFQN).withSource(TagLabel.TagSource.GLOSSARY));
        }
      }
    }

    return tags;
  }
}
