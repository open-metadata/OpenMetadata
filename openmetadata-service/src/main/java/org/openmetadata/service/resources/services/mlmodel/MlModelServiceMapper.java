package org.openmetadata.service.resources.services.mlmodel;

import org.openmetadata.schema.api.services.CreateMlModelService;
import org.openmetadata.schema.entity.services.MlModelService;
import org.openmetadata.service.mapper.EntityMapper;

public class MlModelServiceMapper implements EntityMapper<MlModelService, CreateMlModelService> {
  @Override
  public MlModelService createToEntity(CreateMlModelService create, String user) {
    return copy(new MlModelService(), create, user)
        .withServiceType(create.getServiceType())
        .withConnection(create.getConnection())
        .withIngestionRunner(create.getIngestionRunner());
  }
}
