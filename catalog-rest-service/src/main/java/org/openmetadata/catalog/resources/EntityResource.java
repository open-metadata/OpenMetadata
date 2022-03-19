package org.openmetadata.catalog.resources;

import java.util.List;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.jdbi3.EntityRepository;

public class EntityResource<T, K extends EntityRepository<T>> {
  protected final List<String> allowedFields;

  public EntityResource(Class<T> entityClass, EntityRepository<T> repository) {
    allowedFields = Entity.getEntityFields(entityClass);
  }
}
