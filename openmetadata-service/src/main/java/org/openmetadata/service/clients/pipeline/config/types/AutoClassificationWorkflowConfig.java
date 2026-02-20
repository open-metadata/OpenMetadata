package org.openmetadata.service.clients.pipeline.config.types;

import static org.openmetadata.service.clients.pipeline.config.WorkflowConfigBuilder.buildDefaultSink;
import static org.openmetadata.service.clients.pipeline.config.WorkflowConfigBuilder.buildDefaultSource;

import org.openmetadata.schema.ServiceEntityInterface;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.metadataIngestion.OpenMetadataWorkflowConfig;
import org.openmetadata.schema.metadataIngestion.Processor;
import org.openmetadata.schema.metadataIngestion.Sink;
import org.openmetadata.schema.metadataIngestion.Source;
import org.openmetadata.schema.services.connections.metadata.ComponentConfig;

public class AutoClassificationWorkflowConfig implements WorkflowConfigTypeStrategy {
  public OpenMetadataWorkflowConfig buildOMWorkflowConfig(
      IngestionPipeline ingestionPipeline, ServiceEntityInterface service)
      throws WorkflowBuildException {
    OpenMetadataWorkflowConfig config = new OpenMetadataWorkflowConfig();

    Source source = buildDefaultSource(ingestionPipeline, service);
    Processor processor =
        new Processor().withType("tag-pii-processor").withConfig(new ComponentConfig());
    Sink sink = buildDefaultSink();

    config.setSource(source);
    config.setProcessor(processor);
    config.setSink(sink);

    return config;
  }
}
