package org.openmetadata.service.entity.cache;

import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.jdbi3.EntityDAO;

/** Supplies the canonical row DAO and schema type without coupling cache loaders to repositories. */
public interface EntityCacheSource {
  EntityDAO<? extends EntityInterface> getDao();

  Class<? extends EntityInterface> getEntityClass();
}
