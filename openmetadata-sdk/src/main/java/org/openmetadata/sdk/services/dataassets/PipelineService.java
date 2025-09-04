package org.openmetadata.sdk.services.dataassets;

import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.resources.BaseResource;

public class PipelineService extends BaseResource<Pipeline> {
  public PipelineService(HttpClient httpClient) {
    super(httpClient, "/v1/pipelines");
  }

  @Override
  protected Class<Pipeline> getEntityClass() {
    return Pipeline.class;
  }
}
