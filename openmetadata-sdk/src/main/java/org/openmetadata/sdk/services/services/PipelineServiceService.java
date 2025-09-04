package org.openmetadata.sdk.services.services;

import org.openmetadata.sdk.network.HttpClient;
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
}
