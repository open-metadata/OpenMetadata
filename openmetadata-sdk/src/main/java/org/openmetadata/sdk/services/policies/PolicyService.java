package org.openmetadata.sdk.services.policies;

import org.openmetadata.schema.api.policies.CreatePolicy;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.services.EntityServiceBase;

public class PolicyService extends EntityServiceBase<Policy> {
  public PolicyService(HttpClient httpClient) {
    super(httpClient, "/v1/policies");
  }

  @Override
  protected Class<Policy> getEntityClass() {
    return Policy.class;
  }

  public Policy create(CreatePolicy request) throws OpenMetadataException {
    return httpClient.execute(HttpMethod.POST, basePath, request, Policy.class);
  }
}
