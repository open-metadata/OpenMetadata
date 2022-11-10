package org.openmetadata.service.clients.pipeline;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory;
import java.io.IOException;
import org.openmetadata.schema.ServiceEntityInterface;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.metadataIngestion.ComponentConfig;
import org.openmetadata.schema.metadataIngestion.LogLevels;
import org.openmetadata.schema.metadataIngestion.OpenMetadataWorkflowConfig;
import org.openmetadata.schema.metadataIngestion.Sink;
import org.openmetadata.schema.metadataIngestion.Source;
import org.openmetadata.schema.metadataIngestion.WorkflowConfig;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.EntityUtil;

public class WorkflowConfigBuilder {
  public static OpenMetadataWorkflowConfig buildOMWorkflowConfig(
      IngestionPipeline ingestionPipeline) throws IOException {

    OpenMetadataWorkflowConfig workflowConfig;

    switch (ingestionPipeline.getPipelineType()) {
      case METADATA:
        workflowConfig = buildMetadataWorkflowConfig(ingestionPipeline);
        break;
      case USAGE:
        workflowConfig = buildUsageWorkflowConfig(ingestionPipeline);
        break;
      case LINEAGE:
        workflowConfig = buildLineageWorkflowConfig(ingestionPipeline);
        break;
      case PROFILER:
        workflowConfig = buildProfilerWorkflowConfig(ingestionPipeline);
        break;
      case TEST_SUITE:
        workflowConfig = buildTestSuiteWorkflowConfig(ingestionPipeline);
        break;
      case DATA_INSIGHT:
        workflowConfig = buildDataInsightWorkflowConfig(ingestionPipeline);
        break;
      default:
        throw new IllegalArgumentException(
            "Not implemented pipeline type: " + ingestionPipeline.getPipelineType());
    }
    return workflowConfig;
  }

  public static Sink buildDefaultSink() {
    Sink sink = new Sink();
    sink.setType("metadata-rest");
    sink.setConfig(new ComponentConfig());
    return sink;
  }

  public static WorkflowConfig buildDefaultWorkflowConfig(IngestionPipeline ingestionPipeline) {
    WorkflowConfig workflowConfig = new WorkflowConfig();
    workflowConfig.setLoggerLevel(
        ingestionPipeline.getLoggerLevel() != null
            ? ingestionPipeline.getLoggerLevel()
            : LogLevels.INFO);
    workflowConfig.setOpenMetadataServerConfig(ingestionPipeline.getOpenMetadataServerConnection());
    return workflowConfig;
  }

  public static Source buildDefaultSource(IngestionPipeline ingestionPipeline) throws IOException {
    Source source = new Source();
    source.setServiceName(ingestionPipeline.getService().getName());
    source.setSourceConfig(ingestionPipeline.getSourceConfig());

    ServiceEntityInterface service =
        Entity.getEntity(
            ingestionPipeline.getService(), EntityUtil.Fields.EMPTY_FIELDS, Include.NON_DELETED);
    source.setType(service.getServiceType().toString().toLowerCase());

    return source;
  }

  public static OpenMetadataWorkflowConfig buildMetadataWorkflowConfig(
      IngestionPipeline ingestionPipeline) throws IOException {
    OpenMetadataWorkflowConfig config = new OpenMetadataWorkflowConfig();

    Source source = buildDefaultSource(ingestionPipeline);
    Sink sink = buildDefaultSink();
    WorkflowConfig workflowConfig = buildDefaultWorkflowConfig(ingestionPipeline);

    config.setSource(source);
    config.setSink(sink);
    config.setWorkflowConfig(workflowConfig);

    return config;
  }

  public static OpenMetadataWorkflowConfig buildUsageWorkflowConfig(
      IngestionPipeline ingestionPipeline) {
    return null;
  }

  public static OpenMetadataWorkflowConfig buildLineageWorkflowConfig(
      IngestionPipeline ingestionPipeline) {
    return null;
  }

  public static OpenMetadataWorkflowConfig buildProfilerWorkflowConfig(
      IngestionPipeline ingestionPipeline) {
    return null;
  }

  public static OpenMetadataWorkflowConfig buildTestSuiteWorkflowConfig(
      IngestionPipeline ingestionPipeline) {
    return null;
  }

  public static OpenMetadataWorkflowConfig buildDataInsightWorkflowConfig(
      IngestionPipeline ingestionPipeline) {
    return null;
  }

  /*
  Ref https://stackoverflow.com/questions/33409893/converting-java-class-structure-to-yml-file
   */
  public static String stringifiedOMWorkflowConfig(OpenMetadataWorkflowConfig workflowConfig)
      throws JsonProcessingException {
    ObjectMapper mapper = new ObjectMapper(new YAMLFactory());
    return mapper.writeValueAsString(workflowConfig);
  }
}
