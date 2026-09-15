package org.openmetadata.service.clients.pipeline.config.types;

import io.dropwizard.configuration.ConfigurationException;
import java.io.IOException;
import java.util.List;
import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.configuration.apps.AppPrivateConfig;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.metadataIngestion.ApplicationPipeline;
import org.openmetadata.schema.metadataIngestion.OpenMetadataAppConfig;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.ConfigurationReader;
import org.openmetadata.service.jdbi3.IngestionPipelineRepository;

@Slf4j
public class ApplicationWorkflowConfig {
  private final ConfigurationReader configReader;
  private final Supplier<IngestionPipelineRepository> pipelineRepository;

  public ApplicationWorkflowConfig() {
    this(
        new ConfigurationReader(),
        () -> (IngestionPipelineRepository) Entity.getEntityRepository(Entity.INGESTION_PIPELINE));
  }

  ApplicationWorkflowConfig(
      ConfigurationReader configReader, Supplier<IngestionPipelineRepository> pipelineRepository) {
    this.configReader = configReader;
    this.pipelineRepository = pipelineRepository;
  }

  public OpenMetadataAppConfig buildOMApplicationConfig(IngestionPipeline ingestionPipeline) {
    final ApplicationPipeline externalApplicationConfig =
        buildApplicationPipeline(ingestionPipeline);

    return new OpenMetadataAppConfig()
        .withSourcePythonClass(externalApplicationConfig.getSourcePythonClass())
        .withAppConfig(externalApplicationConfig.getAppConfig())
        .withAppPrivateConfig(externalApplicationConfig.getAppPrivateConfig());
  }

  public ApplicationPipeline buildApplicationPipeline(IngestionPipeline ingestionPipeline) {
    final ApplicationPipeline config =
        JsonUtils.convertValue(
            ingestionPipeline.getSourceConfig().getConfig(), ApplicationPipeline.class);
    if (config.getAppPrivateConfig() == null) {
      config.setAppPrivateConfig(readAppPrivateConfig(ingestionPipeline));
    }
    return config;
  }

  private Object readAppPrivateConfig(IngestionPipeline ingestionPipeline) {
    if (ingestionPipeline.getId() == null) {
      return null;
    }
    final List<EntityReference> apps =
        pipelineRepository
            .get()
            .findFrom(
                ingestionPipeline.getId(),
                Entity.INGESTION_PIPELINE,
                Relationship.HAS,
                Entity.APPLICATION);
    return apps.isEmpty() ? null : readAppPrivateConfig(apps.getFirst().getName());
  }

  private Object readAppPrivateConfig(String appName) {
    try {
      final AppPrivateConfig config = configReader.readConfigFromResource(appName);
      return config.getParameters() == null
          ? null
          : config.getParameters().getAdditionalProperties();
    } catch (IOException e) {
      LOG.debug("No runtime configuration found for app {}", appName, e);
      return null;
    } catch (ConfigurationException e) {
      throw new IllegalStateException("Failed to load application runtime configuration", e);
    }
  }
}
