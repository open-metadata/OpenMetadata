package org.openmetadata.service.clients.pipeline;

import lombok.Getter;
import org.openmetadata.schema.api.configuration.pipelineServiceClient.PipelineServiceClientProvider;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.clients.pipeline.airflow.AirflowRESTClient;
import org.openmetadata.service.clients.pipeline.argo.ArgoServiceClient;

public class PipelineServiceClientFactory {

  @Getter private static PipelineServiceClient pipelineServiceClient;

  public static PipelineServiceClient createPipelineServiceClient(OpenMetadataApplicationConfig config) {
    if (pipelineServiceClient != null) {
      return pipelineServiceClient;
    }

    PipelineServiceClientConfiguration pipelineServiceClientConfiguration =
        config.getPipelineServiceClientConfiguration() != null
            ? config.getPipelineServiceClientConfiguration()
            : new PipelineServiceClientConfiguration();

    PipelineServiceClientProvider pipelineServiceClientProvider =
        pipelineServiceClientConfiguration.getPipelineServiceClient() != null
            ? pipelineServiceClientConfiguration.getPipelineServiceClient()
            : PipelineServiceClientConfiguration.DEFAULT_PIPELINE_SERVICE_CLIENT;

    switch (pipelineServiceClientProvider) {
      case AIRFLOW:
        pipelineServiceClient =
            new AirflowRESTClient(pipelineServiceClientConfiguration, config.getAirflowConfiguration());
        break;
      case ARGO:
        pipelineServiceClient =
            new ArgoServiceClient(
                pipelineServiceClientConfiguration, config.getArgoConfiguration(), config.getClusterName());
        break;
      default:
        throw new IllegalArgumentException("Not implemented pipeline service client: " + pipelineServiceClientProvider);
    }
    return pipelineServiceClient;
  }
}
