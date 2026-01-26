package org.openmetadata.service.clients.pipeline.config.types;

import static org.openmetadata.service.clients.pipeline.config.WorkflowConfigBuilder.buildDefaultSink;
import static org.openmetadata.service.clients.pipeline.config.WorkflowConfigBuilder.buildDefaultSource;

import org.openmetadata.schema.ServiceEntityInterface;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.metadataIngestion.OpenMetadataWorkflowConfig;
import org.openmetadata.schema.metadataIngestion.Sink;
import org.openmetadata.schema.metadataIngestion.Source;

public class LineageWorkflowConfig implements WorkflowConfigTypeStrategy {
  public OpenMetadataWorkflowConfig buildOMWorkflowConfig(
      IngestionPipeline ingestionPipeline, ServiceEntityInterface service)
      throws WorkflowBuildException {
    OpenMetadataWorkflowConfig config = new OpenMetadataWorkflowConfig();

    Source source = buildDefaultSource(ingestionPipeline, service);
    source.setType(String.format("%s-lineage", source.getType()));

    Sink sink = buildDefaultSink();

    config.setSource(source);
    config.setSink(sink);

    return config;
  }
}
