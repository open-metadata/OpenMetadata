package org.openmetadata.sdk.services.dataassets;

import org.openmetadata.schema.api.data.CreatePipeline;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.services.EntityServiceBase;

public class PipelineService extends EntityServiceBase<Pipeline> {
  public PipelineService(HttpClient httpClient) {
    super(httpClient, "/v1/pipelines");
  }

  @Override
  protected Class<Pipeline> getEntityClass() {
    return Pipeline.class;
  }

  // Create using CreatePipeline request
  public Pipeline create(CreatePipeline request) throws OpenMetadataException {
    return httpClient.execute(HttpMethod.POST, basePath, request, Pipeline.class);
  }
}
