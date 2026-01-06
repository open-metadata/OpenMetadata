package org.openmetadata.service.resources.ai;

import org.openmetadata.schema.api.ai.CreatePromptTemplate;
import org.openmetadata.schema.entity.ai.PromptTemplate;
import org.openmetadata.service.Entity;
import org.openmetadata.service.mapper.EntityMapper;
import org.openmetadata.service.mapper.Mapper;

@Mapper(entityType = Entity.PROMPT_TEMPLATE)
public class PromptTemplateMapper implements EntityMapper<PromptTemplate, CreatePromptTemplate> {
  @Override
  public PromptTemplate createToEntity(CreatePromptTemplate create, String user) {
    return copy(new PromptTemplate(), create, user)
        .withTemplateContent(create.getTemplateContent())
        .withSystemPrompt(create.getSystemPrompt())
        .withVariables(create.getVariables())
        .withExamples(create.getExamples())
        .withTemplateType(
            create.getTemplateType() != null
                ? PromptTemplate.TemplateType.valueOf(create.getTemplateType().name())
                : null)
        .withTemplateVersion(create.getTemplateVersion());
  }
}
