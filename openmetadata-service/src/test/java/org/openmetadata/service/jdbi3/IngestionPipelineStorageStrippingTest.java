package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.mock;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.metadataIngestion.ApplicationPipeline;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.schema.metadataIngestion.StorageServiceMetadataPipeline;
import org.openmetadata.schema.security.secrets.SecretsManagerProvider;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.secrets.DBSecretsManager;
import org.openmetadata.service.secrets.SecretsManager;
import org.openmetadata.service.secrets.SecretsManagerFactory;
import org.openmetadata.service.secrets.masker.EntityMasker;
import org.openmetadata.service.secrets.masker.EntityMaskerFactory;

class IngestionPipelineStorageStrippingTest {
  private EntityMasker originalMasker;
  private SecretsManager originalManager;

  @BeforeEach
  void setupMasker() {
    originalMasker = EntityMaskerFactory.getEntityMasker();
    EntityMaskerFactory.setEntityMasker(null);
    EntityMaskerFactory.createEntityMasker();
    originalManager = SecretsManagerFactory.getSecretsManager();
    SecretsManagerFactory.setSecretsManager(
        DBSecretsManager.getInstance(
            SecretsManagerProvider.DB,
            new SecretsManager.SecretsConfig("test", "test", List.of(), null)));
  }

  @AfterEach
  void restoreMasker() {
    EntityMaskerFactory.setEntityMasker(originalMasker);
    SecretsManagerFactory.setSecretsManager(originalManager);
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void excludesRuntimeSecretsFromStorageAndHistoryWithoutMutatingPipeline(boolean fromJson) {
    IngestionPipelineRepository repository =
        mock(IngestionPipelineRepository.class, CALLS_REAL_METHODS);
    IngestionPipeline pipeline =
        new IngestionPipeline()
            .withName("test_pipeline")
            .withPipelineType(PipelineType.APPLICATION)
            .withSourceConfig(
                new SourceConfig()
                    .withConfig(
                        new ApplicationPipeline()
                            .withSourcePythonClass("test.source")
                            .withAppConfig(Map.of("enabled", true))
                            .withAppPrivateConfig(Map.of("token", "test-secret-value"))));
    if (fromJson) {
      pipeline = JsonUtils.readValue(JsonUtils.pojoToJson(pipeline), IngestionPipeline.class);
    }

    assertSafeConfig(JsonUtils.readTree(repository.serializeForStorage(pipeline)));
    assertSafeConfig(JsonUtils.readTree(repository.serializeForVersionHistory(pipeline)));
    assertEquals(
        "test-secret-value",
        JsonUtils.valueToTree(pipeline).at("/sourceConfig/config/appPrivateConfig/token").asText());
  }

  private static void assertSafeConfig(JsonNode serialized) {
    JsonNode config = serialized.at("/sourceConfig/config");
    assertFalse(config.has("appPrivateConfig"));
    assertEquals("test.source", config.path("sourcePythonClass").asText());
    assertTrue(config.at("/appConfig/enabled").asBoolean());
    assertFalse(serialized.toString().contains("test-secret-value"));
  }

  @Test
  void preservesNonApplicationConfig() {
    IngestionPipelineRepository repository =
        mock(IngestionPipelineRepository.class, CALLS_REAL_METHODS);
    Map<String, Object> config =
        JsonUtils.getMap(new StorageServiceMetadataPipeline().withMarkDeletedContainers(false));
    IngestionPipeline pipeline =
        new IngestionPipeline()
            .withName("test_pipeline")
            .withPipelineType(PipelineType.METADATA)
            .withSourceConfig(new SourceConfig().withConfig(config));
    assertEquals(
        JsonUtils.valueToTree(config),
        JsonUtils.readTree(repository.serializeForStorage(pipeline)).at("/sourceConfig/config"));
    assertEquals(
        JsonUtils.valueToTree(config),
        JsonUtils.readTree(repository.serializeForVersionHistory(pipeline))
            .at("/sourceConfig/config"));
  }

  @Test
  void allowsApplicationWithoutSourceConfig() {
    IngestionPipelineRepository repository =
        mock(IngestionPipelineRepository.class, CALLS_REAL_METHODS);
    IngestionPipeline pipeline =
        new IngestionPipeline()
            .withName("test_pipeline")
            .withPipelineType(PipelineType.APPLICATION);
    assertEquals(
        "test_pipeline",
        JsonUtils.readTree(repository.serializeForStorage(pipeline)).path("name").asText());
    assertEquals(
        "test_pipeline",
        JsonUtils.readTree(repository.serializeForVersionHistory(pipeline)).path("name").asText());
  }
}
