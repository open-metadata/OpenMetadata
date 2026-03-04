package org.openmetadata.sdk.services.governance;

import org.openmetadata.schema.api.ai.CreateAIGovernancePolicy;
import org.openmetadata.schema.entity.ai.AIGovernancePolicy;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.services.EntityServiceBase;

public class AIGovernancePolicyService extends EntityServiceBase<AIGovernancePolicy> {
  public AIGovernancePolicyService(HttpClient httpClient) {
    super(httpClient, "/v1/aiGovernancePolicies");
  }

  @Override
  protected Class<AIGovernancePolicy> getEntityClass() {
    return AIGovernancePolicy.class;
  }

  public AIGovernancePolicy create(CreateAIGovernancePolicy request) throws OpenMetadataException {
    return httpClient.execute(HttpMethod.POST, basePath, request, AIGovernancePolicy.class);
  }
}
