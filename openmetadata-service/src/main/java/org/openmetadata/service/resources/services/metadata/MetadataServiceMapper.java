package org.openmetadata.service.resources.services.metadata;

import org.openmetadata.schema.api.services.CreateMetadataService;
import org.openmetadata.schema.entity.services.MetadataService;
import org.openmetadata.service.Entity;
import org.openmetadata.service.mapper.EntityMapper;
import org.openmetadata.service.mapper.Mapper;

@Mapper(entityType = Entity.METADATA_SERVICE)
public class MetadataServiceMapper implements EntityMapper<MetadataService, CreateMetadataService> {
  @Override
  public MetadataService createToEntity(CreateMetadataService create, String user) {
    return copy(new MetadataService(), create, user)
        .withServiceType(create.getServiceType())
        .withConnection(create.getConnection())
        .withIngestionRunner(create.getIngestionRunner());
  }
}
