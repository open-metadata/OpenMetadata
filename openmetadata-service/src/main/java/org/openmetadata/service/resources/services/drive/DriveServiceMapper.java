package org.openmetadata.service.resources.services.drive;

import org.openmetadata.schema.api.services.CreateDriveService;
import org.openmetadata.schema.entity.services.DriveService;
import org.openmetadata.service.Entity;
import org.openmetadata.service.mapper.EntityMapper;
import org.openmetadata.service.mapper.Mapper;

@Mapper(entityType = Entity.DRIVE_SERVICE)
public class DriveServiceMapper implements EntityMapper<DriveService, CreateDriveService> {
  @Override
  public DriveService createToEntity(CreateDriveService create, String user) {
    return copy(new DriveService(), create, user)
        .withServiceType(create.getServiceType())
        .withConnection(create.getConnection())
        .withIngestionRunner(create.getIngestionRunner());
  }
}
