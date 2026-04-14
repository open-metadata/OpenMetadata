package org.openmetadata.service.search.indexes;

import java.util.Map;
import org.openmetadata.schema.entity.ai.AIGovernancePolicy;
import org.openmetadata.service.Entity;

public class AiGovernancePolicyIndex implements TaggableIndex, LineageIndex {
  final AIGovernancePolicy aiGovernancePolicy;

  public AiGovernancePolicyIndex(AIGovernancePolicy aiGovernancePolicy) {
    this.aiGovernancePolicy = aiGovernancePolicy;
  }

  @Override
  public Object getEntity() {
    return aiGovernancePolicy;
  }

  @Override
  public String getEntityTypeName() {
    return Entity.AI_GOVERNANCE_POLICY;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    return doc;
  }
}
