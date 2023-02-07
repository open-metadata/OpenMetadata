package org.openmetadata.service.jdbi3;

import org.apache.commons.codec.binary.Hex;
import org.openmetadata.schema.entity.data.Query;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.query.QueryResource;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.ResultList;

import java.io.IOException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.List;

public class QueryRepository extends EntityRepository<Query> {

  private static final String QUERY_PATCH_FIELDS = "";
  private static final String QUERY_UPDATE_FIELDS = "";

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
    return entity;
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
    store(entity, update);
  }

  @Override
  public void setFullyQualifiedName(Query entity) {
    entity.setFullyQualifiedName(FullyQualifiedName.add(entity.getChecksum(), entity.getName()));
  }

  @Override
  public void storeRelationships(Query entity) throws IOException {}

  public ResultList<Query> listQueriesByEntityId(String id, String before, String after, int limit) {
    RestUtil.validateCursors(before, after);
    int totalQueryCount = daoCollection.queryDao().listQueryCount(id, Entity.QUERY, Relationship.HAS.ordinal());
    List<CollectionDAO.QueryList> queryList;
    if (before != null) {
      queryList =
          daoCollection
              .queryDao()
              .listBeforeQueriesByEntityId(id, Entity.QUERY, RestUtil.decodeCursor(before), limit + 1, Relationship.HAS.ordinal());
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
}
