package org.openmetadata.service.resources.databases;

import static org.openmetadata.service.util.EntityUtil.getEntityReference;

import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.service.Entity;
import org.openmetadata.service.mapper.EntityMapper;

public class DatabaseSchemaMapper implements EntityMapper<DatabaseSchema, CreateDatabaseSchema> {
  @Override
  public DatabaseSchema createToEntity(CreateDatabaseSchema create, String user) {
    return copy(new DatabaseSchema(), create, user)
        .withDatabase(getEntityReference(Entity.DATABASE, create.getDatabase()))
        .withSourceUrl(create.getSourceUrl())
        .withRetentionPeriod(create.getRetentionPeriod())
        .withSourceHash(create.getSourceHash());
  }
}
