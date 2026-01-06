package org.openmetadata.service.resources.services.llm;

import org.openmetadata.schema.api.services.CreateLLMService;
import org.openmetadata.schema.entity.services.LLMService;
import org.openmetadata.service.Entity;
import org.openmetadata.service.mapper.EntityMapper;
import org.openmetadata.service.mapper.Mapper;

@Mapper(entityType = Entity.LLM_SERVICE)
public class LLMServiceMapper implements EntityMapper<LLMService, CreateLLMService> {
  @Override
  public LLMService createToEntity(CreateLLMService create, String user) {
    return copy(new LLMService(), create, user)
        .withServiceType(create.getServiceType())
        .withConnection(create.getConnection())
        .withIngestionRunner(create.getIngestionRunner());
  }
}
