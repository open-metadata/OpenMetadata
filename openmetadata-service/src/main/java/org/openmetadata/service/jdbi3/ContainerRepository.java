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
import static org.openmetadata.service.Entity.populateEntityFieldTags;
import static org.openmetadata.service.util.EntityUtil.getEntityReferences;

import com.google.common.collect.Lists;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
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
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TaskType;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.FeedRepository.TaskWorkflow;
import org.openmetadata.service.jdbi3.FeedRepository.ThreadContext;
import org.openmetadata.service.resources.feeds.MessageParser.EntityLink;
import org.openmetadata.service.resources.storages.ContainerResource;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.ResultList;

public class ContainerRepository extends EntityRepository<Container> {
  private static final String CONTAINER_UPDATE_FIELDS = "dataModel";
  private static final String CONTAINER_PATCH_FIELDS = "dataModel";

  public ContainerRepository() {
    super(
        ContainerResource.COLLECTION_PATH,
        Entity.CONTAINER,
        Container.class,
        Entity.getCollectionDAO().containerDAO(),
        CONTAINER_PATCH_FIELDS,
        CONTAINER_UPDATE_FIELDS);
    supportsSearch = true;

    // Register bulk field fetchers for efficient database operations
    fieldFetchers.put(FIELD_PARENT, this::fetchAndSetParents);
    fieldFetchers.put(FIELD_TAGS, this::fetchAndSetDataModelColumnTags);
    fieldFetchers.put("children", this::fetchAndSetChildren);
  }

  @Override
  public void setFields(Container container, EntityUtil.Fields fields) {
    setDefaultFields(container);
    container.setParent(
        fields.contains(FIELD_PARENT) ? getContainerParent(container) : container.getParent());
    container.setChildren(
        fields.contains("children") ? getChildren(container) : container.getChildren());
    if (container.getDataModel() != null) {
      populateDataModelColumnTags(
          fields.contains(FIELD_TAGS),
          container.getFullyQualifiedName(),
          container.getDataModel().getColumns());
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
    // Filter containers that have data models and use bulk tag fetching
    List<Container> containersWithDataModels =
        containers.stream()
            .filter(c -> c.getDataModel() != null)
            .collect(java.util.stream.Collectors.toList());

    if (!containersWithDataModels.isEmpty()) {
      bulkPopulateEntityFieldTags(
          containersWithDataModels,
          entityType,
          c -> c.getDataModel().getColumns(),
          Container::getFullyQualifiedName);
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

    for (CollectionDAO.EntityRelationshipObject record : records) {
      UUID containerId = UUID.fromString(record.getToId());
      if (STORAGE_SERVICE.equals(record.getFromEntity())) {
        EntityReference serviceRef =
            getEntityReferenceById(
                STORAGE_SERVICE, UUID.fromString(record.getFromId()), NON_DELETED);
        serviceMap.put(containerId, serviceRef);
      }
    }

    return serviceMap;
  }

  @Override
  public void clearFields(Container container, EntityUtil.Fields fields) {
    container.setParent(fields.contains(FIELD_PARENT) ? container.getParent() : null);
    container.withDataModel(fields.contains("dataModel") ? container.getDataModel() : null);
  }

  private void populateDataModelColumnTags(
      boolean setTags, String fqnPrefix, List<Column> columns) {
    populateEntityFieldTags(entityType, columns, fqnPrefix, setTags);
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
    StorageService storageService =
        Entity.getEntity(container.getService(), "", Include.NON_DELETED);
    container.setService(storageService.getEntityReference());
    container.setServiceType(storageService.getServiceType());

    if (container.getParent() != null) {
      Container parent = Entity.getEntity(container.getParent(), "owners", ALL);
      container.withParent(parent.getEntityReference());
    }
  }

  @Override
  public void storeEntity(Container container, boolean update) {
    EntityReference storageService = container.getService();
    EntityReference parent = container.getParent();
    container.withService(null).withParent(null);

    // Don't store datamodel column tags as JSON but build it on the fly based on relationships
    List<Column> columnWithTags = Lists.newArrayList();
    if (container.getDataModel() != null) {
      columnWithTags.addAll(container.getDataModel().getColumns());
      container.getDataModel().setColumns(ColumnUtil.cloneWithoutTags(columnWithTags));
      container.getDataModel().getColumns().forEach(column -> column.setTags(null));
    }

    store(container, update);

    // Restore the relationships
    container.withService(storageService).withParent(parent);
    if (container.getDataModel() != null) {
      container.getDataModel().setColumns(columnWithTags);
    }
  }

  @Override
  public void restorePatchAttributes(Container original, Container updated) {
    // Patch can't make changes to following fields. Ignore the changes
    super.restorePatchAttributes(original, updated);
    updated.withService(original.getService()).withParent(original.getParent());
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
    if (entityLink.getFieldName().equals("dataModel")) {
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

    Container parentContainer = dao.findEntityByName(parentFQN);

    try {
      List<CollectionDAO.EntityRelationshipRecord> relationshipRecords =
          daoCollection
              .relationshipDAO()
              .findToWithOffset(
                  parentContainer.getId(),
                  CONTAINER,
                  List.of(Relationship.CONTAINS.ordinal()),
                  offset,
                  limit);

      int total =
          daoCollection
              .relationshipDAO()
              .countFindTo(
                  parentContainer.getId(), CONTAINER, List.of(Relationship.CONTAINS.ordinal()));

      if (relationshipRecords.isEmpty()) {
        return new ResultList<>(new ArrayList<>(), null, null, total);
      }

      List<EntityReference> refs = getEntityReferences(relationshipRecords);
      List<Container> children = new ArrayList<>();

      for (EntityReference ref : refs) {
        Container container =
            Entity.getEntity(ref, EntityUtil.Fields.EMPTY_FIELDS.toString(), Include.ALL);
        children.add(container);
      }

      return new ResultList<>(children, null, null, total);
    } catch (Exception e) {
      throw new RuntimeException(
          String.format(
              "Failed to fetch children for container [%s]: %s", parentFQN, e.getMessage()),
          e);
    }
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
      updateDataModel(original, updated);
      recordChange("prefix", original.getPrefix(), updated.getPrefix());
      List<ContainerFileFormat> addedItems = new ArrayList<>();
      List<ContainerFileFormat> deletedItems = new ArrayList<>();
      recordListChange(
          "fileFormats",
          original.getFileFormats(),
          updated.getFileFormats(),
          addedItems,
          deletedItems,
          EntityUtil.containerFileFormatMatch);

      // record the changes for size and numOfObjects change without version update.
      recordChange(
          "numberOfObjects",
          original.getNumberOfObjects(),
          updated.getNumberOfObjects(),
          false,
          EntityUtil.objectMatch,
          false);
      recordChange(
          "size", original.getSize(), updated.getSize(), false, EntityUtil.objectMatch, false);
      recordChange("sourceUrl", original.getSourceUrl(), updated.getSourceUrl());
      recordChange("fullPath", original.getFullPath(), updated.getFullPath());
      recordChange("retentionPeriod", original.getRetentionPeriod(), updated.getRetentionPeriod());
      recordChange("sourceHash", original.getSourceHash(), updated.getSourceHash());
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
