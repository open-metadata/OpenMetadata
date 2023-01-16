package org.openmetadata.service.jdbi3;

import java.io.IOException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.List;
import org.apache.commons.codec.binary.Hex;
import org.openmetadata.schema.entity.data.Query;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.query.QueryResource;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.ResultList;

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

  public ResultList<Query> getQueriesByEntityId(String id, String before, String after, int limit) {
    RestUtil.validateCursors(before, after);
    int totalQueryCount = daoCollection.queryDao().listQueryCount(id, Entity.QUERY, Relationship.HAS.ordinal());
    List<CollectionDAO.QueryList> queries;
    if (before != null) {
      queries =
          daoCollection
              .queryDao()
              .getBeforeQueries(id, Entity.QUERY, RestUtil.decodeCursor(before), limit + 1, Relationship.HAS.ordinal());
    } else {
      queries =
          daoCollection
              .queryDao()
              .getAfterQueries(
                  id,
                  Entity.QUERY,
                  after == null ? "" : RestUtil.decodeCursor(after),
                  limit + 1,
                  Relationship.HAS.ordinal());
    }
    ResultList<Query> QueryResultList;
    if (before != null) {
      QueryResultList = getBeforeQueriesList(queries, limit, totalQueryCount);
    } else {
      QueryResultList = getAfterQueriesList(after, queries, limit, totalQueryCount);
    }
    return QueryResultList;
  }

  private ResultList<Query> getBeforeQueriesList(List<CollectionDAO.QueryList> tableQueries, int limit, int total) {
    String beforeCursor = null;
    String afterCursor;
    if (tableQueries.size() > limit) { // If extra result exists, then previous page exists - return before cursor
      tableQueries.remove(0);
      beforeCursor = tableQueries.get(0).getFqn();
    }
    afterCursor = tableQueries.get(tableQueries.size() - 1).getFqn();
    List<Query> queries = new ArrayList<>();
    for (CollectionDAO.QueryList queryRow : tableQueries) {
      queries.add(queryRow.getQuery());
    }
    return new ResultList<>(queries, beforeCursor, afterCursor, total);
  }

  private ResultList<Query> getAfterQueriesList(
      String after, List<CollectionDAO.QueryList> tableQueries, int limit, int total) {
    String beforeCursor;
    String afterCursor = null;
    beforeCursor = after == null ? null : tableQueries.get(0).getFqn();
    if (tableQueries.size() > limit) { // If extra result exists, then next page exists - return after cursor
      tableQueries.remove(limit);
      afterCursor = tableQueries.get(limit - 1).getFqn();
    }
    List<Query> queries = new ArrayList<>();
    for (CollectionDAO.QueryList queryRow : tableQueries) {
      queries.add(queryRow.getQuery());
    }
    return new ResultList<>(queries, beforeCursor, afterCursor, total);
  }
}
