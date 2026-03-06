/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.clients.pipeline.config;

import java.util.Map;
import org.openmetadata.schema.ServiceEntityInterface;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.metadataIngestion.LogLevels;
import org.openmetadata.schema.metadataIngestion.OpenMetadataAppConfig;
import org.openmetadata.schema.metadataIngestion.OpenMetadataWorkflowConfig;
import org.openmetadata.schema.metadataIngestion.Sink;
import org.openmetadata.schema.metadataIngestion.Source;
import org.openmetadata.schema.metadataIngestion.WorkflowConfig;
import org.openmetadata.schema.services.connections.metadata.ComponentConfig;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.clients.pipeline.config.types.ApplicationWorkflowConfig;
import org.openmetadata.service.clients.pipeline.config.types.AutoClassificationWorkflowConfig;
import org.openmetadata.service.clients.pipeline.config.types.DBTWorkflowConfig;
import org.openmetadata.service.clients.pipeline.config.types.LineageWorkflowConfig;
import org.openmetadata.service.clients.pipeline.config.types.MetadataWorkflowConfig;
import org.openmetadata.service.clients.pipeline.config.types.ProfilerWorkflowConfig;
import org.openmetadata.service.clients.pipeline.config.types.TestSuiteWorkflowConfig;
import org.openmetadata.service.clients.pipeline.config.types.UsageWorkflowConfig;
import org.openmetadata.service.clients.pipeline.config.types.WorkflowBuildException;
import org.openmetadata.service.clients.pipeline.config.types.WorkflowConfigTypeStrategy;

// Create Kubernetes Job configurations based on Ingestion Pipeline configurations
public class WorkflowConfigBuilder {

  public static OpenMetadataWorkflowConfig buildOMWorkflowConfig(
      IngestionPipeline ingestionPipeline, ServiceEntityInterface service)
      throws WorkflowBuildException {

    WorkflowConfigTypeStrategy workflowStrategy;

    switch (ingestionPipeline.getPipelineType()) {
      case METADATA:
        workflowStrategy = new MetadataWorkflowConfig();
        break;
      case USAGE:
        workflowStrategy = new UsageWorkflowConfig();
        break;
      case LINEAGE:
        workflowStrategy = new LineageWorkflowConfig();
        break;
      case PROFILER:
        workflowStrategy = new ProfilerWorkflowConfig();
        break;
      case AUTO_CLASSIFICATION:
        workflowStrategy = new AutoClassificationWorkflowConfig();
        break;
      case TEST_SUITE:
        workflowStrategy = new TestSuiteWorkflowConfig();
        break;
      case DBT:
        workflowStrategy = new DBTWorkflowConfig();
        break;
      default:
        throw new IllegalArgumentException(
            "Not implemented pipeline type: " + ingestionPipeline.getPipelineType());
    }

    OpenMetadataWorkflowConfig config =
        workflowStrategy.buildOMWorkflowConfig(ingestionPipeline, service);

    LogLevels ingestionLevel =
        ingestionPipeline.getLoggerLevel() != null
            ? ingestionPipeline.getLoggerLevel()
            : LogLevels.INFO;
    // All workflows use the same WorkflowConfig and need the Pipeline FQN
    config.setWorkflowConfig(
        buildDefaultWorkflowConfig(ingestionPipeline).withLoggerLevel(ingestionLevel));
    config.setIngestionPipelineFQN(ingestionPipeline.getFullyQualifiedName());
    config.setEnableStreamableLogs(ingestionPipeline.getEnableStreamableLogs());
    return config;
  }

  public static OpenMetadataAppConfig buildOMApplicationConfig(
      IngestionPipeline ingestionPipeline, Map<String, Object> configOverride) {
    ApplicationWorkflowConfig workflowStrategy = new ApplicationWorkflowConfig();

    OpenMetadataAppConfig config = workflowStrategy.buildOMApplicationConfig(ingestionPipeline);
    if (configOverride != null) {
      Map<String, Object> configMap = JsonUtils.getMap(config.getAppConfig());
      configMap.putAll(configOverride);
      config.setAppConfig(configMap);
    }

    LogLevels ingestionLevel =
        ingestionPipeline.getLoggerLevel() != null
            ? ingestionPipeline.getLoggerLevel()
            : LogLevels.INFO;

    // All workflows use the same WorkflowConfig and need the Pipeline FQN
    config.setWorkflowConfig(
        buildDefaultWorkflowConfig(ingestionPipeline).withLoggerLevel(ingestionLevel));
    config.setIngestionPipelineFQN(ingestionPipeline.getFullyQualifiedName());
    config.setEnableStreamableLogs(ingestionPipeline.getEnableStreamableLogs());
    return config;
  }

  public static String buildIngestionStringYaml(
      IngestionPipeline ingestionPipeline,
      ServiceEntityInterface service,
      Map<String, Object> config)
      throws WorkflowBuildException {

    // Check if we are deploying an Application or a Workflow
    if (PipelineType.APPLICATION.equals(ingestionPipeline.getPipelineType())) {
      OpenMetadataAppConfig appConfig = buildOMApplicationConfig(ingestionPipeline, config);
      return YAMLUtils.stringifiedOMAppConfig(appConfig);
    }

    OpenMetadataWorkflowConfig workflowConfig = buildOMWorkflowConfig(ingestionPipeline, service);
    return YAMLUtils.stringifiedOMWorkflowConfig(workflowConfig);
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

    // Validate OpenMetadataServerConnection is properly configured
    if (ingestionPipeline.getOpenMetadataServerConnection() == null) {
      throw new IllegalArgumentException("OpenMetadata server connection is required but not set");
    }
    if (ingestionPipeline.getOpenMetadataServerConnection().getSecurityConfig() == null) {
      throw new IllegalArgumentException(
          "OpenMetadata server connection securityConfig is required but not set");
    }

    workflowConfig.setOpenMetadataServerConfig(ingestionPipeline.getOpenMetadataServerConnection());
    return workflowConfig;
  }

  public static Source buildDefaultSource(
      IngestionPipeline ingestionPipeline, ServiceEntityInterface service) {
    Source source = new Source();
    source.setServiceName(ingestionPipeline.getService().getName());
    source.setSourceConfig(ingestionPipeline.getSourceConfig());
    source.setType(service.getServiceType().toString().toLowerCase());

    return source;
  }
}
