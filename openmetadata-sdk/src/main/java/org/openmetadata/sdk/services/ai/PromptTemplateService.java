package org.openmetadata.sdk.services.ai;

import org.openmetadata.schema.api.ai.CreatePromptTemplate;
import org.openmetadata.schema.entity.ai.PromptTemplate;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.services.EntityServiceBase;

public class PromptTemplateService extends EntityServiceBase<PromptTemplate> {
  public PromptTemplateService(HttpClient httpClient) {
    super(httpClient, "/v1/promptTemplates");
  }

  @Override
  protected Class<PromptTemplate> getEntityClass() {
    return PromptTemplate.class;
  }

  public PromptTemplate create(CreatePromptTemplate request) throws OpenMetadataException {
    return httpClient.execute(HttpMethod.POST, basePath, request, PromptTemplate.class);
  }
}
