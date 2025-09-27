package org.openmetadata.sdk.services.ingestion;

import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.services.EntityServiceBase;

public class IngestionPipelineService
    extends EntityServiceBase<
        org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline> {

  public IngestionPipelineService(HttpClient httpClient) {
    super(httpClient, "/v1/services/ingestionPipelines");
  }

  @Override
  protected Class<org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline>
      getEntityClass() {
    return org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline.class;
  }
}
