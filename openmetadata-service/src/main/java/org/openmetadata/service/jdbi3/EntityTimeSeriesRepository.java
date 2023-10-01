package org.openmetadata.service.jdbi3;

import java.util.UUID;
import lombok.Getter;
import org.openmetadata.schema.EntityTimeSeriesInterface;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.util.JsonUtils;

@Repository
public abstract class EntityTimeSeriesRepository<T extends EntityTimeSeriesInterface> {
  @Getter protected final String collectionPath;
  @Getter protected final EntityTimeSeriesDAO timeSeriesDao;
  @Getter protected final CollectionDAO daoCollection;
  @Getter protected final SearchRepository searchRepository;
  @Getter protected final String entityType;
  @Getter protected final Class<T> entityClass;

  protected boolean supportsSearchIndex = true;

  protected EntityTimeSeriesRepository(
      String collectionPath,
      CollectionDAO daoCollection,
      EntityTimeSeriesDAO timeSeriesDao,
      SearchRepository searchRepository,
      Class<T> entityClass,
      String entityType) {
    this.collectionPath = collectionPath;
    this.timeSeriesDao = timeSeriesDao;
    this.daoCollection = daoCollection;
    this.searchRepository = searchRepository;
    this.entityClass = entityClass;
    this.entityType = entityType;
    Entity.registerEntity(entityClass, entityType, this);
  }

  public T createNewRecord(T entity, String extension, String recordFQN) {
    entity.setId(UUID.randomUUID());
    timeSeriesDao.insert(recordFQN, extension, entityType, JsonUtils.pojoToJson(entity));
    postCreate(entity);
    return entity;
  }

  protected void postCreate(T entity) {
    if (supportsSearchIndex) {
      searchRepository.createTimeSeriesEntity(JsonUtils.deepCopy(entity, entityClass));
    }
  }
}
