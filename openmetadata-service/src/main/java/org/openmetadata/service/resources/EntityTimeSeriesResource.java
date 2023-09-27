package org.openmetadata.service.resources;

import java.io.IOException;
import java.lang.reflect.InvocationTargetException;
import java.util.List;
import javax.ws.rs.core.Response;
import lombok.Getter;
import org.openmetadata.schema.EntityTimeSeriesInterface;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.jdbi3.EntityTimeSeriesRepository;
import org.openmetadata.service.search.IndexUtil;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.security.Authorizer;

public class EntityTimeSeriesResource<T extends EntityTimeSeriesInterface, K extends EntityTimeSeriesRepository<T>> {
  protected final Class<T> entityClass;
  protected final String entityType;
  @Getter protected final K repository;
  protected final Authorizer authorizer;
  public static SearchRepository searchRepository;
  public static ElasticSearchConfiguration esConfig;

  protected EntityTimeSeriesResource(Class<T> entityClass, K repository, Authorizer authorizer) {
    entityType = entityClass.getTypeName();
    this.entityClass = entityClass;
    this.repository = repository;
    this.authorizer = authorizer;
    Entity.registerEntity(entityClass, entityType, repository, getEntitySpecificOperations());
  }

  public void initialize(OpenMetadataApplicationConfig config)
      throws IOException, ClassNotFoundException, NoSuchMethodException, InvocationTargetException,
          InstantiationException, IllegalAccessException {
    esConfig = config.getElasticSearchConfiguration();
    searchRepository = IndexUtil.getSearchClient(esConfig, repository.getDaoCollection());
    // Nothing to do in the default implementation
  }

  protected Response create(T entity, String extension, String recordFQN) {
    entity = repository.createNewRecord(entity, extension, recordFQN);
    return Response.ok(entity).build();
  }

  protected List<MetadataOperation> getEntitySpecificOperations() {
    return null;
  }
}
