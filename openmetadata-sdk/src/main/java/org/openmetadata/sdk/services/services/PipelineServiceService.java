package org.openmetadata.sdk.services.services;

import org.openmetadata.schema.api.services.CreatePipelineService;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.services.EntityServiceBase;

public class PipelineServiceService
    extends EntityServiceBase<org.openmetadata.schema.entity.services.PipelineService> {

  public PipelineServiceService(HttpClient httpClient) {
    super(httpClient, "/v1/services/pipelineServices");
  }

  @Override
  protected Class<org.openmetadata.schema.entity.services.PipelineService> getEntityClass() {
    return org.openmetadata.schema.entity.services.PipelineService.class;
  }

  // Create using CreatePipelineService request
  public org.openmetadata.schema.entity.services.PipelineService create(
      CreatePipelineService request) throws OpenMetadataException {
    return httpClient.execute(
        HttpMethod.POST,
        basePath,
        request,
        org.openmetadata.schema.entity.services.PipelineService.class);
  }
}
