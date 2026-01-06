package org.openmetadata.service.resources.ai;

import org.openmetadata.schema.api.ai.CreateAIGovernancePolicy;
import org.openmetadata.schema.entity.ai.AIGovernancePolicy;
import org.openmetadata.service.Entity;
import org.openmetadata.service.mapper.EntityMapper;
import org.openmetadata.service.mapper.Mapper;

@Mapper(entityType = Entity.AI_GOVERNANCE_POLICY)
public class AIGovernancePolicyMapper
    implements EntityMapper<AIGovernancePolicy, CreateAIGovernancePolicy> {
  @Override
  public AIGovernancePolicy createToEntity(CreateAIGovernancePolicy create, String user) {
    return copy(new AIGovernancePolicy(), create, user)
        .withPolicyType(create.getPolicyType())
        .withRules(create.getRules())
        .withBiasThresholds(create.getBiasThresholds())
        .withDataAccessControls(create.getDataAccessControls())
        .withCostControls(create.getCostControls())
        .withComplianceRequirements(create.getComplianceRequirements())
        .withPerformanceStandards(create.getPerformanceStandards())
        .withAppliesTo(create.getAppliesTo())
        .withEnforcementLevel(
            create.getEnforcementLevel() != null
                ? AIGovernancePolicy.EnforcementLevel.valueOf(create.getEnforcementLevel().name())
                : null)
        .withEnabled(create.getEnabled());
  }
}
