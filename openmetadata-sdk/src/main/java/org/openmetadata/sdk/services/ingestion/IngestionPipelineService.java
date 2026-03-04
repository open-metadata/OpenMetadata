package org.openmetadata.sdk.services.ingestion;

import org.openmetadata.schema.api.services.ingestionPipelines.CreateIngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.services.EntityServiceBase;

public class IngestionPipelineService extends EntityServiceBase<IngestionPipeline> {

  public IngestionPipelineService(HttpClient httpClient) {
    super(httpClient, "/v1/services/ingestionPipelines");
  }

  @Override
  protected Class<IngestionPipeline> getEntityClass() {
    return IngestionPipeline.class;
  }

  public IngestionPipeline create(CreateIngestionPipeline request) throws OpenMetadataException {
    return httpClient.execute(HttpMethod.POST, basePath, request, IngestionPipeline.class);
  }
}
