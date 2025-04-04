package org.openmetadata.service.resources.services.pipeline;

import org.openmetadata.schema.api.services.CreatePipelineService;
import org.openmetadata.schema.entity.services.PipelineService;
import org.openmetadata.service.mapper.EntityMapper;

public class PipelineServiceMapper implements EntityMapper<PipelineService, CreatePipelineService> {
  @Override
  public PipelineService createToEntity(CreatePipelineService create, String user) {
    return copy(new PipelineService(), create, user)
        .withServiceType(create.getServiceType())
        .withConnection(create.getConnection())
        .withIngestionRunner(create.getIngestionRunner());
  }
}
