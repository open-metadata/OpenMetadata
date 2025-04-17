package org.openmetadata.service.resources.services.database;

import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.service.mapper.EntityMapper;

public class DatabaseServiceMapper implements EntityMapper<DatabaseService, CreateDatabaseService> {
  @Override
  public DatabaseService createToEntity(CreateDatabaseService create, String user) {
    return copy(new DatabaseService(), create, user)
        .withServiceType(create.getServiceType())
        .withConnection(create.getConnection())
        .withIngestionRunner(create.getIngestionRunner());
  }
}
