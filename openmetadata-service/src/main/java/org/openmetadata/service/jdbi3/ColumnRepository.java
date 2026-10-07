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
import static org.openmetadata.service.Entity.TABLE;
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
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.BiConsumer;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.FieldInterface;
import org.openmetadata.schema.api.data.BulkColumnUpdatePreview;
import org.openmetadata.schema.api.data.BulkColumnUpdateRequest;
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
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.type.api.BulkResponse;
import org.openmetadata.schema.type.change.ChangeSource;
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
import org.openmetadata.service.security.DefaultAuthorizer;
import org.openmetadata.service.security.ViewPermissionFilter;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;
import org.openmetadata.service.util.ChildFieldResolver;
import org.openmetadata.service.util.RestUtil;

@Slf4j
public class ColumnRepository {

  /**
   * The two types whose children are {@code Column} instances. The /search and bulk-preview paths
   * are limited to these: their response types read Column-only accessors and carry database and
   * schema names that mean nothing for a topic field or a pipeline task. GET and PUT by FQN serve
   * every registry type.
   */
  private static final Set<String> COLUMN_SHAPED_TYPES = Set.of(TABLE, DASHBOARD_DATA_MODEL);

  /** Types that tolerate a constraint in the update payload; only table actually applies it. */
  private static final Set<String> CONSTRAINT_TOLERANT_TYPES = Set.of(TABLE, DASHBOARD_DATA_MODEL);

  private final Authorizer authorizer;
  private final ColumnAggregator columnAggregator;

  public ColumnRepository(Authorizer authorizer, SearchClient searchClient) {
    this.authorizer = authorizer;
    if (searchClient instanceof ElasticSearchClient) {
      this.columnAggregator = new ElasticSearchColumnAggregator(searchClient.getHighLevelClient());
    } else if (searchClient instanceof OpenSearchClient) {
      this.columnAggregator = new OpenSearchColumnAggregator(searchClient.getHighLevelClient());
    } else {
      throw new IllegalArgumentException(
          "Unsupported SearchClient type: " + searchClient.getClass().getName());
    }
  }

  public ColumnGridResponse getColumnGridPaginated(
      SecurityContext securityContext, ColumnAggregator.ColumnAggregationRequest request)
      throws IOException {
    // Row-level filters (metadataStatus / hasConflicts / hasMissingMetadata) are applied inside the
    // aggregator over the fully-grouped columns, before pagination, so page counts and per-page
    // size stay correct (#26824). Nothing to post-process here.
    return columnAggregator.aggregateColumns(request);
  }

  public FieldInterface getChildByFQN(
      SecurityContext securityContext,
      String columnFQN,
      String entityType,
      String fieldsParam,
      Include include) {
    Objects.requireNonNull(columnFQN, "columnFQN cannot be null");
    ChildFieldResolver.ChildContainerSpec spec = validateEntityType(entityType);
    String parentFQN = extractParentFQN(columnFQN, entityType);
    EntityInterface parent = fetchAuthorizedParent(securityContext, spec, parentFQN, include);
    ChildFieldResolver.ensureChildFqns(parent, entityType);
    FieldInterface child =
        ChildFieldResolver.locate(parent, entityType, columnFQN)
            .orElseThrow(
                () -> new EntityNotFoundException("Column not found: %s".formatted(columnFQN)));
    return child instanceof Column column
        ? enrichChild(securityContext, spec, parent, column, fieldsParam)
        : child;
  }

  private EntityInterface fetchAuthorizedParent(
      SecurityContext securityContext,
      ChildFieldResolver.ChildContainerSpec spec,
      String parentFQN,
      Include include) {
    String entityType = spec.entityType();
    EntityRepository<? extends EntityInterface> repository = Entity.getEntityRepository(entityType);
    EntityInterface parent =
        repository.getByName(
            null,
            parentFQN,
            repository.getFields(spec.requiredFields() + ",owners"),
            include,
            false);
    authorizer.authorize(
        securityContext,
        new OperationContext(entityType, MetadataOperation.VIEW_BASIC),
        resourceContextFor(entityType, parent, repository));
    return parent;
  }

  @SuppressWarnings({"unchecked", "rawtypes"})
  private ResourceContextInterface resourceContextFor(
      String entityType, EntityInterface entity, EntityRepository<?> repository) {
    return new ResourceContext(entityType, entity, repository);
  }

  /**
   * Per-type response enrichment. This is genuinely type-specific (a table column carries owners,
   * PII masking and profile data; a data-model column carries its extension), not a child-shape
   * concern, so it stays an explicit dispatch rather than moving into the registry.
   */
  private Column enrichChild(
      SecurityContext securityContext,
      ChildFieldResolver.ChildContainerSpec spec,
      EntityInterface parent,
      Column column,
      String fieldsParam) {
    return switch (spec.entityType()) {
      case TABLE -> ((TableRepository) Entity.getEntityRepository(TABLE))
          .enrichSingleColumnFields(
              (Table) parent,
              column,
              fieldsParam,
              ((Table) parent).getOwners(),
              authorizer,
              securityContext);
      case DASHBOARD_DATA_MODEL -> ((DashboardDataModelRepository)
              Entity.getEntityRepository(DASHBOARD_DATA_MODEL))
          .enrichSingleColumnFields((DashboardDataModel) parent, column, fieldsParam);
      default -> column;
    };
  }

  public FieldInterface updateChildByFQN(
      UriInfo uriInfo,
      SecurityContext securityContext,
      String columnFQN,
      String entityType,
      UpdateColumn updateColumn,
      ChangeSource changeSource) {
    Objects.requireNonNull(columnFQN, "columnFQN cannot be null");
    Objects.requireNonNull(updateColumn, "updateColumn cannot be null");

    if (columnFQN.isBlank()) {
      throw new IllegalArgumentException("columnFQN cannot be blank");
    }

    // Validate entity type first before any other processing
    ChildFieldResolver.ChildContainerSpec spec = validateEntityType(entityType);
    validateUpdateForType(spec, updateColumn);
    return updateChildByFQN(uriInfo, securityContext, columnFQN, spec, updateColumn, changeSource);
  }

  /**
   * The registry is the gate. Its message already carries the "Unsupported entity type" prefix that
   * ColumnResourceIT.test_updateColumn_entityType_validation pins.
   */
  private ChildFieldResolver.ChildContainerSpec validateEntityType(String entityType) {
    return ChildFieldResolver.specFor(entityType);
  }

  /**
   * Rejects payload fields the target type has nowhere to put, rather than accepting them and
   * silently dropping the value. dashboardDataModel is the one exception: it has always accepted
   * and ignored a constraint, and that stays as it is so existing clients do not start failing.
   */
  private void validateUpdateForType(
      ChildFieldResolver.ChildContainerSpec spec, UpdateColumn updateColumn) {
    boolean constraintRequested =
        updateColumn.getConstraint() != null
            || Boolean.TRUE.equals(updateColumn.getRemoveConstraint());
    if (constraintRequested && !CONSTRAINT_TOLERANT_TYPES.contains(spec.entityType())) {
      throw new IllegalArgumentException(
          "Column constraints are not supported for entity type " + spec.entityType());
    }
    if (updateColumn.getExtension() != null && spec.childExtensionType() == null) {
      throw new IllegalArgumentException(
          "Column extension is not supported for entity type " + spec.entityType());
    }
  }

  private String extractParentFQN(String columnFQN, String entityType) {
    try {
      return ChildFieldResolver.parentFqnOf(columnFQN, entityType);
    } catch (Exception e) {
      throw new IllegalArgumentException(
          "Invalid column FQN format: %s. Error: %s".formatted(columnFQN, e.getMessage()), e);
    }
  }

  private FieldInterface updateChildByFQN(
      UriInfo uriInfo,
      SecurityContext securityContext,
      String columnFQN,
      ChildFieldResolver.ChildContainerSpec spec,
      UpdateColumn updateColumn,
      ChangeSource changeSource) {
    String entityType = spec.entityType();
    String parentFQN = extractParentFQN(columnFQN, entityType);
    EntityReference parentEntityRef = getParentEntityByFQN(parentFQN, entityType);
    String user = securityContext.getUserPrincipal().getName();
    EntityRepository<? extends EntityInterface> repository = Entity.getEntityRepository(entityType);

    EntityInterface original =
        repository.get(
            null,
            parentEntityRef.getId(),
            repository.getFields(spec.requiredFields()),
            Include.NON_DELETED,
            false);
    EntityInterface updated = deepCopy(original);
    ChildFieldResolver.ensureChildFqns(updated, entityType);

    FieldInterface child =
        ChildFieldResolver.locate(updated, entityType, columnFQN)
            .orElseThrow(
                () -> new EntityNotFoundException("Column not found: %s".formatted(columnFQN)));
    applyChildUpdates(child, updateColumn, spec);

    JsonPatch jsonPatch = JsonUtils.getJsonPatch(original, updated);
    authorizeAndPatch(securityContext, entityType, parentEntityRef, jsonPatch);
    // A null changeSource makes this identical to the 4-argument overload the two per-type write
    // paths called before consolidation (EntityRepository delegates both to the same method with
    // changeSource null), so an unattributed write stays byte-identical on the wire.
    RestUtil.PatchResponse<? extends EntityInterface> patchResponse =
        repository.patch(uriInfo, parentEntityRef.getId(), user, jsonPatch, changeSource);
    triggerParentChangeEvent(patchResponse.entity(), user);

    return child;
  }

  @SuppressWarnings("unchecked")
  private EntityInterface deepCopy(EntityInterface original) {
    return JsonUtils.deepCopy(original, (Class<EntityInterface>) original.getClass());
  }

  private void applyChildUpdates(
      FieldInterface child, UpdateColumn updateColumn, ChildFieldResolver.ChildContainerSpec spec) {
    Optional.ofNullable(updateColumn.getDisplayName())
        .ifPresent(name -> child.setDisplayName(name.trim().isEmpty() ? null : name));

    Optional.ofNullable(updateColumn.getDescription())
        .ifPresent(desc -> child.setDescription(desc.trim().isEmpty() ? null : desc));

    Optional.ofNullable(updateColumn.getTags())
        .ifPresent(tags -> child.setTags(addDerivedTags(tags)));

    if (child instanceof Column column) {
      applyColumnOnlyUpdates(column, updateColumn, spec);
    }
  }

  private void applyColumnOnlyUpdates(
      Column column, UpdateColumn updateColumn, ChildFieldResolver.ChildContainerSpec spec) {
    if (TABLE.equals(spec.entityType())) {
      applyConstraintUpdate(column, updateColumn);
    }
    if (spec.childExtensionType() != null) {
      Optional.ofNullable(updateColumn.getExtension())
          .ifPresent(
              ext ->
                  column.setExtension(
                      EntityRepository.validateAndTransformExtension(
                          ext, spec.childExtensionType())));
    }
  }

  private void applyConstraintUpdate(Column column, UpdateColumn updateColumn) {
    if (Boolean.TRUE.equals(updateColumn.getRemoveConstraint())) {
      column.setConstraint(null);
    } else {
      Optional.ofNullable(updateColumn.getConstraint()).ifPresent(column::setConstraint);
    }
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

  private EntityReference getParentEntityByFQN(String parentFQN, String entityType) {
    EntityRepository<? extends EntityInterface> repository = Entity.getEntityRepository(entityType);
    return repository.findByName(parentFQN, Include.NON_DELETED).getEntityReference();
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
      String trimmed = entityType.trim();
      if (COLUMN_SHAPED_TYPES.contains(trimmed)) {
        searchEntitiesForColumn(
            securityContext,
            groupedColumns,
            columnName,
            trimmed,
            serviceName,
            databaseName,
            schemaName,
            domainId);
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

  private void searchEntitiesForColumn(
      SecurityContext securityContext,
      Map<String, List<ColumnOccurrence>> groupedColumns,
      String columnName,
      String entityType,
      String serviceName,
      String databaseName,
      String schemaName,
      String domainId) {

    EntityRepository<? extends EntityInterface> repository = Entity.getEntityRepository(entityType);
    ListFilter filter =
        buildSearchFilter(entityType, serviceName, databaseName, schemaName, domainId);

    List<? extends EntityInterface> parents =
        viewableParents(
            securityContext,
            repository.listAll(repository.getFields(searchFieldsFor(entityType)), filter));

    for (EntityInterface parent : parents) {
      ChildFieldResolver.ensureChildFqns(parent, entityType);
      searchColumnsInHierarchy(columnsOf(parent), columnName, entityType, parent, groupedColumns);
    }
  }

  /**
   * Column search walks every table and data model, so it keeps only the parents the caller may
   * view; otherwise their column names, descriptions and tags would be readable here. An admin
   * sees every parent.
   */
  private List<? extends EntityInterface> viewableParents(
      SecurityContext securityContext, List<? extends EntityInterface> parents) {
    if (securityContext == null || DefaultAuthorizer.getSubjectContext(securityContext).isAdmin()) {
      return parents;
    }
    Set<UUID> viewable =
        new ViewPermissionFilter(authorizer)
            .viewableIds(
                securityContext,
                parents.stream().map(EntityInterface::getEntityReference).toList());
    return parents.stream().filter(parent -> viewable.contains(parent.getId())).toList();
  }

  /**
   * Only the service filter applies to every type. The database, schema and domain filters are
   * table-only because a dashboardDataModel FQN has no database or schema level, and ListFilter
   * would turn either into an FQN-prefix condition that matches nothing.
   */
  private ListFilter buildSearchFilter(
      String entityType,
      String serviceName,
      String databaseName,
      String schemaName,
      String domainId) {
    ListFilter filter = new ListFilter(Include.NON_DELETED);
    if (serviceName != null) {
      filter.addQueryParam("service", serviceName);
    }
    if (TABLE.equals(entityType)) {
      addIfPresent(filter, "database", databaseName);
      addIfPresent(filter, "databaseSchema", schemaName);
      addIfPresent(filter, "domain", domainId);
    }
    return filter;
  }

  private void addIfPresent(ListFilter filter, String param, String value) {
    if (value != null) {
      filter.addQueryParam(param, value);
    }
  }

  /** The relations each type's ColumnOccurrence reads back; see createColumnOccurrence. */
  private String searchFieldsFor(String entityType) {
    return TABLE.equals(entityType)
        ? "columns,tags,service,database,databaseSchema"
        : "columns,tags,service";
  }

  /**
   * The live child list of a Column-shaped parent. Safe for the two types this endpoint serves:
   * both declare "columns" as their container path, so the registry returns the entity's own list
   * and searchColumnsInHierarchy's null guard still covers a parent that has none.
   */
  @SuppressWarnings("unchecked")
  private List<Column> columnsOf(EntityInterface parent) {
    return (List<Column>) ChildFieldResolver.containerListFor(parent, "columns");
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
          boolean hasChanges =
              columnUpdate.getDisplayName() != null
                  && !columnUpdate.getDisplayName().equals(currentColumn.getDisplayName());
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
    Column result = null;
    try {
      if (COLUMN_SHAPED_TYPES.contains(entityType)) {
        result = (Column) loadChildForPreview(securityContext, columnFQN, entityType).orElse(null);
      }
    } catch (Exception e) {
      LOG.warn("Failed to fetch column for preview: {}", columnFQN, e);
    }
    return result;
  }

  /**
   * Preview echoes a column's current description and tags, so each one needs the same view of its
   * parent that reading the column directly does. A denied or failed read is reported as an
   * un-previewable column rather than raised.
   */
  private Optional<FieldInterface> loadChildForPreview(
      SecurityContext securityContext, String columnFQN, String entityType) {
    String parentFQN = ChildFieldResolver.parentFqnOf(columnFQN, entityType);
    EntityInterface parent =
        fetchAuthorizedParent(
            securityContext, validateEntityType(entityType), parentFQN, Include.NON_DELETED);
    ChildFieldResolver.ensureChildFqns(parent, entityType);
    return ChildFieldResolver.locate(parent, entityType, columnFQN);
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

        // The type-generic write: a row here may name any registry type, and the Column-typed
        // overload would throw casting the result after the patch had already been saved,
        // reporting a committed change as a failure.
        updateChildByFQN(
            uriInfo,
            securityContext,
            columnUpdate.getColumnFQN(),
            columnUpdate.getEntityType(),
            updateColumn,
            null);

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
