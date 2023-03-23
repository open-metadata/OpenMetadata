package org.openmetadata.service.jdbi3;

import static org.openmetadata.service.Entity.FIELD_FOLLOWERS;
import static org.openmetadata.service.Entity.USER;

import java.io.IOException;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import lombok.SneakyThrows;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.entity.data.Query;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.query.QueryResource;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.QueryUtil;

public class QueryRepository extends EntityRepository<Query> {
  private static final String QUERY_PATCH_FIELDS = "owner,tags,users,followers";
  private static final String QUERY_UPDATE_FIELDS = "owner,tags,users,votes,followers";

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
  public Query setFields(Query entity, EntityUtil.Fields fields) throws IOException {
    entity.setFollowers(fields.contains(FIELD_FOLLOWERS) ? getFollowers(entity) : null);
    entity.setVotes(fields.contains("votes") ? this.getVotes(entity) : null);
    entity.setQueryUsedIn(fields.contains("queryUsedIn") ? this.getQueryUsage(entity) : null);
    entity.setUsers(fields.contains("users") ? this.getQueryUsers(entity) : null);
    return entity;
  }

  public List<EntityReference> getQueryUsage(Query queryEntity) throws IOException {
    if (queryEntity == null) {
      return Collections.emptyList();
    }
    // null means it will find all the relationships to Query from any entity type
    List<CollectionDAO.EntityRelationshipRecord> records =
        findFrom(queryEntity.getId(), Entity.QUERY, Relationship.MENTIONED_IN, null);

    return EntityUtil.getEntityReferences(records);
  }

  public List<EntityReference> getQueryUsers(Query queryEntity) throws IOException {
    if (queryEntity == null) {
      return Collections.emptyList();
    }
    List<CollectionDAO.EntityRelationshipRecord> records =
        findFrom(queryEntity.getId(), Entity.QUERY, Relationship.USES, USER);
    return EntityUtil.populateEntityReferences(records, USER);
  }

  @Override
  @SneakyThrows
  public void prepare(Query entity) throws IOException {
    if (CommonUtil.nullOrEmpty(entity.getName())) {
      String checkSum = QueryUtil.getCheckSum(entity.getQuery());
      entity.setChecksum(checkSum);
      entity.setName(checkSum);
    }

    entity.setUsers(EntityUtil.populateEntityReferences(entity.getUsers()));
  }

  @Override
  public void storeEntity(Query queryEntity, boolean update) throws IOException {
    EntityReference owner = queryEntity.getOwner();
    List<EntityReference> queryUsage = queryEntity.getQueryUsedIn();
    List<EntityReference> queryUsers = queryEntity.getUsers();
    queryEntity.withQueryUsedIn(null).withOwner(null).withFollowers(null).withUsers(null);
    store(queryEntity, update);

    // Restore relationships
    queryEntity.withQueryUsedIn(queryUsage).withOwner(owner).withUsers(queryUsers);
  }

  @Override
  public void storeRelationships(Query queryEntity) throws IOException {
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

    // Add table owner relationship
    storeOwner(queryEntity, queryEntity.getOwner());

    // Add tag to table relationship
    applyTags(queryEntity);
  }

  @Override
  public EntityUpdater getUpdater(Query original, Query updated, Operation operation) {
    return new QueryUpdater(original, updated, operation);
  }

  public Query addQueryUsage(UUID queryId, List<EntityReference> entityIds) throws IOException {
    Query query = Entity.getEntity(Entity.QUERY, queryId, "queryUsedIn", Include.NON_DELETED);
    entityIds.forEach(
        (entityRef) ->
            addRelationship(entityRef.getId(), queryId, entityRef.getType(), Entity.QUERY, Relationship.MENTIONED_IN));
    query.getQueryUsedIn().addAll(entityIds);
    return query;
  }

  public Query removeQueryUsedIn(UUID queryId, List<EntityReference> entityIds) throws IOException {
    Query query = Entity.getEntity(Entity.QUERY, queryId, "queryUsedIn", Include.NON_DELETED);
    for (EntityReference ref : entityIds) {
      deleteTo(queryId, Entity.QUERY, Relationship.MENTIONED_IN, ref.getType());
    }
    // TODO:
    return query;
  }

  public class QueryUpdater extends EntityUpdater {
    public QueryUpdater(Query original, Query updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate() throws IOException {
      updateFromRelationships(
          "users", USER, original.getUsers(), updated.getUsers(), Relationship.USES, Entity.QUERY, original.getId());
    }
  }
}
