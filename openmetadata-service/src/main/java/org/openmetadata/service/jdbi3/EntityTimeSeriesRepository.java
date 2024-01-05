package org.openmetadata.service.jdbi3;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.Getter;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.EntityTimeSeriesInterface;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.ResultList;

@Repository
public abstract class EntityTimeSeriesRepository<T extends EntityTimeSeriesInterface> {
  @Getter protected final String collectionPath;
  @Getter protected final EntityTimeSeriesDAO timeSeriesDao;
  @Getter protected final SearchRepository searchRepository;
  @Getter protected final String entityType;
  @Getter protected final Class<T> entityClass;
  @Getter protected final CollectionDAO daoCollection;

  protected EntityTimeSeriesRepository(
      String collectionPath,
      EntityTimeSeriesDAO timeSeriesDao,
      Class<T> entityClass,
      String entityType) {
    this.collectionPath = collectionPath;
    this.timeSeriesDao = timeSeriesDao;
    this.entityClass = entityClass;
    this.entityType = entityType;
    this.searchRepository = Entity.getSearchRepository();
    this.daoCollection = Entity.getCollectionDAO();
    Entity.registerEntity(entityClass, entityType, this);
  }

  @Transaction
  public T createNewRecord(T recordEntity, String extension, String recordFQN) {
    recordEntity.setId(UUID.randomUUID());
    if (extension != null) {
      timeSeriesDao.insert(recordFQN, extension, entityType, JsonUtils.pojoToJson(recordEntity));
    } else {
      timeSeriesDao.insert(recordFQN, entityType, JsonUtils.pojoToJson(recordEntity));
    }
    postCreate(recordEntity);
    return recordEntity;
  }

  protected void postCreate(T entity) {
    searchRepository.createTimeSeriesEntity(JsonUtils.deepCopy(entity, entityClass));
  }

  public final ResultList<T> getResultList(
      List<T> entities, String beforeCursor, String afterCursor, int total) {
    return new ResultList<>(entities, beforeCursor, afterCursor, total);
  }

  /**
   * Forward paginate a list of entities ordered and paginated by timestamp
   *
   * @return ResultList
   */
  protected ResultList<T> listWithOffset(
      String offset, ListFilter filter, int limitParam, Long startTs, Long endTs, boolean latest) {
    int total = timeSeriesDao.listCount(filter, startTs, endTs, latest);
    List<T> entityList = new ArrayList<>();

    int offsetInt = offset != null ? Integer.parseInt(RestUtil.decodeCursor(offset)) : 0;
    int afterOffsetInt = offsetInt + limitParam;
    int beforeOffsetInt = offsetInt - limitParam;

    // If offset is negative, then set it to 0 if you pass offset 4 and limit 10, then the previous
    // page will be at offset 0
    if (beforeOffsetInt < 0) beforeOffsetInt = 0;

    // if offsetInt is 0 (i.e. either no offset or offset is 0), then set it to null as there is no
    // previous page
    String beforeOffset = (offsetInt == 0) ? null : String.valueOf(beforeOffsetInt);

    // If afterOffset is greater than total, then set it to null to indicate end of list
    String afterOffset = afterOffsetInt >= total ? null : String.valueOf(afterOffsetInt);

    if (limitParam > 0) {
      List<String> jsons =
          timeSeriesDao.listWithOffset(filter, limitParam, offsetInt, startTs, endTs, latest);

      for (String json : jsons) {
        T entity = JsonUtils.readValue(json, entityClass);
        entityList.add(entity);
      }
      return getResultList(entityList, beforeOffset, afterOffset, total);
    } else {
      return getResultList(entityList, null, null, total);
    }
  }

  public ResultList<T> list(
      String offset, Long startTs, Long endTs, int limitParam, ListFilter filter, boolean latest) {
    return listWithOffset(offset, filter, limitParam, startTs, endTs, latest);
  }

  public T getLatestRecord(String recordFQN) {
    String jsonRecord = timeSeriesDao.getLatestRecord(recordFQN);
    if (jsonRecord == null) {
      return null;
    }
    return JsonUtils.readValue(jsonRecord, entityClass);
  }

  public T getById(UUID id) {
    String jsonRecord = timeSeriesDao.getById(id);
    if (jsonRecord == null) {
      return null;
    }
    return JsonUtils.readValue(jsonRecord, entityClass);
  }
}
