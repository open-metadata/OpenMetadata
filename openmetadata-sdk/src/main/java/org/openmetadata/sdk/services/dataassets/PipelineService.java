package org.openmetadata.sdk.services.dataassets;

import org.openmetadata.schema.api.data.CreatePipeline;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.PipelineStatus;
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

  public Pipeline addPipelineStatus(String fqn, PipelineStatus status)
      throws OpenMetadataException {
    String encodedFqn;
    try {
      encodedFqn = java.net.URLEncoder.encode(fqn, "UTF-8").replace("+", "%20");
    } catch (java.io.UnsupportedEncodingException e) {
      encodedFqn = fqn;
    }
    // API path is /{fqn}/status (not /name/{fqn}/status)
    String path = basePath + "/" + encodedFqn + "/status";
    return httpClient.execute(HttpMethod.PUT, path, status, Pipeline.class);
  }
}
