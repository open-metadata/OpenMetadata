package org.openmetadata.service.resources.ai;

import static org.openmetadata.service.util.EntityUtil.getEntityReference;

import org.openmetadata.schema.api.ai.CreateAIApplication;
import org.openmetadata.schema.entity.ai.AIApplication;
import org.openmetadata.service.Entity;
import org.openmetadata.service.mapper.EntityMapper;
import org.openmetadata.service.mapper.Mapper;

@Mapper(entityType = Entity.AI_APPLICATION)
public class AIApplicationMapper implements EntityMapper<AIApplication, CreateAIApplication> {
  @Override
  public AIApplication createToEntity(CreateAIApplication create, String user) {
    return copy(new AIApplication(), create, user)
        .withApplicationType(create.getApplicationType())
        .withDevelopmentStage(create.getDevelopmentStage())
        .withModelConfigurations(create.getModelConfigurations())
        .withPrimaryModel(
            create.getPrimaryModel() != null
                ? getEntityReference(Entity.LLM_MODEL, create.getPrimaryModel())
                : null)
        .withPromptTemplates(create.getPromptTemplates())
        .withTools(create.getTools())
        .withDataSources(create.getDataSources())
        .withKnowledgeBases(create.getKnowledgeBases())
        .withUpstreamApplications(create.getUpstreamApplications())
        .withDownstreamApplications(create.getDownstreamApplications())
        .withFramework(create.getFramework())
        .withGovernanceMetadata(create.getGovernanceMetadata())
        .withBiasMetrics(create.getBiasMetrics())
        .withPerformanceMetrics(create.getPerformanceMetrics())
        .withQualityMetrics(create.getQualityMetrics())
        .withSafetyMetrics(create.getSafetyMetrics())
        .withTestSuites(create.getTestSuites())
        .withSourceCode(create.getSourceCode())
        .withDeploymentUrl(create.getDeploymentUrl())
        .withDocumentation(create.getDocumentation());
  }
}
