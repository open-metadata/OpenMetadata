package org.openmetadata.service.search.indexes;

import java.util.Map;
import org.openmetadata.schema.entity.ai.AIGovernancePolicy;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.ParseTags;

public class AiGovernancePolicyIndex implements SearchIndex {
  final AIGovernancePolicy aiGovernancePolicy;

  public AiGovernancePolicyIndex(AIGovernancePolicy aiGovernancePolicy) {
    this.aiGovernancePolicy = aiGovernancePolicy;
  }

  @Override
  public Object getEntity() {
    return aiGovernancePolicy;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    ParseTags parseTags =
        new ParseTags(Entity.getEntityTags(Entity.AI_GOVERNANCE_POLICY, aiGovernancePolicy));
    Map<String, Object> commonAttributes =
        getCommonAttributesMap(aiGovernancePolicy, Entity.AI_GOVERNANCE_POLICY);
    doc.putAll(commonAttributes);
    doc.put("tags", parseTags.getTags());
    doc.put("tier", parseTags.getTierTag());
    doc.put("upstreamLineage", SearchIndex.getLineageData(aiGovernancePolicy.getEntityReference()));
    return doc;
  }
}
