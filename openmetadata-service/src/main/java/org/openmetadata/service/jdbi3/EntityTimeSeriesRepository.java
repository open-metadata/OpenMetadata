package org.openmetadata.service.jdbi3;

import static org.openmetadata.service.resources.EntityResource.searchRepository;

import java.util.UUID;
import lombok.Getter;
import org.openmetadata.schema.EntityTimeSeriesInterface;
import org.openmetadata.service.util.JsonUtils;

public class EntityTimeSeriesRepository<T extends EntityTimeSeriesInterface> {
  @Getter protected final String collectionPath;
  @Getter protected final EntityTimeSeriesDAO timeSeriesDao;
  @Getter protected final CollectionDAO daoCollection;
  @Getter protected final String entityType;
  @Getter protected final Class<T> entityClass;

  protected boolean supportsSearchIndex = true;

  protected EntityTimeSeriesRepository(
      String collectionPath,
      CollectionDAO daoCollection,
      EntityTimeSeriesDAO timeSeriesDao,
      Class<T> entityClass,
      String entityType) {
    this.collectionPath = collectionPath;
    this.timeSeriesDao = timeSeriesDao;
    this.daoCollection = daoCollection;
    this.entityClass = entityClass;
    this.entityType = entityType;
  }

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
