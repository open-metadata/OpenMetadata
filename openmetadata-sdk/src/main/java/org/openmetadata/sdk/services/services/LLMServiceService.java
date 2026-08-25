package org.openmetadata.sdk.services.services;

import org.openmetadata.schema.api.services.CreateLLMService;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.services.EntityServiceBase;

public class LLMServiceService
    extends EntityServiceBase<org.openmetadata.schema.entity.services.LLMService> {

  public LLMServiceService(HttpClient httpClient) {
    super(httpClient, "/v1/services/llmServices");
  }

  @Override
  protected Class<org.openmetadata.schema.entity.services.LLMService> getEntityClass() {
    return org.openmetadata.schema.entity.services.LLMService.class;
  }

  public org.openmetadata.schema.entity.services.LLMService create(CreateLLMService request)
      throws OpenMetadataException {
    return httpClient.execute(
        HttpMethod.POST,
        basePath,
        request,
        org.openmetadata.schema.entity.services.LLMService.class);
  }
}
