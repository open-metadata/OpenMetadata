package org.openmetadata.service.jdbi3;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.schema.type.Include.NON_DELETED;
import static org.openmetadata.service.Entity.CONTAINER;
import static org.openmetadata.service.Entity.DASHBOARD_DATA_MODEL;
import static org.openmetadata.service.Entity.FIELD_PARENT;
import static org.openmetadata.service.Entity.FIELD_TAGS;
import static org.openmetadata.service.Entity.STORAGE_SERVICE;
import static org.openmetadata.service.Entity.getEntityReferenceById;
import static org.openmetadata.service.resources.tags.TagLabelUtil.addDerivedTagsGracefully;
import static org.openmetadata.service.resources.tags.TagLabelUtil.addDerivedTagsWithPreFetched;
import static org.openmetadata.service.resources.tags.TagLabelUtil.batchFetchDerivedTags;
import static org.openmetadata.service.util.EntityUtil.getFlattenedEntityField;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.feed.ResolveTask;
import org.openmetadata.schema.entity.data.Container;
import org.openmetadata.schema.entity.data.DashboardDataModel;
import org.openmetadata.schema.entity.services.StorageService;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ContainerFileFormat;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TableData;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TaskType;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.FeedRepository.TaskWorkflow;
import org.openmetadata.service.jdbi3.FeedRepository.ThreadContext;
import org.openmetadata.service.monitoring.RequestLatencyContext;
import org.openmetadata.service.resources.feeds.MessageParser.EntityLink;
import org.openmetadata.service.resources.storages.ContainerResource;
import org.openmetadata.service.security.mask.PIIMasker;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.FullyQualifiedName;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class ContainerRepository extends EntityRepository<Container> {
  private static final Logger LOG = LoggerFactory.getLogger(ContainerRepository.class);
  private static final String CONTAINER_UPDATE_FIELDS = "dataModel";
  private static final String CONTAINER_PATCH_FIELDS = "dataModel";
  private static final Set<String> CHANGE_SUMMARY_FIELDS = Set.of("dataModel.columns.description");
  public static final String CONTAINER_SAMPLE_DATA_EXTENSION = "container.sampleData";

  public ContainerRepository() {
    super(
        ContainerResource.COLLECTION_PATH,
        Entity.CONTAINER,
        Container.class,
        Entity.getCollectionDAO().containerDAO(),
        CONTAINER_PATCH_FIELDS,
        CONTAINER_UPDATE_FIELDS,
        CHANGE_SUMMARY_FIELDS);
    supportsSearch = true;

    // children is unbounded — for a 5,000-file Tahoe-style container, fields=children
    // (or fields=* expanding to it) loads every reference with no pagination. Remove it
    // from the entity's allowed-fields set so that fields=* silently skips it and
    // fields=children returns 400. Callers that need to traverse children must use the
    // paginated /v1/containers/name/{fqn}/children endpoint.
    allowedFields.remove("children");

    // Register bulk field fetchers for efficient database operations
    fieldFetchers.put(FIELD_PARENT, this::fetchAndSetParents);
    fieldFetchers.put(FIELD_TAGS, this::fetchAndSetDataModelColumnTags);
  }

  @Override
  public void setFields(
      Container container, EntityUtil.Fields fields, RelationIncludes relationIncludes) {
    setDefaultFields(container);
    container.setParent(
        fields.contains(FIELD_PARENT) ? getContainerParent(container) : container.getParent());
    if (container.getDataModel() != null) {
      populateDataModelColumnTags(
          fields.contains(FIELD_TAGS), container.getDataModel().getColumns());
    }
  }

  @Override
  public void setFieldsInBulk(EntityUtil.Fields fields, List<Container> entities) {
    // Always set default service field for all containers
    fetchAndSetDefaultService(entities);

    fetchAndSetFields(entities, fields);
    setInheritedFields(entities, fields);
    for (Container entity : entities) {
      clearFieldsInternal(entity, fields);
    }
  }

  // Individual field fetchers registered in constructor
  private void fetchAndSetParents(List<Container> containers, EntityUtil.Fields fields) {
    if (!fields.contains(FIELD_PARENT) || containers == null || containers.isEmpty()) {
      return;
    }
    setFieldFromMap(true, containers, batchFetchParents(containers), Container::setParent);
  }

  private void fetchAndSetDataModelColumnTags(
      List<Container> containers, EntityUtil.Fields fields) {
    if (!fields.contains(FIELD_TAGS) || containers == null || containers.isEmpty()) {
      return;
    }

    // Container-level tags. Important for search indexing where we may process 100k+
    // containers in a single bulk batch — we must not issue a derived-tag DB query per
    // container, so collect all tags up front and batch derived tags once.
    List<String> entityFQNs = containers.stream().map(Container::getFullyQualifiedName).toList();
    Map<String, List<TagLabel>> tagsMap = batchFetchTags(entityFQNs);

    Map<String, List<TagLabel>> derivedTagsMap;
    try {
      List<TagLabel> allContainerTags =
          tagsMap.values().stream()
              .filter(tags -> tags != null)
              .flatMap(List::stream)
              .collect(Collectors.toList());
      derivedTagsMap = batchFetchDerivedTags(allContainerTags);
    } catch (Exception ex) {
      LOG.warn(
          "Failed to batch fetch derived tags for {} containers. Falling back to per-container: {}",
          containers.size(),
          ex.getMessage());
      derivedTagsMap = null;
    }

    for (Container container : containers) {
      List<TagLabel> containerTags =
          tagsMap.getOrDefault(container.getFullyQualifiedName(), Collections.emptyList());
      if (derivedTagsMap != null) {
        container.setTags(addDerivedTagsWithPreFetched(containerTags, derivedTagsMap));
      } else {
        container.setTags(addDerivedTagsGracefully(containerTags));
      }
    }

    // Then, if dataModel field is requested, also fetch data model column tags
    if (fields.contains("dataModel")) {
      // Filter containers that have data models and use bulk tag fetching
      List<Container> containersWithDataModels =
          containers.stream().filter(c -> c.getDataModel() != null).collect(Collectors.toList());

      if (!containersWithDataModels.isEmpty()) {
        bulkPopulateEntityFieldTags(containersWithDataModels, c -> c.getDataModel().getColumns());
      }
    }
  }

  private Map<UUID, EntityReference> batchFetchParents(List<Container> containers) {
    Map<UUID, EntityReference> parentsMap = new HashMap<>();
    if (containers == null || containers.isEmpty()) {
      return parentsMap;
    }

    List<CollectionDAO.EntityRelationshipObject> records =
        daoCollection
            .relationshipDAO()
            .findFromBatch(entityListToStrings(containers), Relationship.CONTAINS.ordinal());

    for (CollectionDAO.EntityRelationshipObject record : records) {
      UUID containerId = UUID.fromString(record.getToId());
      // Only consider container parents, not service parents
      if (CONTAINER.equals(record.getFromEntity())) {
        EntityReference parentRef =
            getEntityReferenceById(
                record.getFromEntity(), UUID.fromString(record.getFromId()), NON_DELETED);
        parentsMap.put(containerId, parentRef);
      }
    }

    return parentsMap;
  }

  @Override
  protected void fetchAndSetChildren(List<Container> containers, EntityUtil.Fields fields) {
    if (!fields.contains("children") || containers == null || containers.isEmpty()) {
      return;
    }
    setFieldFromMap(true, containers, batchFetchChildren(containers), Container::setChildren);
  }

  private Map<UUID, List<EntityReference>> batchFetchChildren(List<Container> containers) {
    Map<UUID, List<EntityReference>> childrenMap = new HashMap<>();
    if (containers == null || containers.isEmpty()) {
      return childrenMap;
    }

    // Initialize empty lists for all containers
    for (Container container : containers) {
      childrenMap.put(container.getId(), new ArrayList<>());
    }

    // Single batch query to get all children for all containers
    List<CollectionDAO.EntityRelationshipObject> records =
        daoCollection
            .relationshipDAO()
            .findToBatch(
                entityListToStrings(containers), Relationship.CONTAINS.ordinal(), CONTAINER);

    // Group children by parent container ID
    for (CollectionDAO.EntityRelationshipObject record : records) {
      UUID parentId = UUID.fromString(record.getFromId());
      EntityReference childRef =
          getEntityReferenceById(CONTAINER, UUID.fromString(record.getToId()), NON_DELETED);
      childrenMap.get(parentId).add(childRef);
    }

    return childrenMap;
  }

  private void fetchAndSetDefaultService(List<Container> containers) {
    if (containers == null || containers.isEmpty()) {
      return;
    }

    // Batch fetch service references for all containers
    Map<UUID, EntityReference> serviceMap = batchFetchServices(containers);

    // Set service for all containers
    for (Container container : containers) {
      container.setService(serviceMap.get(container.getId()));
    }
  }

  private Map<UUID, EntityReference> batchFetchServices(List<Container> containers) {
    Map<UUID, EntityReference> serviceMap = new HashMap<>();
    if (containers == null || containers.isEmpty()) {
      return serviceMap;
    }

    // Single batch query to get all services for all containers
    List<CollectionDAO.EntityRelationshipObject> records =
        daoCollection
            .relationshipDAO()
            .findFromBatch(entityListToStrings(containers), Relationship.CONTAINS.ordinal());

    // De-dupe service IDs before resolving them to references. In any practical paged
    // listing the children are all under the same storage service, so the naive loop
    // below would call getEntityReferenceById N times for the same service id —
    // each call hits CACHE_WITH_ID (or DB) for the full StorageService JSON. Cache one
    // ref per unique service id and fan it back out to every child.
    Map<UUID, EntityReference> serviceRefById = new HashMap<>();
    for (CollectionDAO.EntityRelationshipObject record : records) {
      if (!STORAGE_SERVICE.equals(record.getFromEntity())) {
        continue;
      }
      UUID containerId = UUID.fromString(record.getToId());
      UUID serviceId = UUID.fromString(record.getFromId());
      EntityReference serviceRef =
          serviceRefById.computeIfAbsent(
              serviceId, id -> getEntityReferenceById(STORAGE_SERVICE, id, NON_DELETED));
      serviceMap.put(containerId, serviceRef);
    }

    return serviceMap;
  }

  @Override
  public void clearFields(Container container, EntityUtil.Fields fields) {
    container.setParent(fields.contains(FIELD_PARENT) ? container.getParent() : null);
    container.withDataModel(fields.contains("dataModel") ? container.getDataModel() : null);
  }

  private void populateDataModelColumnTags(boolean setTags, List<Column> columns) {
    List<Column> flattenedColumns = getFlattenedEntityField(columns);
    if (!setTags) {
      flattenedColumns.forEach(c -> c.setTags(c.getTags()));
      return;
    }
    if (flattenedColumns.isEmpty()) {
      return;
    }
    Map<String, Column> hashToColumn =
        flattenedColumns.stream()
            .collect(
                Collectors.toMap(
                    c -> FullyQualifiedName.buildHash(c.getFullyQualifiedName()),
                    c -> c,
                    (a, b) -> a,
                    LinkedHashMap::new));
    Map<String, List<TagLabel>> tagsByHash =
        daoCollection
            .tagUsageDAO()
            .getTagsByTargetFQNHashes(new ArrayList<>(hashToColumn.keySet()));

    // Batch-fetch derived tags for every glossary tag across all columns in a single query.
    // Falls back to per-column gracefully on failure to avoid changing existing semantics.
    Map<String, List<TagLabel>> derivedTagsMap;
    try {
      List<TagLabel> allTags =
          tagsByHash.values().stream()
              .filter(tags -> tags != null)
              .flatMap(List::stream)
              .collect(Collectors.toList());
      derivedTagsMap = batchFetchDerivedTags(allTags);
    } catch (Exception ex) {
      LOG.warn(
          "Failed to batch fetch derived tags for container columns. Falling back to per-column: {}",
          ex.getMessage());
      derivedTagsMap = null;
    }

    for (Map.Entry<String, Column> entry : hashToColumn.entrySet()) {
      List<TagLabel> columnTags = tagsByHash.get(entry.getKey());
      if (columnTags == null) {
        entry.getValue().setTags(new ArrayList<>());
      } else if (derivedTagsMap != null) {
        entry.getValue().setTags(addDerivedTagsWithPreFetched(columnTags, derivedTagsMap));
      } else {
        entry.getValue().setTags(addDerivedTagsGracefully(columnTags));
      }
    }
  }

  private void setDefaultFields(Container container) {
    EntityReference parentServiceRef =
        getFromEntityRef(container.getId(), Relationship.CONTAINS, STORAGE_SERVICE, true);
    container.withService(parentServiceRef);
  }

  private EntityReference getContainerParent(Container container) {
    return getFromEntityRef(container.getId(), Relationship.CONTAINS, CONTAINER, false);
  }

  protected List<EntityReference> getChildren(Container container) {
    return findTo(container.getId(), CONTAINER, Relationship.CONTAINS, CONTAINER);
  }

  @Override
  public void setFullyQualifiedName(Container container) {
    container.setParent(
        container.getParent() != null ? container.getParent() : getContainerParent(container));
    if (container.getParent() != null) {
      container.setFullyQualifiedName(
          FullyQualifiedName.add(
              container.getParent().getFullyQualifiedName(), container.getName()));
    } else {
      container.setFullyQualifiedName(
          FullyQualifiedName.add(
              container.getService().getFullyQualifiedName(), container.getName()));
    }
    if (container.getDataModel() != null) {
      setColumnFQN(container.getFullyQualifiedName(), container.getDataModel().getColumns());
    }
  }

  private void setColumnFQN(String parentFQN, List<Column> columns) {
    columns.forEach(
        c -> {
          String columnFqn = FullyQualifiedName.add(parentFQN, c.getName());
          c.setFullyQualifiedName(columnFqn);
          if (c.getChildren() != null) {
            setColumnFQN(columnFqn, c.getChildren());
          }
        });
  }

  @Override
  public void prepare(Container container, boolean update) {
    // the storage service is not fully filled in terms of props - go to the db and get it in full
    // and re-set it
    var storageService =
        (StorageService) getCachedParentOrLoad(container.getService(), "", Include.NON_DELETED);
    container.setService(storageService.getEntityReference());
    container.setServiceType(storageService.getServiceType());

    if (container.getParent() != null) {
      Container parent = Entity.getEntity(container.getParent(), "owners", ALL);
      container.withParent(parent.getEntityReference());
    }
  }

  @Override
  protected List<String> getFieldsStrippedFromStorageJson() {
    return List.of("service", "parent");
  }

  @Override
  protected ObjectNode storageJsonNode(Container container) {
    ObjectNode node = super.storageJsonNode(container);
    stripColumnTags(node.at("/dataModel/columns"));
    return node;
  }

  private void stripColumnTags(JsonNode columnsNode) {
    if (!(columnsNode instanceof ArrayNode columnArray)) {
      return;
    }
    for (JsonNode column : columnArray) {
      if (!(column instanceof ObjectNode columnNode)) {
        continue;
      }
      columnNode.remove("tags");
      stripColumnTags(columnNode.get("children"));
    }
  }

  @Override
  public void storeEntity(Container container, boolean update) {
    store(container, update);
  }

  @Override
  public void storeEntities(List<Container> containers) {
    storeMany(containers);
  }

  @Override
  public void restorePatchAttributes(Container original, Container updated) {
    // Patch can't make changes to following fields. Ignore the changes
    super.restorePatchAttributes(original, updated);
    updated.withService(original.getService()).withParent(original.getParent());
  }

  @Override
  protected void clearEntitySpecificRelationshipsForMany(List<Container> entities) {
    if (entities.isEmpty()) return;
    List<UUID> ids = entities.stream().map(Container::getId).toList();
    deleteToMany(ids, entityType, Relationship.CONTAINS, null);
  }

  @Override
  public void storeRelationships(Container container) {
    // store each relationship separately in the entity_relationship table
    addServiceRelationship(container, container.getService());

    // parent container if exists
    EntityReference parentReference = container.getParent();
    if (parentReference != null) {
      addRelationship(
          parentReference.getId(), container.getId(), CONTAINER, CONTAINER, Relationship.CONTAINS);
    }
  }

  @Override
  protected void storeEntitySpecificRelationshipsForMany(List<Container> entities) {
    List<CollectionDAO.EntityRelationshipObject> relationships = new ArrayList<>();
    for (Container container : entities) {
      EntityReference service = container.getService();
      if (service != null && service.getId() != null) {
        relationships.add(
            newRelationship(
                service.getId(),
                container.getId(),
                service.getType(),
                entityType,
                Relationship.CONTAINS));
      }
      EntityReference parent = container.getParent();
      if (parent != null && parent.getId() != null) {
        relationships.add(
            newRelationship(
                parent.getId(), container.getId(), CONTAINER, CONTAINER, Relationship.CONTAINS));
      }
    }
    bulkInsertRelationships(relationships);
  }

  @Override
  public EntityRepository<Container>.EntityUpdater getUpdater(
      Container original, Container updated, Operation operation, ChangeSource changeSource) {
    return new ContainerUpdater(original, updated, operation);
  }

  @Override
  public void applyTags(Container container) {
    // Add container level tags by adding tag to container relationship
    super.applyTags(container);
    if (container.getDataModel() != null) {
      applyColumnTags(container.getDataModel().getColumns());
    }
  }

  @Override
  public void validateTags(Container container) {
    super.validateTags(container);
    if (container.getDataModel() != null) {
      validateColumnTags(container.getDataModel().getColumns());
    }
  }

  @Override
  protected EntityReference getParentReference(Container entity) {
    return entity.getService();
  }

  @Override
  public EntityInterface getParentEntity(Container entity, String fields) {
    if (entity.getService() == null) {
      return null;
    }
    return Entity.getEntity(entity.getService(), fields, Include.ALL);
  }

  @Override
  public List<TagLabel> getAllTags(EntityInterface entity) {
    List<TagLabel> allTags = new ArrayList<>();
    Container container = (Container) entity;
    EntityUtil.mergeTags(allTags, container.getTags());
    if (container.getDataModel() != null) {
      for (Column column : listOrEmpty(container.getDataModel().getColumns())) {
        EntityUtil.mergeTags(allTags, column.getTags());
      }
    }
    return allTags;
  }

  @Override
  public TaskWorkflow getTaskWorkflow(ThreadContext threadContext) {
    validateTaskThread(threadContext);
    EntityLink entityLink = threadContext.getAbout();
    if (entityLink.getFieldName() != null && entityLink.getFieldName().equals("dataModel")) {
      TaskType taskType = threadContext.getThread().getTask().getType();
      if (EntityUtil.isDescriptionTask(taskType)) {
        return new DataModelDescriptionTaskWorkflow(threadContext);
      } else if (EntityUtil.isTagTask(taskType)) {
        return new DataModelTagTaskWorkflow(threadContext);
      } else {
        throw new IllegalArgumentException(String.format("Invalid task type %s", taskType));
      }
    }
    return super.getTaskWorkflow(threadContext);
  }

  public ResultList<Container> listChildren(String parentFQN, Integer limit, Integer offset) {

    // Phase markers feed the slow-request log so when a /children call exceeds the
    // latency budget in prod we can tell which step (parent lookup / relationship
    // fetch / count / slim hydration / service restore) was responsible.
    Container parentContainer;
    try (var ignored = RequestLatencyContext.phase("listChildrenParent")) {
      parentContainer = dao.findEntityByName(parentFQN);
    }

    try {
      List<CollectionDAO.EntityRelationshipRecord> relationshipRecords;
      try (var ignored = RequestLatencyContext.phase("listChildrenRelationships")) {
        relationshipRecords =
            daoCollection
                .relationshipDAO()
                .findToWithOffset(
                    parentContainer.getId(),
                    CONTAINER,
                    List.of(Relationship.CONTAINS.ordinal()),
                    offset,
                    limit);
      }

      int total;
      try (var ignored = RequestLatencyContext.phase("listChildrenCount")) {
        total =
            daoCollection
                .relationshipDAO()
                .countFindTo(
                    parentContainer.getId(), CONTAINER, List.of(Relationship.CONTAINS.ordinal()));
      }

      if (relationshipRecords.isEmpty()) {
        return new ResultList<>(new ArrayList<>(), null, null, total);
      }

      // Hydrate the page with a slim projection: id, name, fqn, displayName, description.
      // Heavy fields like dataModel, tags, owners, extension are intentionally skipped —
      // the UI's children table only renders name and description, and parquet
      // containers can carry multi-MB column schemas in dataModel.
      //
      // The IDs come straight from the relationship rows we already loaded in
      // findToWithOffset — we deliberately do NOT call EntityUtil.getEntityReferences
      // here because that path round-trips through Entity.getEntityReferencesByIds →
      // EntityRepository.find → CACHE_WITH_ID, which materialises the FULL Container
      // JSON (dataModel, tags, owners, extension) for every child just to extract its
      // EntityReference. For 15 parquet rows that single call alone can dominate the
      // listing latency.
      List<UUID> ids = relationshipRecords.stream().map(r -> r.getId()).toList();
      Map<UUID, Container> byId = new HashMap<>();
      try (var ignored = RequestLatencyContext.phase("listChildrenHydrate")) {
        for (Container c : ((CollectionDAO.ContainerDAO) dao).findContainerSummariesByIds(ids)) {
          byId.put(c.getId(), c);
        }
      }
      // Preserve relationship-offset ordering returned by findToWithOffset; drop
      // any rows that no longer resolve (deleted between the relationship lookup and
      // the bulk fetch) rather than failing the whole page.
      List<Container> children = new ArrayList<>(ids.size());
      for (UUID id : ids) {
        Container container = byId.get(id);
        if (container != null) {
          children.add(container);
        }
      }
      // service is stripped from stored JSON; restore via batched relationship lookup.
      try (var ignored = RequestLatencyContext.phase("listChildrenService")) {
        fetchAndSetDefaultService(children);
      }

      return new ResultList<>(children, null, null, total);
    } catch (Exception e) {
      throw new RuntimeException(
          String.format(
              "Failed to fetch children for container [%s]: %s", parentFQN, e.getMessage()),
          e);
    }
  }

  /**
   * Return the parent chain for the given container, ordered from root container (immediate
   * child of the storage service) down to the immediate parent. Empty when the container is at
   * the top level. Resolves the entire chain in a single batched DB lookup so the UI does not
   * need to issue one parent fetch per breadcrumb level.
   */
  public List<EntityReference> getAncestors(String fqn) {
    String[] parts = FullyQualifiedName.split(fqn);
    // parts[0] is the storage service; parts[parts.length - 1] is the container itself.
    // Ancestors live at indices 1 .. parts.length - 2.
    if (parts.length < 3) {
      return Collections.emptyList();
    }

    // FullyQualifiedName.split preserves each segment as it appears in the source
    // FQN (quoted segments stay quoted, unquoted stay unquoted). We still round-trip
    // every segment through FullyQualifiedName.add — its quoteName step is idempotent,
    // and it reapplies quotes to any unquoted segment that needs them so the
    // reconstructed prefix matches the canonical FQN stored in the DB. Naively
    // concatenating raw parts with '.' would skip that re-quoting step and break the
    // IN-by-fqnHash lookup for any container whose name (or ancestor's name) contains
    // an FQN-separator character.
    List<String> ancestorFqns = new ArrayList<>(parts.length - 2);
    String current = FullyQualifiedName.quoteName(parts[0]);
    for (int i = 1; i < parts.length - 1; i++) {
      current = FullyQualifiedName.add(current, parts[i]);
      ancestorFqns.add(current);
    }

    // Projection-only batched IN query: pulls just the columns needed to build
    // an EntityReference (id, name, displayName, fqn, deleted) instead of the
    // full Container JSON. For a 10-level chain this avoids deserializing
    // ~10 × 5–50 KB of unused container payload per breadcrumb request.
    List<EntityReference> ancestors = dao.findReferencesByFqns(ancestorFqns, NON_DELETED);

    // Preserve the root → immediate-parent ordering even if the DAO returns rows out of order.
    Map<String, EntityReference> byFqn = new HashMap<>();
    for (EntityReference ancestor : ancestors) {
      byFqn.put(ancestor.getFullyQualifiedName(), ancestor);
    }
    List<EntityReference> ordered = new ArrayList<>(ancestorFqns.size());
    for (String ancestorFqn : ancestorFqns) {
      EntityReference ancestor = byFqn.get(ancestorFqn);
      if (ancestor != null) {
        ordered.add(ancestor);
      }
    }
    return Collections.unmodifiableList(ordered);
  }

  private TableData getSampleDataInternal(UUID containerId) {
    String json =
        daoCollection
            .entityExtensionDAO()
            .getExtension(containerId, CONTAINER_SAMPLE_DATA_EXTENSION);
    return json != null ? JsonUtils.readValue(json, TableData.class) : null;
  }

  @Transaction
  public Container addSampleData(UUID containerId, TableData tableData) {
    Container container = find(containerId, NON_DELETED);

    if (container.getDataModel() == null || container.getDataModel().getColumns() == null) {
      throw new IllegalArgumentException(
          String.format(
              "Cannot add sample data to container '%s' without a dataModel. "
                  + "Container must have a dataModel with columns defined before sample data can be stored.",
              container.getFullyQualifiedName()));
    }

    for (String columnName : tableData.getColumns()) {
      validateColumn(container.getDataModel().getColumns(), columnName);
    }

    for (List<Object> row : tableData.getRows()) {
      if (row.size() != tableData.getColumns().size()) {
        throw new IllegalArgumentException(
            String.format(
                "Number of columns is %d but row has %d sample values",
                tableData.getColumns().size(), row.size()));
      }
    }

    daoCollection
        .entityExtensionDAO()
        .insert(
            containerId,
            CONTAINER_SAMPLE_DATA_EXTENSION,
            "tableData",
            JsonUtils.pojoToJson(tableData));
    setFieldsInternal(container, Fields.EMPTY_FIELDS);
    return container.withSampleData(tableData);
  }

  public Container getSampleData(UUID containerId, boolean authorizePII) {
    Container container = find(containerId, NON_DELETED);
    TableData sampleData = getSampleDataInternal(container.getId());
    container.setSampleData(sampleData);
    setFieldsInternal(container, Fields.EMPTY_FIELDS);

    if (!authorizePII && container.getDataModel() != null) {
      populateDataModelColumnTags(true, container.getDataModel().getColumns());
      container.setTags(getTags(container));
      return PIIMasker.getSampleData(container);
    }

    return container;
  }

  @Transaction
  public Container deleteSampleData(UUID containerId) {
    Container container = find(containerId, NON_DELETED);
    daoCollection.entityExtensionDAO().delete(containerId, CONTAINER_SAMPLE_DATA_EXTENSION);
    setFieldsInternal(container, Fields.EMPTY_FIELDS);
    return container;
  }

  static class DataModelDescriptionTaskWorkflow extends DescriptionTaskWorkflow {
    private final Column column;

    DataModelDescriptionTaskWorkflow(ThreadContext threadContext) {
      super(threadContext);
      DashboardDataModel dataModel =
          Entity.getEntity(
              DASHBOARD_DATA_MODEL, threadContext.getAboutEntity().getId(), "dataModel", ALL);
      threadContext.setAboutEntity(dataModel);
      column = EntityUtil.findColumn(dataModel.getColumns(), getAbout().getArrayFieldName());
    }

    @Override
    public EntityInterface performTask(String user, ResolveTask resolveTask) {
      column.setDescription(resolveTask.getNewValue());
      return threadContext.getAboutEntity();
    }
  }

  static class DataModelTagTaskWorkflow extends TagTaskWorkflow {
    private final Column column;

    DataModelTagTaskWorkflow(ThreadContext threadContext) {
      super(threadContext);
      DashboardDataModel dataModel =
          Entity.getEntity(
              DASHBOARD_DATA_MODEL, threadContext.getAboutEntity().getId(), "dataModel,tags", ALL);
      threadContext.setAboutEntity(dataModel);
      column = EntityUtil.findColumn(dataModel.getColumns(), getAbout().getArrayFieldName());
    }

    @Override
    public EntityInterface performTask(String user, ResolveTask resolveTask) {
      List<TagLabel> tags = JsonUtils.readObjects(resolveTask.getNewValue(), TagLabel.class);
      column.setTags(tags);
      return threadContext.getAboutEntity();
    }
  }

  /** Handles entity updated from PUT and POST operations */
  public class ContainerUpdater extends ColumnEntityUpdater {
    public ContainerUpdater(Container original, Container updated, Operation operation) {
      super(original, updated, operation);
    }

    @Transaction
    @Override
    public void entitySpecificUpdate(boolean consolidatingChanges) {
      compareAndUpdate("dataModel", () -> updateDataModel(original, updated));
      compareAndUpdate(
          "prefix", () -> recordChange("prefix", original.getPrefix(), updated.getPrefix()));
      compareAndUpdate(
          "fileFormats",
          () -> {
            List<ContainerFileFormat> addedItems = new ArrayList<>();
            List<ContainerFileFormat> deletedItems = new ArrayList<>();
            recordListChange(
                "fileFormats",
                original.getFileFormats(),
                updated.getFileFormats(),
                addedItems,
                deletedItems,
                EntityUtil.containerFileFormatMatch);
          });

      compareAndUpdate(
          "numberOfObjects",
          () ->
              recordChange(
                  "numberOfObjects",
                  original.getNumberOfObjects(),
                  updated.getNumberOfObjects(),
                  false,
                  EntityUtil.objectMatch,
                  false));
      compareAndUpdate(
          "size",
          () ->
              recordChange(
                  "size",
                  original.getSize(),
                  updated.getSize(),
                  false,
                  EntityUtil.objectMatch,
                  false));
      compareAndUpdate(
          "sourceUrl",
          () -> recordChange("sourceUrl", original.getSourceUrl(), updated.getSourceUrl()));
      compareAndUpdate(
          "fullPath",
          () -> recordChange("fullPath", original.getFullPath(), updated.getFullPath()));
      compareAndUpdate(
          "retentionPeriod",
          () ->
              recordChange(
                  "retentionPeriod", original.getRetentionPeriod(), updated.getRetentionPeriod()));
      compareAndUpdate(
          "sourceHash",
          () ->
              recordChange(
                  "sourceHash",
                  original.getSourceHash(),
                  updated.getSourceHash(),
                  false,
                  EntityUtil.objectMatch,
                  false));
    }

    private void updateDataModel(Container original, Container updated) {
      if (original.getDataModel() == null || updated.getDataModel() == null) {
        recordChange("dataModel", original.getDataModel(), updated.getDataModel(), true);
      }

      if (original.getDataModel() != null && updated.getDataModel() != null) {
        updateColumns(
            "dataModel.columns",
            original.getDataModel().getColumns(),
            updated.getDataModel().getColumns(),
            EntityUtil.columnMatch);
        recordChange(
            "dataModel.partition",
            original.getDataModel().getIsPartitioned(),
            updated.getDataModel().getIsPartitioned());
      }
    }
  }
}
