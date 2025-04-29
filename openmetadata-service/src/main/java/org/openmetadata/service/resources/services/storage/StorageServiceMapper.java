package org.openmetadata.service.resources.services.storage;

import org.openmetadata.schema.api.services.CreateStorageService;
import org.openmetadata.schema.entity.services.StorageService;
import org.openmetadata.service.mapper.EntityMapper;

public class StorageServiceMapper implements EntityMapper<StorageService, CreateStorageService> {
  @Override
  public StorageService createToEntity(CreateStorageService create, String user) {
    return copy(new StorageService(), create, user)
        .withServiceType(create.getServiceType())
        .withConnection(create.getConnection())
        .withIngestionRunner(create.getIngestionRunner());
  }
}
