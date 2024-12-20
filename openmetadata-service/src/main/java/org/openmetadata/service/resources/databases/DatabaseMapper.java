package org.openmetadata.service.resources.databases;

import static org.openmetadata.service.util.EntityUtil.getEntityReference;

import org.openmetadata.schema.api.data.CreateDatabase;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.service.Entity;
import org.openmetadata.service.mapper.EntityMapper;

public class DatabaseMapper implements EntityMapper<Database, CreateDatabase> {
  @Override
  public Database createToEntity(CreateDatabase create, String user) {
    return copy(new Database(), create, user)
        .withService(getEntityReference(Entity.DATABASE_SERVICE, create.getService()))
        .withSourceUrl(create.getSourceUrl())
        .withRetentionPeriod(create.getRetentionPeriod())
        .withSourceHash(create.getSourceHash());
  }
}
