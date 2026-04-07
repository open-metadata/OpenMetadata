package org.openmetadata.service.clients.pipeline.config.types;

import static org.openmetadata.service.clients.pipeline.config.WorkflowConfigBuilder.buildDefaultSink;
import static org.openmetadata.service.clients.pipeline.config.WorkflowConfigBuilder.buildDefaultSource;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.openmetadata.schema.ServiceEntityInterface;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.metadataIngestion.DatabaseServiceProfilerPipeline;
import org.openmetadata.schema.metadataIngestion.OpenMetadataWorkflowConfig;
import org.openmetadata.schema.metadataIngestion.Processor;
import org.openmetadata.schema.metadataIngestion.Sink;
import org.openmetadata.schema.metadataIngestion.Source;
import org.openmetadata.schema.profiler.MetricType;
import org.openmetadata.schema.services.connections.metadata.ComponentConfig;
import org.openmetadata.schema.utils.JsonUtils;

public class ProfilerWorkflowConfig implements WorkflowConfigTypeStrategy {
  public OpenMetadataWorkflowConfig buildOMWorkflowConfig(
      IngestionPipeline ingestionPipeline, ServiceEntityInterface service) {
    OpenMetadataWorkflowConfig config = new OpenMetadataWorkflowConfig();

    Source source = buildDefaultSource(ingestionPipeline, service);
    Processor processor = buildProcessor(ingestionPipeline);
    Sink sink = buildDefaultSink();

    config.setSource(source);
    config.setProcessor(processor);
    config.setSink(sink);

    return config;
  }

  private Processor buildProcessor(IngestionPipeline ingestionPipeline) {
    ComponentConfig componentConfig = new ComponentConfig();

    DatabaseServiceProfilerPipeline profilerPipeline =
        JsonUtils.convertValue(
            ingestionPipeline.getSourceConfig().getConfig(), DatabaseServiceProfilerPipeline.class);

    List<MetricType> metrics = profilerPipeline.getMetrics();
    if (metrics != null && !metrics.isEmpty()) {
      List<String> metricNames = new ArrayList<String>();
      for (MetricType metric : metrics) {
        if (metric != null) {
          metricNames.add(metric.value());
        }
      }
      if (!metricNames.isEmpty()) {
        Map<String, Object> profilerDef = new HashMap<>();
        profilerDef.put("name", "ingestion-profiler");
        profilerDef.put("metrics", metricNames);
        componentConfig.setAdditionalProperty("profiler", profilerDef);
      }
    }

    return new Processor().withType("orm-profiler").withConfig(componentConfig);
  }
}
