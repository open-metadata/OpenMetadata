package org.openmetadata.service.mapper;

import java.util.UUID;
import org.openmetadata.schema.EntityTimeSeriesInterface;

public interface EntityTimeSeriesMapper<T extends EntityTimeSeriesInterface, C> {
  default T copy(Class<T> entityClass) {
    try {
      T entity = entityClass.getDeclaredConstructor().newInstance();
      entity.setId(UUID.randomUUID());
      return entity;
    } catch (Exception e) {
      throw new RuntimeException(
          "Failed to instantiate entity of type " + entityClass.getName(), e);
    }
  }

  T createToEntity(C create, String user);
}
