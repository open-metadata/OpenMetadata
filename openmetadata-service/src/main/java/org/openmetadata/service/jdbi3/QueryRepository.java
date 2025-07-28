package org.openmetadata.service.jdbi3;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.schema.type.EventType.ENTITY_FIELDS_CHANGED;
import static org.openmetadata.schema.type.EventType.ENTITY_UPDATED;
import static org.openmetadata.service.Entity.USER;

import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.UriInfo;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.entity.data.Query;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.query.QueryResource;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.RestUtil;

@Slf4j
public class QueryRepository extends EntityRepository<Query> {
  private static final String QUERY_USED_IN_FIELD = "queryUsedIn";
  private static final String QUERY_USERS_FIELD = "users";
  private static final String QUERY_PATCH_FIELDS = "users,query,queryUsedIn,processedLineage";
  private static final String QUERY_UPDATE_FIELDS = "users,queryUsedIn,processedLineage";

  public QueryRepository() {
    super(
        QueryResource.COLLECTION_PATH,
        Entity.QUERY,
        Query.class,
        Entity.getCollectionDAO().queryDAO(),
        QUERY_PATCH_FIELDS,
        QUERY_UPDATE_FIELDS);
    supportsSearch = true;
  }

  @Override
  public void setFullyQualifiedName(Query query) {
    query.setFullyQualifiedName(
        FullyQualifiedName.add(query.getService().getFullyQualifiedName(), query.getName()));
  }

  @Override
  protected void entitySpecificCleanup(Query entityInterface) {
    daoCollection
        .queryCostRecordTimeSeriesDAO()
        .deleteWithEntityFqnHash(entityInterface.getFullyQualifiedName());
  }

  @Override
  public void setFields(Query entity, EntityUtil.Fields fields) {
    entity.setQueryUsedIn(
        fields.contains(QUERY_USED_IN_FIELD) ? getQueryUsage(entity) : entity.getQueryUsedIn());
    entity.withUsers(fields.contains("users") ? getQueryUsers(entity) : entity.getUsers());
  }

  @Override
  public void clearFields(Query entity, EntityUtil.Fields fields) {
    entity.withQueryUsedIn(fields.contains(QUERY_USED_IN_FIELD) ? entity.getQueryUsedIn() : null);
    entity.withUsers(fields.contains("users") ? this.getQueryUsers(entity) : null);
  }

  @Override
  public void setFieldsInBulk(EntityUtil.Fields fields, List<Query> entities) {
    if (entities == null || entities.isEmpty()) {
      return;
    }
    // Bulk fetch and set services for all queries first
    fetchAndSetServices(entities);

    // Then call parent's implementation which handles standard fields
    super.setFieldsInBulk(fields, entities);
  }

  private void fetchAndSetServices(List<Query> queries) {
    if (queries == null || queries.isEmpty()) {
      return;
    }

    // Many queries already have service set from when they were created
    // For those that don't, we need to fetch it
    var queriesNeedingService = queries.stream().filter(q -> q.getService() == null).toList();

    if (!queriesNeedingService.isEmpty()) {
      // For queries, service information is stored differently
      // Query doesn't have a direct CONTAINS relationship with service
      // Instead, it has the service reference stored in its JSON
      queriesNeedingService.forEach(
          query -> {
            try {
              // The service should already be set in setFields for individual entities
              // This is a fallback for bulk operations
              var service =
                  Entity.getEntityReferenceByName(
                      Entity.DATABASE_SERVICE, query.getService().getName(), Include.NON_DELETED);
              query.withService(service);
            } catch (Exception e) {
              LOG.warn("Could not fetch service for query: {}", query.getId(), e);
            }
          });
    }
  }

  public List<EntityReference> getQueryUsage(Query queryEntity) {
    return queryEntity == null
        ? Collections.emptyList()
        : findFrom(queryEntity.getId(), Entity.QUERY, Relationship.MENTIONED_IN, null);
  }

  public List<EntityReference> getQueryUsers(Query queryEntity) {
    return queryEntity == null
        ? Collections.emptyList()
        : findFrom(queryEntity.getId(), Entity.QUERY, Relationship.USES, USER);
  }

  @Override
  @SneakyThrows
  public void prepare(Query entity, boolean update) {
    if (nullOrEmpty(entity.getName())) {
      String checkSum = EntityUtil.hash(entity.getQuery());
      entity.setChecksum(checkSum);
      entity.setName(checkSum);
    }
    entity.setUsers(EntityUtil.populateEntityReferences(entity.getUsers()));
    DatabaseService service = Entity.getEntity(entity.getService(), "", Include.ALL);
    entity.setService(service.getEntityReference());
  }

  @Override
  public void storeEntity(Query queryEntity, boolean update) {
    List<EntityReference> queryUsage = queryEntity.getQueryUsedIn();
    List<EntityReference> queryUsers = queryEntity.getUsers();
    queryEntity.withQueryUsedIn(null).withUsers(null);
    store(queryEntity, update);

    // Restore relationships
    queryEntity.withQueryUsedIn(queryUsage).withUsers(queryUsers);
  }

  @Override
  public void storeRelationships(Query queryEntity) {
    // Store Query Users Relation
    if (queryEntity.getUsers() != null) {
      for (EntityReference entityRef : queryEntity.getUsers()) {
        addRelationship(
            entityRef.getId(), queryEntity.getId(), USER, Entity.QUERY, Relationship.USES);
      }
    }

    // Store Query Used in Relation
    storeQueryUsedIn(queryEntity.getId(), queryEntity.getQueryUsedIn(), null);
    // The service contains the query
    addServiceRelationship(queryEntity, queryEntity.getService());
  }

  @Override
  public EntityRepository<Query>.EntityUpdater getUpdater(
      Query original, Query updated, Operation operation, ChangeSource changeSource) {
    return new QueryUpdater(original, updated, operation);
  }

  private void storeQueryUsedIn(
      UUID queryId, List<EntityReference> addQueryUsedIn, List<EntityReference> deleteQueryUsedIn) {
    for (EntityReference entityRef : listOrEmpty(addQueryUsedIn)) {
      addRelationship(
          entityRef.getId(), queryId, entityRef.getType(), Entity.QUERY, Relationship.MENTIONED_IN);
    }
    for (EntityReference entityRef : listOrEmpty(deleteQueryUsedIn)) {
      deleteRelationship(
          entityRef.getId(), entityRef.getType(), queryId, Entity.QUERY, Relationship.MENTIONED_IN);
    }
  }

  public RestUtil.PutResponse<?> addQueryUser(
      UriInfo uriInfo, String updatedBy, UUID queryId, List<String> userFqnList) {
    Query query = Entity.getEntity(Entity.QUERY, queryId, QUERY_USERS_FIELD, Include.NON_DELETED);
    List<EntityReference> oldValue = query.getUsers();

    for (String userFqn : userFqnList) {
      User user = Entity.getEntityByName(USER, userFqn, "", Include.NON_DELETED);
      EntityReference entityRef = user.getEntityReference();
      addRelationship(
          entityRef.getId(), queryId, entityRef.getType(), Entity.QUERY, Relationship.USES);
    }
    // Populate Fields
    setFieldsInternal(query, new EntityUtil.Fields(allowedFields, QUERY_USERS_FIELD));
    Entity.withHref(uriInfo, query.getUsers());
    ChangeEvent changeEvent =
        getQueryChangeEvent(
            updatedBy, QUERY_USERS_FIELD, oldValue, query.getUsers(), withHref(uriInfo, query));
    return new RestUtil.PutResponse<>(Response.Status.CREATED, changeEvent, ENTITY_FIELDS_CHANGED);
  }

  public RestUtil.PutResponse<?> addQueryUsedBy(
      UriInfo uriInfo, String updatedBy, UUID queryId, List<String> userList) {
    Query query = Entity.getEntity(Entity.QUERY, queryId, QUERY_UPDATE_FIELDS, Include.NON_DELETED);
    Query oldQuery = JsonUtils.readValue(JsonUtils.pojoToJson(query), Query.class);
    query.getUsedBy().addAll(userList);
    ChangeEvent changeEvent =
        getQueryChangeEvent(
            updatedBy,
            QUERY_USERS_FIELD,
            oldQuery.getUsedBy(),
            query.getUsers(),
            withHref(uriInfo, query));
    update(uriInfo, oldQuery, query, updatedBy);
    return new RestUtil.PutResponse<>(Response.Status.CREATED, changeEvent, ENTITY_FIELDS_CHANGED);
  }

  public RestUtil.PutResponse<?> addQueryUsage(
      UriInfo uriInfo, String updatedBy, UUID queryId, List<EntityReference> entityIds) {
    Query query = Entity.getEntity(Entity.QUERY, queryId, QUERY_USED_IN_FIELD, Include.NON_DELETED);
    List<EntityReference> oldValue = query.getQueryUsedIn();
    // Create Relationships
    entityIds.forEach(
        entityRef ->
            addRelationship(
                entityRef.getId(),
                queryId,
                entityRef.getType(),
                Entity.QUERY,
                Relationship.MENTIONED_IN));

    // Populate Fields
    setFieldsInternal(query, new EntityUtil.Fields(allowedFields, QUERY_USED_IN_FIELD));
    Entity.withHref(uriInfo, query.getQueryUsedIn());
    ChangeEvent changeEvent =
        getQueryChangeEvent(
            updatedBy,
            QUERY_USED_IN_FIELD,
            oldValue,
            query.getQueryUsedIn(),
            withHref(uriInfo, query));
    return new RestUtil.PutResponse<>(Response.Status.CREATED, changeEvent, ENTITY_FIELDS_CHANGED);
  }

  public RestUtil.PutResponse<?> removeQueryUsedIn(
      UriInfo uriInfo, String updatedBy, UUID queryId, List<EntityReference> entityIds) {
    Query query = Entity.getEntity(Entity.QUERY, queryId, QUERY_USED_IN_FIELD, Include.NON_DELETED);
    List<EntityReference> oldValue = query.getQueryUsedIn();

    for (EntityReference ref : entityIds) {
      deleteRelationship(
          ref.getId(), ref.getType(), queryId, Entity.QUERY, Relationship.MENTIONED_IN);
    }

    // Populate Fields
    setFieldsInternal(query, new EntityUtil.Fields(allowedFields, QUERY_USED_IN_FIELD));
    Entity.withHref(uriInfo, query.getQueryUsedIn());
    ChangeEvent changeEvent =
        getQueryChangeEvent(
            updatedBy,
            QUERY_USED_IN_FIELD,
            oldValue,
            query.getQueryUsedIn(),
            withHref(uriInfo, query));
    return new RestUtil.PutResponse<>(Response.Status.CREATED, changeEvent, ENTITY_FIELDS_CHANGED);
  }

  private ChangeEvent getQueryChangeEvent(
      String updatedBy, String fieldUpdated, Object oldValue, Object newValue, Query updatedQuery) {
    FieldChange fieldChange =
        new FieldChange().withName(fieldUpdated).withNewValue(newValue).withOldValue(oldValue);
    ChangeDescription change =
        new ChangeDescription().withPreviousVersion(updatedQuery.getVersion());
    change.getFieldsUpdated().add(fieldChange);
    return new ChangeEvent()
        .withId(UUID.randomUUID())
        .withEntity(updatedQuery)
        .withChangeDescription(change)
        .withEventType(ENTITY_UPDATED)
        .withEntityType(entityType)
        .withEntityId(updatedQuery.getId())
        .withEntityFullyQualifiedName(updatedQuery.getFullyQualifiedName())
        .withUserName(updatedBy)
        .withTimestamp(System.currentTimeMillis())
        .withCurrentVersion(updatedQuery.getVersion())
        .withPreviousVersion(updatedQuery.getVersion());
  }

  public class QueryUpdater extends EntityUpdater {
    public QueryUpdater(Query original, Query updated, Operation operation) {
      super(original, updated, operation);
    }

    @Transaction
    @Override
    public void entitySpecificUpdate(boolean consolidatingChanges) {
      updateFromRelationships(
          "users",
          USER,
          original.getUsers(),
          updated.getUsers() == null ? new ArrayList<>() : updated.getUsers(),
          Relationship.USES,
          Entity.QUERY,
          original.getId());
      List<EntityReference> added = new ArrayList<>();
      List<EntityReference> deleted = new ArrayList<>();
      recordListChange(
          "queryUsedIn",
          original.getQueryUsedIn(),
          updated.getQueryUsedIn(),
          added,
          deleted,
          EntityUtil.entityReferenceMatch);
      // Store processed Lineage
      recordChange(
          "processedLineage", original.getProcessedLineage(), updated.getProcessedLineage());
      // Store Query Used in Relation
      recordChange("usedBy", original.getUsedBy(), updated.getUsedBy(), true);
      storeQueryUsedIn(updated.getId(), added, deleted);
      // Query is a required field. Cannot be removed.
      if (updated.getQuery() != null) {
        String originalChecksum = EntityUtil.hash(original.getQuery());
        String updatedChecksum = EntityUtil.hash(updated.getQuery());
        if (!originalChecksum.equals(updatedChecksum)) {
          updated.setChecksum(updatedChecksum);
          recordChange("query", original.getQuery(), updated.getQuery());
          recordChange("checksum", original.getChecksum(), updated.getChecksum());
        }
      }
    }
  }
}
