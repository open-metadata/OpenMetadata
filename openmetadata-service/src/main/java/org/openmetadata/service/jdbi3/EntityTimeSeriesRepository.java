package org.openmetadata.service.jdbi3;

import java.util.UUID;
import lombok.Getter;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.EntityTimeSeriesInterface;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.util.JsonUtils;

@Repository
public abstract class EntityTimeSeriesRepository<T extends EntityTimeSeriesInterface> {
  @Getter protected final String collectionPath;
  @Getter protected final EntityTimeSeriesDAO timeSeriesDao;
  @Getter protected final SearchRepository searchRepository;
  @Getter protected final String entityType;
  @Getter protected final Class<T> entityClass;

  protected final boolean supportsSearchIndex = true;

  protected EntityTimeSeriesRepository(
      String collectionPath, EntityTimeSeriesDAO timeSeriesDao, Class<T> entityClass, String entityType) {
    this.collectionPath = collectionPath;
    this.timeSeriesDao = timeSeriesDao;
    this.entityClass = entityClass;
    this.entityType = entityType;
    this.searchRepository = Entity.getSearchRepository();
    Entity.registerEntity(entityClass, entityType, this);
  }

  @Transaction
  public T createNewRecord(T record, String extension, String recordFQN) {
    record.setId(UUID.randomUUID());
    timeSeriesDao.insert(recordFQN, extension, entityType, JsonUtils.pojoToJson(record));
    postCreate(record);
    return record;
  }

  protected void postCreate(T entity) {
    if (supportsSearchIndex) {
      searchRepository.createTimeSeriesEntity(JsonUtils.deepCopy(entity, entityClass));
    }
  }
}
