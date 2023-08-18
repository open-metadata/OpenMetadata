package org.openmetadata.service.jdbi3;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.Entity.USER;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.UriInfo;
import lombok.SneakyThrows;
import org.openmetadata.schema.entity.data.Query;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.query.QueryResource;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.RestUtil;

public class QueryRepository extends EntityRepository<Query> {
  private static final String QUERY_USED_IN_FIELD = "queryUsedIn";
  private static final String QUERY_PATCH_FIELDS = "users,query,queryUsedIn";
  private static final String QUERY_UPDATE_FIELDS = "users,votes,queryUsedIn";

  public QueryRepository(CollectionDAO dao) {
    super(
        QueryResource.COLLECTION_PATH,
        Entity.QUERY,
        Query.class,
        dao.queryDAO(),
        dao,
        QUERY_PATCH_FIELDS,
        QUERY_UPDATE_FIELDS);
  }

  @Override
  public Query setFields(Query entity, EntityUtil.Fields fields) {
    entity.setVotes(fields.contains("votes") ? getVotes(entity) : entity.getVotes());
    entity.setQueryUsedIn(fields.contains(QUERY_USED_IN_FIELD) ? getQueryUsage(entity) : entity.getQueryUsedIn());
    return entity.withUsers(fields.contains("users") ? getQueryUsers(entity) : entity.getUsers());
  }

  @Override
  public Query clearFields(Query entity, EntityUtil.Fields fields) {
    entity.withVotes(fields.contains("votes") ? entity.getVotes() : null);
    entity.withQueryUsedIn(fields.contains(QUERY_USED_IN_FIELD) ? entity.getQueryUsedIn() : null);
    return entity.withUsers(fields.contains("users") ? this.getQueryUsers(entity) : null);
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
  public void prepare(Query entity) {
    if (nullOrEmpty(entity.getName())) {
      String checkSum = EntityUtil.hash(entity.getQuery());
      entity.setChecksum(checkSum);
      entity.setName(checkSum);
    }
    entity.setUsers(EntityUtil.populateEntityReferences(entity.getUsers()));
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
        addRelationship(entityRef.getId(), queryEntity.getId(), USER, Entity.QUERY, Relationship.USES);
      }
    }

    // Store Query Used in Relation
    if (queryEntity.getQueryUsedIn() != null) {
      for (EntityReference entityRef : queryEntity.getQueryUsedIn()) {
        addRelationship(
            entityRef.getId(), queryEntity.getId(), entityRef.getType(), Entity.QUERY, Relationship.MENTIONED_IN);
      }
    }
  }

  @Override
  public EntityUpdater getUpdater(Query original, Query updated, Operation operation) {
    return new QueryUpdater(original, updated, operation);
  }

  public RestUtil.PutResponse<?> addQueryUsage(
      UriInfo uriInfo, String updatedBy, UUID queryId, List<EntityReference> entityIds) {
    Query query = Entity.getEntity(Entity.QUERY, queryId, QUERY_USED_IN_FIELD, Include.NON_DELETED);
    List<EntityReference> oldValue = query.getQueryUsedIn();
    // Create Relationships
    entityIds.forEach(
        entityRef ->
            addRelationship(entityRef.getId(), queryId, entityRef.getType(), Entity.QUERY, Relationship.MENTIONED_IN));

    // Populate Fields
    setFieldsInternal(query, new EntityUtil.Fields(allowedFields, QUERY_USED_IN_FIELD));
    Entity.withHref(uriInfo, query.getQueryUsedIn());
    ChangeEvent changeEvent =
        getQueryChangeEvent(updatedBy, QUERY_USED_IN_FIELD, oldValue, query.getQueryUsedIn(), withHref(uriInfo, query));
    return new RestUtil.PutResponse<>(Response.Status.CREATED, changeEvent, RestUtil.ENTITY_FIELDS_CHANGED);
  }

  public RestUtil.PutResponse<?> removeQueryUsedIn(
      UriInfo uriInfo, String updatedBy, UUID queryId, List<EntityReference> entityIds) {
    Query query = Entity.getEntity(Entity.QUERY, queryId, QUERY_USED_IN_FIELD, Include.NON_DELETED);
    List<EntityReference> oldValue = query.getQueryUsedIn();

    for (EntityReference ref : entityIds) {
      deleteRelationship(ref.getId(), ref.getType(), queryId, Entity.QUERY, Relationship.MENTIONED_IN);
    }

    // Populate Fields
    setFieldsInternal(query, new EntityUtil.Fields(allowedFields, QUERY_USED_IN_FIELD));
    Entity.withHref(uriInfo, query.getQueryUsedIn());
    ChangeEvent changeEvent =
        getQueryChangeEvent(updatedBy, QUERY_USED_IN_FIELD, oldValue, query.getQueryUsedIn(), withHref(uriInfo, query));
    return new RestUtil.PutResponse<>(Response.Status.CREATED, changeEvent, RestUtil.ENTITY_FIELDS_CHANGED);
  }

  private ChangeEvent getQueryChangeEvent(
      String updatedBy, String fieldUpdated, Object oldValue, Object newValue, Query updatedQuery) {
    FieldChange fieldChange = new FieldChange().withName(fieldUpdated).withNewValue(newValue).withOldValue(oldValue);
    ChangeDescription change = new ChangeDescription().withPreviousVersion(updatedQuery.getVersion());
    change.getFieldsUpdated().add(fieldChange);
    return new ChangeEvent()
        .withEntity(updatedQuery)
        .withChangeDescription(change)
        .withEventType(EventType.ENTITY_UPDATED)
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

    @Override
    public void entitySpecificUpdate() {
      updateFromRelationships(
          "users", USER, original.getUsers(), updated.getUsers(), Relationship.USES, Entity.QUERY, original.getId());
      List<EntityReference> added = new ArrayList<>();
      List<EntityReference> deleted = new ArrayList<>();
      recordListChange(
          "queryUsedIn",
          original.getQueryUsedIn(),
          updated.getQueryUsedIn(),
          added,
          deleted,
          EntityUtil.entityReferenceMatch);
      String originalChecksum = EntityUtil.hash(original.getQuery());
      String updatedChecksum = EntityUtil.hash(updated.getQuery());
      if (!originalChecksum.equals(updatedChecksum)) {
        recordChange("query", original.getQuery(), updated.getQuery());
        recordChange("checkSum", original.getChecksum(), updatedChecksum);
      }
    }
  }
}
