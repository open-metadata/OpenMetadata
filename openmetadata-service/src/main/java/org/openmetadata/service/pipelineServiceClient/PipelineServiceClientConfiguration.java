package org.openmetadata.service.pipelineServiceClient;

import lombok.Getter;
import lombok.Setter;
import org.openmetadata.schema.api.configuration.pipelineServiceClient.PipelineServiceClientProvider;

@Getter
@Setter
public class PipelineServiceClientConfiguration {

  public static final PipelineServiceClientProvider DEFAULT_PIPELINE_SERVICE_CLIENT =
      PipelineServiceClientProvider.AIRFLOW;

  private PipelineServiceClientProvider pipelineServiceClient;
}
