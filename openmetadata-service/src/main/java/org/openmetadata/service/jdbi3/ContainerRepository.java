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
import static org.openmetadata.service.search.SearchClient.GLOBAL_SEARCH_ALIAS;
import static org.openmetadata.service.util.EntityUtil.compareTagLabel;
import static org.openmetadata.service.util.EntityUtil.entityReferenceMatch;
import static org.openmetadata.service.util.EntityUtil.getFlattenedEntityField;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
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
import org.openmetadata.schema.type.TagLabel.TagSource;
import org.openmetadata.schema.type.TaskType;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.cache.AncestorsCache;
import org.openmetadata.service.cache.CacheBundle;
import org.openmetadata.service.cache.ChildrenPageCache;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.jdbi3.FeedRepository.TaskWorkflow;
import org.openmetadata.service.jdbi3.FeedRepository.ThreadContext;
import org.openmetadata.service.monitoring.RequestLatencyContext;
import org.openmetadata.service.resources.feeds.MessageParser.EntityLink;
import org.openmetadata.service.resources.storages.ContainerResource;
import org.openmetadata.service.security.mask.PIIMasker;
import org.openmetadata.service.security.policyevaluator.PolicyConditionUpdater;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.FullyQualifiedName;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class ContainerRepository extends EntityRepository<Container> {
  private static final Logger LOG = LoggerFactory.getLogger(ContainerRepository.class);
  private static final String CONTAINER_UPDATE_FIELDS = "dataModel,parent";
  private static final String CONTAINER_PATCH_FIELDS = "dataModel,parent";
  private static final Set<String> CHANGE_SUMMARY_FIELDS = Set.of("dataModel.columns.description");
  public static final String CONTAINER_SAMPLE_DATA_EXTENSION = "container.sampleData";

  private final FeedRepository feedRepository = Entity.getFeedRepository();

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

    allowedFields.remove("children");

    // Register bulk field fetchers for efficient database operations
    fieldFetchers.put(FIELD_PARENT, this::fetchAndSetParents);
    fieldFetchers.put(FIELD_TAGS, this::fetchAndSetDataModelColumnTags);
  }

  @Override
  public void setFields(
      Container container, EntityUtil.Fields fields, RelationIncludes relationIncludes) {
    setDefaultFields(container);
    // Conditional load: relationship lookup only when the caller explicitly asked for the
    // parent field. PATCH still gets the live parent because `CONTAINER_PATCH_FIELDS`
    // includes `parent`, so the JSON-Patch flow sees an existing `/parent` member. All
    // other GETs that don't request `parent` keep the JSON-deserialised value (no extra
    // round-trip).
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

    Map<String, List<TagLabel>> derivedTagsMap =
        tryBatchFetchDerivedTags(tagsMap, containers.size() + " containers");

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
    if (!setTags) {
      // Caller didn't ask for tags — leave the column tree untouched. The original
      // code looped here calling c.setTags(c.getTags()) (a no-op carried over from
      // Entity.populateEntityFieldTags); skip that pointless walk.
      return;
    }
    List<Column> flattenedColumns = getFlattenedEntityField(columns);
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
    Map<String, List<TagLabel>> derivedTagsMap =
        tryBatchFetchDerivedTags(tagsByHash, "container columns");

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

  /**
   * Run a single batched derived-tag lookup across every TagLabel value in {@code tagsByKey},
   * returning {@code null} on failure so callers can fall back to per-row
   * {@link #addDerivedTagsGracefully(List)}. Used by both the bulk container path and the
   * single-container column path so the warn-and-fall-back behavior stays in lockstep.
   */
  private Map<String, List<TagLabel>> tryBatchFetchDerivedTags(
      Map<String, List<TagLabel>> tagsByKey, String contextDescription) {
    try {
      List<TagLabel> allTags =
          tagsByKey.values().stream()
              .filter(Objects::nonNull)
              .flatMap(List::stream)
              .collect(Collectors.toList());
      return batchFetchDerivedTags(allTags);
    } catch (Exception ex) {
      LOG.warn(
          "Failed to batch fetch derived tags for {}. Falling back to per-row.",
          contextDescription,
          ex);
      return null;
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
    // Trust the in-memory parent — do not re-query the relationship table. The previous
    // behavior (`parent != null ? parent : getContainerParent(...)`) silently restored the
    // stored parent when a PATCH explicitly cleared `parent` (#24294), making
    // "promote to top level" impossible. Create flow already populates parent from the request
    // via ContainerMapper before this runs, so there's no legitimate caller relying on the
    // implicit DB lookup here.
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
          FullyQualifiedName.validateFqnName(c.getName());
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
    // Service can't change via PATCH; parent is patchable (see #24294 — same-service re-parent
    // is validated in ContainerUpdater.validateParent).
    super.restorePatchAttributes(original, updated);
    updated.withService(original.getService());
  }

  // ----------------------------------------------------------------------------------------
  // Derived cache invalidation: AncestorsCache + ChildrenPageCache are container-specific
  // (only the /containers/{fqn}/ancestors and /containers/{fqn}/children endpoints exist
  // today), so the invalidation lives here, not in the generic EntityRepository. Hooks fire
  // on every container create / update / delete so a parent's cached children pages can't
  // outlive a mutation. Display-name edits on an ancestor are picked up automatically: the
  // ancestors cache stores topology only (a List<String> of ancestor FQNs); display names
  // are rehydrated per-read through the existing write-through per-entity reference cache,
  // which is invalidated on every entity write. Cross-instance invalidation is handled
  // separately by the pubsub handler in CacheBundle (gated to entityType=container).
  // ----------------------------------------------------------------------------------------

  @Override
  protected void postCreate(Container entity) {
    super.postCreate(entity);
    invalidateContainerDerivedCaches(entity.getFullyQualifiedName());
  }

  @Override
  protected void postUpdate(Container original, Container updated) {
    super.postUpdate(original, updated);
    invalidateContainerDerivedCaches(updated.getFullyQualifiedName());
    String originalFqn = original.getFullyQualifiedName();
    if (originalFqn != null && !originalFqn.equals(updated.getFullyQualifiedName())) {
      // Rename / move: the old FQN's parent loses the row, descendants of the old FQN had
      // an entry in their ancestors chain that no longer exists. Drop both.
      invalidateContainerDerivedCaches(originalFqn);
    }
  }

  @Override
  protected void invalidateCache(Container entity) {
    super.invalidateCache(entity);
    invalidateContainerDerivedCaches(entity.getFullyQualifiedName());
  }

  private static void invalidateContainerDerivedCaches(String fqn) {
    if (fqn == null) {
      return;
    }
    AncestorsCache ancestorsCache = CacheBundle.getAncestorsCache();
    if (ancestorsCache != null) {
      ancestorsCache.invalidate(CONTAINER, fqn);
    }
    ChildrenPageCache childrenPageCache = CacheBundle.getChildrenPageCache();
    if (childrenPageCache != null) {
      // Rotate the container's own children-page first — when the container is itself a
      // parent (typical for buckets/folders), a delete or rename leaves cached pages
      // serving the stale child list until TTL otherwise.
      childrenPageCache.invalidate(CONTAINER, fqn);
      String parentFqn = FullyQualifiedName.getParentFQN(fqn);
      if (parentFqn != null) {
        childrenPageCache.invalidate(CONTAINER, parentFqn);
      }
    }
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
    return listChildren(parentFQN, limit, offset, Include.NON_DELETED, null);
  }

  public ResultList<Container> listChildren(
      String parentFQN, Integer limit, Integer offset, Include include) {
    return listChildren(parentFQN, limit, offset, include, null);
  }

  /**
   * List direct children of {@code parentFQN}, paginated. Direct children are containers
   * whose FQN is exactly one segment below {@code parentFQN} — the FQN is the canonical
   * hierarchy in OpenMetadata, set unconditionally at write time and consumed by the
   * breadcrumb UI.
   *
   * <p>Earlier implementations resolved children through {@code entity_relationship}
   * (CONTAINS edges from the parent's UUID). That made two assumptions that don't always
   * hold in practice:
   * <ul>
   *   <li>The connector or bulk-import path always writes the parent CONTAINS edge. Some
   *       connectors only write leaf containers without their ancestors, leaving the leaf
   *       with a deeply-nested FQN but no inbound CONTAINS edge — those leaves never appear
   *       under any /children query for their FQN-implied parent.</li>
   *   <li>The parent itself exists in the table. The previous code did a
   *       {@code dao.findEntityByName(parentFQN)} preflight to resolve the parent's UUID;
   *       a missing parent meant the call failed even though descendants existed.</li>
   * </ul>
   *
   * <p>The FQN-depth approach asks the right question — "which rows have an FQN that is
   * exactly one level below this prefix?" — and answers it with a single indexed range
   * scan against {@code idx_storage_container_entity_fqnhash_pattern}. The parent UUID is
   * never needed; the parent doesn't even have to exist for its descendants to be
   * discoverable. Because each FQN segment hashes to a fixed-width MD5, "exactly one
   * segment below" is expressible as {@code fqnHash LIKE :parentHash AND fqnHash NOT LIKE
   * :parentHashChild}, where {@code :parentHash} is {@code <hash>.%} and
   * {@code :parentHashChild} is {@code <hash>.%.%}.
   *
   * <p>{@code search} narrows the page to children whose name contains the given substring
   * (case-insensitive). Empty / null disables the filter — the caller passes the raw text
   * the user typed; LIKE wildcards in the query are escaped here so {@code _} and
   * {@code %} match literally. Searches bypass {@link ChildrenPageCache} since the same
   * parent will typically be queried with many different substrings (cache hit rate ≈ 0)
   * and caching every variant inflates the working set; the depth-only listing remains
   * cached as before.
   */
  public ResultList<Container> listChildren(
      String parentFQN, Integer limit, Integer offset, Include include, String search) {
    int safeLimit = limit != null ? limit : 0;
    int safeOffset = offset != null ? offset : 0;
    Include safeInclude = include != null ? include : Include.NON_DELETED;
    String nameLike = buildNameLikeBind(search);
    boolean hasSearch = !"%".equals(nameLike);

    ChildrenPageCache pageCache = hasSearch ? null : CacheBundle.getChildrenPageCache();
    if (pageCache != null) {
      ResultList<Container> cached;
      try (var ignored = RequestLatencyContext.phase("listChildrenCacheGet")) {
        cached = pageCache.get(CONTAINER, parentFQN, safeLimit, safeOffset, safeInclude);
      }
      if (cached != null) {
        return cached;
      }
    }

    // Phase markers feed the slow-request log so when a /children call exceeds the
    // latency budget in prod we can tell which step (depth query / count / service
    // restore) was responsible. The parent-lookup phase from the previous
    // entity_relationship-based implementation is gone — the FQN is enough.
    String parentHashRaw = FullyQualifiedName.buildHash(parentFQN);
    String parentHash = parentHashRaw + Entity.SEPARATOR + "%";
    String parentHashChild = parentHashRaw + Entity.SEPARATOR + "%" + Entity.SEPARATOR + "%";
    String includeBind = includeToBindString(safeInclude);
    CollectionDAO.ContainerDAO containerDAO = (CollectionDAO.ContainerDAO) dao;

    try {
      List<Container> children;
      try (var ignored = RequestLatencyContext.phase("listChildrenPage")) {
        children =
            containerDAO.listDirectChildSummariesByParentHash(
                parentHash, parentHashChild, nameLike, includeBind, safeLimit, safeOffset);
      }

      int total;
      try (var ignored = RequestLatencyContext.phase("listChildrenCount")) {
        total =
            containerDAO.countDirectChildrenByParentHash(
                parentHash, parentHashChild, nameLike, includeBind);
      }

      if (children.isEmpty()) {
        ResultList<Container> empty = new ResultList<>(new ArrayList<>(), null, null, total);
        if (pageCache != null) {
          pageCache.put(CONTAINER, parentFQN, safeLimit, safeOffset, safeInclude, empty);
        }
        return empty;
      }

      // service is stripped from stored JSON; restore via batched relationship lookup.
      try (var ignored = RequestLatencyContext.phase("listChildrenService")) {
        fetchAndSetDefaultService(children);
      }

      ResultList<Container> page = new ResultList<>(children, null, null, total);
      if (pageCache != null) {
        pageCache.put(CONTAINER, parentFQN, safeLimit, safeOffset, safeInclude, page);
      }
      return page;
    } catch (Exception e) {
      throw new RuntimeException(
          String.format(
              "Failed to fetch children for container [%s]: %s", parentFQN, e.getMessage()),
          e);
    }
  }

  /**
   * Build the LIKE bind for the optional name filter. Returns {@code "%"} (which always
   * matches) when no search is supplied so the SQL stays branch-free. When a search is
   * supplied the pattern is lowercased to match the {@code LOWER(name)} expression in the
   * SQL and the LIKE wildcards {@code %} and {@code _} (plus the escape character
   * {@code !}) are escaped so a name containing them matches literally rather than
   * acting as a wildcard. The SQL declares {@code ESCAPE '!'} explicitly because the
   * MySQL/PostgreSQL defaults differ; {@code !} is preferred over {@code \} because
   * a literal backslash inside a single-quoted SQL string confuses JDBI's
   * ColonPrefixSqlParser when it scans for {@code :name} bind markers, leaving a
   * downstream bind un-substituted (see ContainerDAO comment block).
   */
  private static String buildNameLikeBind(String search) {
    if (search == null || search.isBlank()) {
      return "%";
    }
    String escaped =
        search
            .trim()
            .toLowerCase(Locale.ROOT)
            .replace("!", "!!")
            .replace("%", "!%")
            .replace("_", "!_");
    return "%" + escaped + "%";
  }

  /**
   * Map the public {@link Include} enum to the literal value the listing SQL expects.
   * The SQL ({@code ContainerDAO.listDirectChildSummariesByParentHash}) gates the
   * deleted predicate on this bind via a three-branch OR chain
   * ({@code :includeDeleted = 'ALL' OR (:includeDeleted = 'DELETED' AND deleted = TRUE)
   * OR (:includeDeleted = 'NON_DELETED' AND deleted = FALSE)}) rather than three
   * separate query templates — the underlying access path is identical, the index range
   * scan on {@code fqnHash} runs once, and the per-row deleted predicate is evaluated
   * post-index in all three modes.
   */
  private static String includeToBindString(Include include) {
    return switch (include) {
      case ALL -> "ALL";
      case DELETED -> "DELETED";
      default -> "NON_DELETED";
    };
  }

  /**
   * Return the parent chain for the given container, ordered from root container (immediate
   * child of the storage service) down to the immediate parent. Empty when the container is at
   * the top level. Resolves the entire chain in a single batched DB lookup so the UI does not
   * need to issue one parent fetch per breadcrumb level.
   */
  public List<EntityReference> getAncestors(String fqn) {
    AncestorsCache ancestorsCache = CacheBundle.getAncestorsCache();
    if (ancestorsCache != null) {
      List<String> cachedFqns = ancestorsCache.getFqns(CONTAINER, fqn);
      if (cachedFqns != null) {
        // Topology was warm — hydrate each ancestor's reference through the existing
        // write-through per-entity reference cache (om:rn:) so display names always
        // reflect the latest write, not whatever was current when the topology was
        // first cached. Misses fall through to a single batched DB lookup.
        return hydrateRefsByFqn(cachedFqns);
      }
    }

    List<String> ancestorFqns = computeAncestorFqns(fqn);
    if (ancestorFqns.isEmpty()) {
      return Collections.emptyList();
    }
    List<EntityReference> ordered = hydrateRefsByFqn(ancestorFqns);
    if (ancestorsCache != null) {
      ancestorsCache.putFqns(CONTAINER, fqn, ancestorFqns);
    }
    return ordered;
  }

  private List<String> computeAncestorFqns(String fqn) {
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
    return ancestorFqns;
  }

  /**
   * Resolve a list of container FQNs to {@link EntityReference}s, ordered to match the input.
   * Reads first hit the write-through per-entity reference cache, which is invalidated and
   * repopulated on every entity write — so the displayName returned here always reflects the
   * latest write, not whatever was current when the topology chain was first cached. Misses
   * are batched into one {@code findReferencesByFqns} call and warm the per-entity cache on
   * the way out.
   */
  private List<EntityReference> hydrateRefsByFqn(List<String> fqns) {
    if (fqns.isEmpty()) {
      return Collections.emptyList();
    }

    var entityCache = CacheBundle.getCachedEntityDao();
    Map<String, EntityReference> byFqn = new HashMap<>();
    List<String> misses = new ArrayList<>();

    if (entityCache != null) {
      for (String ancestorFqn : fqns) {
        Optional<String> hit = entityCache.getReferenceByName(CONTAINER, ancestorFqn);
        if (hit.isPresent() && !hit.get().isEmpty()) {
          try {
            byFqn.put(ancestorFqn, JsonUtils.readValue(hit.get(), EntityReference.class));
            continue;
          } catch (Exception e) {
            // Evict the corrupt entry up front so a transient warm-write failure below
            // doesn't leave the bad JSON pinned in Redis until TTL — every subsequent
            // breadcrumb call would re-hit it, parse-fail, and round-trip the DB.
            try {
              entityCache.invalidateReferenceByName(CONTAINER, ancestorFqn);
            } catch (Exception evictError) {
              LOG.debug(
                  "Failed to evict bad reference cache entry for {} {}",
                  CONTAINER,
                  ancestorFqn,
                  evictError);
            }
            LOG.debug(
                "Bad cached EntityReference for {} {}, evicted and falling through",
                CONTAINER,
                ancestorFqn,
                e);
          }
        }
        misses.add(ancestorFqn);
      }
    } else {
      misses.addAll(fqns);
    }

    if (!misses.isEmpty()) {
      for (EntityReference ref : dao.findReferencesByFqns(misses, NON_DELETED)) {
        byFqn.put(ref.getFullyQualifiedName(), ref);
        // Warm the write-through cache so the next reader is also hydrated cheaply.
        if (entityCache != null) {
          try {
            entityCache.putReferenceByName(
                CONTAINER, ref.getFullyQualifiedName(), JsonUtils.pojoToJson(ref));
          } catch (Exception e) {
            LOG.debug("Failed to warm reference cache for {} {}", CONTAINER, ref.getId(), e);
          }
        }
      }
    }

    List<EntityReference> ordered = new ArrayList<>(fqns.size());
    for (String ancestorFqn : fqns) {
      EntityReference ref = byFqn.get(ancestorFqn);
      if (ref != null) {
        ordered.add(ref);
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

  /**
   * Rewrite feed entity-links and field-relationships when a container's FQN changes (parent
   * move).
   *
   * <p>{@code renamedDescendants} is the snapshot returned by
   * {@link EntityRepository#invalidateCacheForRenameCascade} — it contains every descendant
   * id paired with the OLD fqn at the time of capture. We rewrite each descendant's legacy
   * thread {@code about} link with the corresponding NEW fqn so deep subtrees (grandchildren
   * and beyond) do not keep stale entityLinks. Direct-children-only is insufficient: a
   * three-level move would leave grandchild feed threads pointing at the old FQN and break
   * activity-feed navigation.
   */
  private void updateEntityLinks(
      String oldFqn,
      String newFqn,
      Container updated,
      List<EntityDAO.EntityIdFqnPair> renamedDescendants) {
    daoCollection.fieldRelationshipDAO().renameByToFQN(oldFqn, newFqn);

    EntityLink newAbout = new EntityLink(CONTAINER, newFqn);
    feedRepository.updateLegacyThreadsAbout(newAbout.getLinkString(), updated.getId().toString());

    if (renamedDescendants == null || renamedDescendants.isEmpty()) {
      return;
    }
    // Each descendant's old FQN begins with `oldFqn + "."`; the new FQN is obtained by
    // swapping the prefix. This matches the same prefix-substitution that
    // ContainerDAO.updateFqn applies at the JSON / fqnHash level, so the entity-link rewrite
    // stays consistent with the persisted FQN.
    for (EntityDAO.EntityIdFqnPair descendant : renamedDescendants) {
      if (descendant.fqn == null || !descendant.fqn.startsWith(oldFqn + ".")) {
        continue;
      }
      String descendantNewFqn = newFqn + descendant.fqn.substring(oldFqn.length());
      EntityLink descendantAbout = new EntityLink(CONTAINER, descendantNewFqn);
      feedRepository.updateLegacyThreadsAbout(
          descendantAbout.getLinkString(), descendant.id.toString());
    }
  }

  /**
   * Rewrite the search-index documents whose {@code fullyQualifiedName} starts with {@code
   * oldFqn} so they reflect {@code newFqn}. Covers the moved container and every descendant in
   * one indexed update-by-query.
   */
  private void updateAssetIndexes(String oldFqn, String newFqn) {
    searchRepository.deferIfFlushScopeActive(
        () ->
            searchRepository
                .getSearchClient()
                .updateByFqnPrefix(GLOBAL_SEARCH_ALIAS, oldFqn, newFqn, "fullyQualifiedName"),
        "containerUpdateAssetIndexes",
        null,
        newFqn,
        CONTAINER);
  }

  /**
   * Hard ceiling on how many descendant containers a single PATCH re-parent (#24294) is allowed
   * to cascade through in one transaction. The whole rewrite — descendant FQNs in
   * {@code storage_container_entity}, every tag_usage row, every cached entry across all OM
   * instances, and the search-index update-by-query — runs inside one DB transaction holding
   * row locks on the entire subtree. Past this threshold the operation is functionally a DoS
   * on the cluster, so we reject it at the front door and ask the operator to split the move.
   *
   * <p>Operator override: the {@code openmetadata.container.maxReparentDescendants} system
   * property at JVM startup. Tests must not use that property because it is JVM-global and
   * other concurrent tests would observe the artificially low value; use
   * {@link #setMaxReparentDescendantsForTest(int)} instead, which is wrapped in {@code
   * try/finally} and serialized by {@code @ResourceLock} on the affected tests.
   */
  static final int DEFAULT_MAX_REPARENT_DESCENDANTS = 10_000;

  private static final String MAX_REPARENT_DESCENDANTS_PROPERTY =
      "openmetadata.container.maxReparentDescendants";

  /**
   * Test-only override resource lock identifier. Both the override accessor and IT methods that
   * mutate it carry {@code @ResourceLock(MAX_REPARENT_DESCENDANTS_TEST_LOCK)} so the JUnit
   * platform serializes any test that touches the override, even though the class-level
   * {@code @Execution(ExecutionMode.CONCURRENT)} otherwise runs tests in parallel.
   */
  public static final String MAX_REPARENT_DESCENDANTS_TEST_LOCK =
      "container.maxReparentDescendants.override";

  private static volatile Integer maxReparentDescendantsTestOverride;

  static int maxReparentDescendants() {
    Integer override = maxReparentDescendantsTestOverride;
    if (override != null) {
      return override;
    }
    return Integer.getInteger(MAX_REPARENT_DESCENDANTS_PROPERTY, DEFAULT_MAX_REPARENT_DESCENDANTS);
  }

  /**
   * Test-only setter that bypasses the JVM-global system property so concurrent tests can run
   * with isolated thresholds when paired with {@code @ResourceLock}. Always call {@link
   * #clearMaxReparentDescendantsForTest()} in a {@code finally} block.
   *
   * <p><b>Not for production use.</b> Public so integration tests in
   * {@code org.openmetadata.it.tests} can reach it; pair with
   * {@code @ResourceLock(ContainerRepository.MAX_REPARENT_DESCENDANTS_TEST_LOCK)} on every
   * test that calls this.
   */
  public static void setMaxReparentDescendantsForTest(int max) {
    maxReparentDescendantsTestOverride = max;
  }

  /** Test-only counterpart to {@link #setMaxReparentDescendantsForTest(int)}. */
  public static void clearMaxReparentDescendantsForTest() {
    maxReparentDescendantsTestOverride = null;
  }

  /**
   * Pure size check. Extracted so it's unit-testable without a live DAO — the production
   * caller in {@link ContainerUpdater#updateParent} runs the count query then passes the
   * result here.
   */
  static void validateSubtreeSize(String containerFqn, int descendantCount, int maxAllowed) {
    if (descendantCount > maxAllowed) {
      throw new IllegalArgumentException(
          CatalogExceptionMessage.containerSubtreeTooLarge(
              containerFqn, descendantCount, maxAllowed));
    }
  }

  /**
   * Validate that the {@code updated} container's parent (if set) is in the same StorageService
   * as the {@code original} and that it doesn't form a cycle. Extracted as a static helper so
   * the validation logic is unit-testable without bootstrapping an {@link EntityUpdater}.
   *
   * <p>Returns silently — without firing the DB lookup — when the parent reference hasn't
   * changed between {@code original} and {@code updated}. This is the common case for any
   * non-re-parent PATCH/PUT (description edits, tag additions, etc.) and we don't want to add
   * a round-trip to every container update.
   *
   * <p>Throws {@link IllegalArgumentException} when the parent points at a different service,
   * at the container itself, or at a descendant of the container (FQN-prefix check). The
   * {@link ContainerUpdater#validateAncestorChainCycle} caller adds a second-line ID-based
   * traversal that doesn't depend on FQN state.
   */
  static void validateContainerParent(Container original, Container updated) {
    EntityReference newParent = updated.getParent();
    if (newParent == null) {
      return;
    }
    UUID oldParentId = original.getParent() == null ? null : original.getParent().getId();
    if (Objects.equals(oldParentId, newParent.getId())) {
      // Parent hasn't changed — no need to resolve the reference or revalidate.
      return;
    }
    Container resolvedParent =
        Entity.getEntity(CONTAINER, newParent.getId(), "service", NON_DELETED);
    UUID origServiceId = original.getService().getId();
    UUID parentServiceId = resolvedParent.getService().getId();
    if (!Objects.equals(origServiceId, parentServiceId)) {
      throw new IllegalArgumentException(
          CatalogExceptionMessage.invalidContainerParentService(
              original.getFullyQualifiedName(),
              original.getService().getFullyQualifiedName(),
              resolvedParent.getService().getFullyQualifiedName()));
    }
    String origFqn = original.getFullyQualifiedName();
    String parentFqn = resolvedParent.getFullyQualifiedName();
    if (Objects.equals(parentFqn, origFqn) || FullyQualifiedName.isParent(parentFqn, origFqn)) {
      throw new IllegalArgumentException(
          CatalogExceptionMessage.invalidContainerMove(origFqn, parentFqn));
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
      validateParent();
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
      compareAndUpdateAny(() -> updateParent(original, updated), FIELD_PARENT);
    }

    /**
     * Reject parent updates that would move the container under a different StorageService,
     * under itself, or under one of its descendants. Same-service-only is the user-confirmed
     * scope for #24294; cross-service moves are explicitly out of scope.
     *
     * <p>Two-pass cycle check:
     * <ol>
     *   <li>{@link ContainerRepository#validateContainerParent} runs an O(1) FQN-prefix check
     *       against the resolved parent (no chain walk; correct for in-transaction views).
     *   <li>{@link #validateAncestorChainCycle} then walks the actual CONTAINS edges by ID,
     *       bypassing any FQN-derived cache, so the check holds even if a descendant's stored
     *       FQN is briefly stale relative to the relationship table.
     * </ol>
     */
    void validateParent() {
      validateContainerParent(original, updated);
      EntityReference newParent = updated.getParent();
      if (newParent == null) {
        return;
      }
      UUID oldParentId = original.getParent() == null ? null : original.getParent().getId();
      if (!Objects.equals(oldParentId, newParent.getId())) {
        validateAncestorChainCycle(newParent.getId());
      }
    }

    /**
     * Walk the new parent's CONTAINS ancestor chain by ID and reject if we encounter
     * {@code original.getId()} — i.e. the new parent is somewhere downstream of the container
     * being moved. Cycle-safe via a visited set; bounded by the natural depth of the container
     * hierarchy. Uses {@code relationshipDAO.findFrom} (direct DB) so a stale FQN on a
     * descendant cannot bypass the check.
     */
    private void validateAncestorChainCycle(UUID newParentId) {
      Set<UUID> visited = new HashSet<>();
      visited.add(original.getId());
      UUID current = newParentId;
      while (current != null) {
        if (!visited.add(current)) {
          throw new IllegalArgumentException(
              CatalogExceptionMessage.invalidContainerMove(
                  original.getFullyQualifiedName(), updated.getParent().getFullyQualifiedName()));
        }
        List<CollectionDAO.EntityRelationshipRecord> parentRecords =
            daoCollection
                .relationshipDAO()
                .findFrom(current, CONTAINER, Relationship.CONTAINS.ordinal(), CONTAINER);
        if (parentRecords.isEmpty()) {
          return;
        }
        current = parentRecords.get(0).getId();
      }
    }

    /**
     * Re-parent the container and cascade the FQN change to every descendant container,
     * column FQN, tag-usage row, entity-link, policy condition, and search-index doc.
     * Mirrors {@link GlossaryTermRepository}'s {@code updateNameAndParent} flow.
     */
    private void updateParent(Container original, Container updated) {
      UUID oldParentId = original.getParent() == null ? null : original.getParent().getId();
      UUID newParentId = updated.getParent() == null ? null : updated.getParent().getId();
      if (Objects.equals(oldParentId, newParentId)) {
        return;
      }

      String oldFqn = getOriginalFqn();
      setFullyQualifiedName(updated);
      String newFqn = updated.getFullyQualifiedName();
      if (oldFqn.equals(newFqn)) {
        return;
      }

      LOG.info("Container FQN changed from {} to {} (parent reassignment)", oldFqn, newFqn);

      // #24294 — bail out BEFORE any cascade work if the subtree is large enough that the
      // single-transaction rewrite would lock thousands of rows + reindex hundreds of thousands
      // of search docs. Cheap indexed COUNT(*); short-circuits before any cache work runs.
      int maxAllowed = maxReparentDescendants();
      int descendantCount =
          daoCollection
              .containerDAO()
              .countDescendantsByPrefix(FullyQualifiedName.buildHash(oldFqn) + ".%");
      validateSubtreeSize(oldFqn, descendantCount, maxAllowed);

      List<EntityDAO.EntityIdFqnPair> renamedContainers =
          invalidateCacheForRenameCascade(CONTAINER, oldFqn);
      invalidateCacheForTaggedEntitiesAndDescendants(CONTAINER, oldFqn);

      daoCollection.containerDAO().updateFqn(oldFqn, newFqn);

      daoCollection.tagUsageDAO().deleteTagsByTarget(oldFqn);
      List<TagLabel> updatedTags = listOrEmpty(updated.getTags());
      if (!updatedTags.isEmpty()) {
        updatedTags = new ArrayList<>(updatedTags);
        updatedTags.sort(compareTagLabel);
        applyTags(updatedTags, newFqn);
      }
      daoCollection
          .tagUsageDAO()
          .renameByTargetFQNHash(TagSource.CLASSIFICATION.ordinal(), oldFqn, newFqn);
      daoCollection
          .tagUsageDAO()
          .renameByTargetFQNHash(TagSource.GLOSSARY.ordinal(), oldFqn, newFqn);

      updateEntityLinks(oldFqn, newFqn, updated, renamedContainers);

      PolicyConditionUpdater.updateAllPolicyConditions(
          condition ->
              PolicyConditionUpdater.renamePrefixInCondition(
                  condition, oldFqn, newFqn, PolicyConditionUpdater.TAG_FUNCTIONS));

      updateParentRelationship(original, updated);
      recordChange(
          FIELD_PARENT, original.getParent(), updated.getParent(), true, entityReferenceMatch);

      updateAssetIndexes(oldFqn, newFqn);
      finishInvalidateCacheForRenameCascade(CONTAINER, renamedContainers);
    }

    private void updateParentRelationship(Container orig, Container updated) {
      deleteParentRelationship(orig);
      addParentRelationship(updated);
    }

    private void deleteParentRelationship(Container container) {
      if (container.getParent() != null) {
        deleteRelationship(
            container.getParent().getId(),
            CONTAINER,
            container.getId(),
            CONTAINER,
            Relationship.CONTAINS);
      }
    }

    private void addParentRelationship(Container container) {
      if (container.getParent() != null) {
        addRelationship(
            container.getParent().getId(),
            container.getId(),
            CONTAINER,
            CONTAINER,
            Relationship.CONTAINS);
      }
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
