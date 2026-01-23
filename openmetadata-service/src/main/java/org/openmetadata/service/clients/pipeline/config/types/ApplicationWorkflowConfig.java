package org.openmetadata.service.clients.pipeline.config.types;

import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.metadataIngestion.ApplicationPipeline;
import org.openmetadata.schema.metadataIngestion.OpenMetadataAppConfig;
import org.openmetadata.schema.utils.JsonUtils;

public class ApplicationWorkflowConfig {
  public OpenMetadataAppConfig buildOMApplicationConfig(IngestionPipeline ingestionPipeline) {

    ApplicationPipeline externalApplicationConfig =
        JsonUtils.convertValue(
            ingestionPipeline.getSourceConfig().getConfig(), ApplicationPipeline.class);

    return new OpenMetadataAppConfig()
        .withSourcePythonClass(externalApplicationConfig.getSourcePythonClass())
        .withAppConfig(externalApplicationConfig.getAppConfig())
        .withAppPrivateConfig(externalApplicationConfig.getAppPrivateConfig());
  }
}
