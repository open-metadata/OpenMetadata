package org.openmetadata.service.clients.pipeline.config.types;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import io.dropwizard.configuration.ConfigurationException;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.configuration.apps.AppPrivateConfig;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.metadataIngestion.ApplicationPipeline;
import org.openmetadata.schema.metadataIngestion.OpenMetadataAppConfig;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.ConfigurationReader;
import org.openmetadata.service.jdbi3.IngestionPipelineRepository;

class ApplicationWorkflowConfigTest {
  private static final UUID PIPELINE_ID = UUID.randomUUID();
  private IngestionPipelineRepository repository;

  @BeforeEach
  void setup() {
    repository = mock(IngestionPipelineRepository.class);
    when(repository.findFrom(
            PIPELINE_ID, Entity.INGESTION_PIPELINE, Relationship.HAS, Entity.APPLICATION))
        .thenReturn(List.of(new EntityReference().withName("test_app")));
  }

  @Test
  void reloadsRuntimeSecretsForPersistedPipeline() throws Exception {
    ConfigurationReader reader = mock(ConfigurationReader.class);
    when(reader.readConfigFromResource("test_app"))
        .thenReturn(
            JsonUtils.convertValue(
                Map.of("parameters", Map.of("token", "test-secret-value")),
                AppPrivateConfig.class));
    IngestionPipeline pipeline =
        JsonUtils.readValue(JsonUtils.pojoToJson(pipeline()), IngestionPipeline.class);

    OpenMetadataAppConfig workflow =
        new ApplicationWorkflowConfig(reader, () -> repository).buildOMApplicationConfig(pipeline);

    assertEquals(Map.of("token", "test-secret-value"), workflow.getAppPrivateConfig());
    assertEquals("test.source", workflow.getSourcePythonClass());
    assertEquals(Map.of("enabled", true), workflow.getAppConfig());
    assertNull(
        JsonUtils.convertValue(pipeline.getSourceConfig().getConfig(), ApplicationPipeline.class)
            .getAppPrivateConfig());
  }

  @Test
  void preservesPrivateConfigAlreadyProvidedAtRuntime() {
    IngestionPipeline pipeline = pipeline();
    ((ApplicationPipeline) pipeline.getSourceConfig().getConfig())
        .setAppPrivateConfig(Map.of("token", "test-secret-value"));

    OpenMetadataAppConfig workflow =
        new ApplicationWorkflowConfig().buildOMApplicationConfig(pipeline);

    assertEquals(Map.of("token", "test-secret-value"), workflow.getAppPrivateConfig());
  }

  @Test
  void allowsApplicationWithoutRuntimeConfigFile() throws Exception {
    ConfigurationReader reader = mock(ConfigurationReader.class);
    when(reader.readConfigFromResource("test_app"))
        .thenThrow(new IOException("No configuration file"));

    OpenMetadataAppConfig workflow =
        new ApplicationWorkflowConfig(reader, () -> repository)
            .buildOMApplicationConfig(pipeline());

    assertNull(workflow.getAppPrivateConfig());
    assertEquals("test.source", workflow.getSourcePythonClass());
  }

  @Test
  void rejectsMalformedRuntimeConfig() throws Exception {
    final ConfigurationReader reader = mock(ConfigurationReader.class);
    when(reader.readConfigFromResource("test_app"))
        .thenThrow(new ConfigurationException("config.yaml", List.of("Invalid configuration")) {});
    assertThrows(
        IllegalStateException.class,
        () ->
            new ApplicationWorkflowConfig(reader, () -> repository)
                .buildOMApplicationConfig(pipeline()));
  }

  @Test
  void allowsRuntimeConfigWithoutParameters() throws Exception {
    ConfigurationReader reader = mock(ConfigurationReader.class);
    when(reader.readConfigFromResource("test_app")).thenReturn(new AppPrivateConfig());

    assertNull(
        new ApplicationWorkflowConfig(reader, () -> repository)
            .buildOMApplicationConfig(pipeline())
            .getAppPrivateConfig());
  }

  @Test
  void doesNotLoadSecretsForUnboundPipelineWithMatchingName() throws Exception {
    ConfigurationReader reader = mock(ConfigurationReader.class);
    when(reader.readConfigFromResource("test_app"))
        .thenReturn(
            JsonUtils.convertValue(
                Map.of("parameters", Map.of("token", "test-secret-value")),
                AppPrivateConfig.class));
    when(repository.findFrom(
            PIPELINE_ID, Entity.INGESTION_PIPELINE, Relationship.HAS, Entity.APPLICATION))
        .thenReturn(List.of());
    assertNull(
        new ApplicationWorkflowConfig(reader, () -> repository)
            .buildOMApplicationConfig(pipeline())
            .getAppPrivateConfig());
  }

  @Test
  void resolvesRuntimeConfigFromOwningApplication() throws Exception {
    ConfigurationReader reader = mock(ConfigurationReader.class);
    when(reader.readConfigFromResource("test_app"))
        .thenReturn(
            JsonUtils.convertValue(
                Map.of("parameters", Map.of("token", "test-secret-value")),
                AppPrivateConfig.class));
    assertEquals(
        Map.of("token", "test-secret-value"),
        new ApplicationWorkflowConfig(reader, () -> repository)
            .buildOMApplicationConfig(pipeline().withName("another_pipeline"))
            .getAppPrivateConfig());
  }

  private static IngestionPipeline pipeline() {

    return new IngestionPipeline()
        .withId(PIPELINE_ID)
        .withName("test_app")
        .withPipelineType(PipelineType.APPLICATION)
        .withSourceConfig(
            new SourceConfig()
                .withConfig(
                    new ApplicationPipeline()
                        .withSourcePythonClass("test.source")
                        .withAppConfig(Map.of("enabled", true))));
  }
}
