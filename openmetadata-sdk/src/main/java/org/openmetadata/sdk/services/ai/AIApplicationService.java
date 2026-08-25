package org.openmetadata.sdk.services.ai;

import org.openmetadata.schema.api.ai.CreateAIApplication;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.services.EntityServiceBase;

public class AIApplicationService
    extends EntityServiceBase<org.openmetadata.schema.entity.ai.AIApplication> {

  public AIApplicationService(HttpClient httpClient) {
    super(httpClient, "/v1/aiApplications");
  }

  @Override
  protected Class<org.openmetadata.schema.entity.ai.AIApplication> getEntityClass() {
    return org.openmetadata.schema.entity.ai.AIApplication.class;
  }

  public org.openmetadata.schema.entity.ai.AIApplication create(CreateAIApplication request)
      throws OpenMetadataException {
    return httpClient.execute(
        HttpMethod.POST, basePath, request, org.openmetadata.schema.entity.ai.AIApplication.class);
  }
}
