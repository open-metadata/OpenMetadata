package org.openmetadata.service.resources.databases;

import static org.openmetadata.service.util.EntityUtil.getEntityReference;

import org.openmetadata.schema.api.data.CreateStoredProcedure;
import org.openmetadata.schema.entity.data.StoredProcedure;
import org.openmetadata.service.Entity;
import org.openmetadata.service.mapper.EntityMapper;

public class StoredProcedureMapper implements EntityMapper<StoredProcedure, CreateStoredProcedure> {
  @Override
  public StoredProcedure createToEntity(CreateStoredProcedure create, String user) {
    return copy(new StoredProcedure(), create, user)
        .withDatabaseSchema(getEntityReference(Entity.DATABASE_SCHEMA, create.getDatabaseSchema()))
        .withStoredProcedureCode(create.getStoredProcedureCode())
        .withStoredProcedureType(create.getStoredProcedureType())
        .withSourceUrl(create.getSourceUrl())
        .withSourceHash(create.getSourceHash());
  }
}
