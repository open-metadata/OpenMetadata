package org.openmetadata.service.jdbi3;

import java.io.IOException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import org.apache.commons.codec.binary.Hex;
import org.openmetadata.schema.entity.data.Query;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.query.QueryResource;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.ResultList;

public class QueryRepository extends EntityRepository<Query> {

  private static final String QUERY_PATCH_FIELDS = "vote,queryUsage";
  private static final String QUERY_UPDATE_FIELDS = "vote,queryUsage";

  public QueryRepository(CollectionDAO dao) {
    super(
        QueryResource.COLLECTION_PATH,
        Entity.QUERY,
        Query.class,
        dao.queryDao(),
        dao,
        QUERY_PATCH_FIELDS,
        QUERY_UPDATE_FIELDS);
  }

  @Override
  public Query setFields(Query entity, EntityUtil.Fields fields) throws IOException {
    entity.setQueryUsage(fields.contains("queryUsage") ? this.getQueryUsage(entity) : null);
    return entity;
  }

  public List<EntityReference> getQueryUsage(Query entity) throws IOException {
    if (entity == null) {
      return Collections.emptyList();
    }
    List<EntityReference> queryUsage = new ArrayList<>();
    List<CollectionDAO.EntityRelationshipRecord> records =
        findFrom(entity.getId(), Entity.QUERY, Relationship.HAS, entity.getEntityName());
    for (CollectionDAO.EntityRelationshipRecord record : records) {
      EntityReference entityReference = new EntityReference();
      entityReference.setId(record.getId());
      entityReference.setType(record.getType());
      queryUsage.add(entityReference);
    }
    return queryUsage;
  }

  @Override
  public void prepare(Query entity) throws IOException {
    try {
      byte[] checksum = MessageDigest.getInstance("MD5").digest(entity.getQuery().getBytes());
      entity.setChecksum(Hex.encodeHexString(checksum));
    } catch (NoSuchAlgorithmException e) {
      throw new RuntimeException(e);
    }
  }

  @Override
  public void storeEntity(Query entity, boolean update) throws IOException {
    List<EntityReference> queryUsage = entity.getQueryUsage();
    entity.withQueryUsage(null);
    store(entity, update);
    entity.withQueryUsage(queryUsage);
  }

  @Override
  public void setFullyQualifiedName(Query entity) {
    entity.setFullyQualifiedName(entity.getName() + "_" + entity.getChecksum());
  }

  @Override
  public void storeRelationships(Query entity) throws IOException {
    if (entity.getQueryUsage() != null) {
      for (EntityReference entityId : entity.getQueryUsage()) {
        addRelationship(entityId.getId(), entity.getId(), entityId.getType(), Entity.QUERY, Relationship.HAS);
      }
    }
  }

  @Override
  public EntityUpdater getUpdater(Query original, Query updated, Operation operation) {
    return new QueryUpdater(original, updated, operation);
  }

  public class QueryUpdater extends EntityUpdater {
    public QueryUpdater(Query original, Query updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate() throws IOException {
      recordChange("vote", original.getVote(), updated.getVote());
      recordChange("queryUsage", original.getQueryUsage(), updated.getQueryUsage());
    }
  }

  public ResultList<Query> listQueriesByEntityId(String id, String before, String after, int limit) {
    RestUtil.validateCursors(before, after);
    int totalQueryCount = daoCollection.queryDao().listQueryCount(id, Entity.QUERY, Relationship.HAS.ordinal());
    List<CollectionDAO.QueryList> queryList;
    if (before != null) {
      queryList =
          daoCollection
              .queryDao()
              .listBeforeQueriesByEntityId(
                  id, Entity.QUERY, RestUtil.decodeCursor(before), limit + 1, Relationship.HAS.ordinal());
    } else {
      queryList =
          daoCollection
              .queryDao()
              .listAfterQueriesByEntityId(
                  id,
                  Entity.QUERY,
                  after == null ? "" : RestUtil.decodeCursor(after),
                  limit + 1,
                  Relationship.HAS.ordinal());
    }
    ResultList<Query> queryResultList;
    if (before != null) {
      queryResultList = listBeforeQueries(queryList, limit, totalQueryCount);
    } else {
      queryResultList = listAfterQueries(after, queryList, limit, totalQueryCount);
    }
    return queryResultList;
  }

  private ResultList<Query> listBeforeQueries(List<CollectionDAO.QueryList> queryList, int limit, int total) {
    String beforeCursor = null;
    String afterCursor;
    if (queryList.size() > limit) { // If extra result exists, then previous page exists - return before cursor
      queryList.remove(0);
      beforeCursor = queryList.get(0).getFqn();
    }
    afterCursor = queryList.get(queryList.size() - 1).getFqn();
    List<Query> queries = new ArrayList<>();
    for (CollectionDAO.QueryList queryRow : queryList) {
      queries.add(queryRow.getQuery());
    }
    return new ResultList<>(queries, beforeCursor, afterCursor, total);
  }

  private ResultList<Query> listAfterQueries(
      String after, List<CollectionDAO.QueryList> queryList, int limit, int total) {
    String beforeCursor;
    String afterCursor = null;
    beforeCursor = after == null ? null : queryList.get(0).getFqn();
    if (queryList.size() > limit) { // If extra result exists, then next page exists - return after cursor
      queryList.remove(limit);
      afterCursor = queryList.get(limit - 1).getFqn();
    }
    List<Query> queries = new ArrayList<>();
    for (CollectionDAO.QueryList queryRow : queryList) {
      queries.add(queryRow.getQuery());
    }
    return new ResultList<>(queries, beforeCursor, afterCursor, total);
  }

  public Query addQueryUsage(UUID queryId, List<EntityReference> entityIds) throws IOException {
    Query query = Entity.getEntity(Entity.QUERY, queryId, "queryUsage", Include.NON_DELETED);
    for (EntityReference entityId : entityIds) {
      if (!query.getQueryUsage().contains(entityId.getId())) {
        addRelationship(entityId.getId(), queryId, entityId.getType(), Entity.QUERY, Relationship.HAS);
      }
    }
    return query.withQueryUsage(entityIds);
  }
}
