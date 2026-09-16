package org.openmetadata.service.resources.ai;

import static org.openmetadata.service.util.EntityUtil.getEntityReference;

import org.openmetadata.schema.api.ai.CreateLLMModel;
import org.openmetadata.schema.entity.ai.LLMModel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.mapper.EntityMapper;

public class LLMModelMapper implements EntityMapper<LLMModel, CreateLLMModel> {
  @Override
  public LLMModel createToEntity(CreateLLMModel create, String user) {
    return copy(new LLMModel(), create, user)
        .withService(getEntityReference(Entity.LLM_SERVICE, create.getService()))
        .withBaseModel(create.getBaseModel())
        .withModelType(create.getModelType())
        .withProviderModelId(create.getProviderModelId())
        .withCapabilities(create.getCapabilities())
        .withModelVersion(create.getModelVersion())
        .withModelProvider(create.getModelProvider())
        .withModelSpecifications(create.getModelSpecifications())
        .withTrainingMetadata(create.getTrainingMetadata())
        .withModelEvaluation(create.getModelEvaluation())
        .withCostMetrics(create.getCostMetrics())
        .withDeploymentInfo(create.getDeploymentInfo())
        .withDetection(create.getDetection())
        .withEvidence(create.getEvidence())
        .withRemediationActions(create.getRemediationActions())
        .withCertifications(create.getCertifications())
        .withRegulatoryCompliance(create.getRegulatoryCompliance())
        .withGovernanceStatus(
            create.getGovernanceStatus() != null
                ? LLMModel.GovernanceStatus.valueOf(create.getGovernanceStatus().name())
                : null);
  }
}
