package org.openmetadata.sdk.services.ai;

import org.openmetadata.schema.api.ai.CreateLLMModel;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.services.EntityServiceBase;

public class LLMModelService extends EntityServiceBase<org.openmetadata.schema.entity.ai.LLMModel> {

  public LLMModelService(HttpClient httpClient) {
    super(httpClient, "/v1/llmModels");
  }

  @Override
  protected Class<org.openmetadata.schema.entity.ai.LLMModel> getEntityClass() {
    return org.openmetadata.schema.entity.ai.LLMModel.class;
  }

  public org.openmetadata.schema.entity.ai.LLMModel create(CreateLLMModel request)
      throws OpenMetadataException {
    return httpClient.execute(
        HttpMethod.POST, basePath, request, org.openmetadata.schema.entity.ai.LLMModel.class);
  }
}
