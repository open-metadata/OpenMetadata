package org.openmetadata.service.resources.services.ingestionpipelines;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.core.SecurityContext;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.IngestionPipelineRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.secrets.masker.EntityMasker;
import org.openmetadata.service.secrets.masker.EntityMaskerFactory;
import org.openmetadata.service.security.Authorizer;

class IngestionPipelineHistorySecretsTest {
  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void historyEndpointsMaskLegacyStorageAndApplicationSecrets(boolean timestampHistory) {
    final UUID id = UUID.randomUUID();
    final IngestionPipeline storage =
        new IngestionPipeline()
            .withId(id)
            .withPipelineType(PipelineType.METADATA)
            .withSourceConfig(
                new SourceConfig()
                    .withConfig(
                        Map.of(
                            "type",
                            "StorageMetadata",
                            "storageMetadataConfigSource",
                            Map.of(
                                "securityConfig",
                                Map.of("awsSecretAccessKey", "test-storage-secret"),
                                "prefixConfig",
                                Map.of("containerName", "my_bucket")))));
    final IngestionPipeline application =
        new IngestionPipeline()
            .withId(id)
            .withPipelineType(PipelineType.APPLICATION)
            .withSourceConfig(
                new SourceConfig()
                    .withConfig(
                        Map.of(
                            "type",
                            "Application",
                            "sourcePythonClass",
                            "test.source",
                            "appPrivateConfig",
                            Map.of("token", "test-app-secret"))));
    final List<Object> versions =
        List.of(JsonUtils.pojoToJson(storage), JsonUtils.pojoToJson(application));
    final IngestionPipelineRepository repository = mock(IngestionPipelineRepository.class);
    when(repository.listVersions(id)).thenReturn(new EntityHistory().withVersions(versions));
    when(repository.listEntityHistoryByTimestamp(0, 100, null, null, 10))
        .thenReturn(new ResultList<>(List.of(storage, application), null, null, 2));
    final EntityMasker originalMasker = EntityMaskerFactory.getEntityMasker();
    EntityMaskerFactory.setEntityMasker(null);
    EntityMaskerFactory.createEntityMasker();
    try (MockedStatic<Entity> entities = mockStatic(Entity.class)) {
      entities
          .when(() -> Entity.getEntityRepository(Entity.INGESTION_PIPELINE))
          .thenReturn(repository);
      final IngestionPipelineResource resource =
          new IngestionPipelineResource(mock(Authorizer.class), mock(Limits.class));
      final List<IngestionPipeline> response =
          timestampHistory
              ? resource
                  .listEntityHistoryByTimestamp(
                      null, mock(SecurityContext.class), 0, 100, 10, null, null)
                  .getData()
              : resource.listVersions(null, mock(SecurityContext.class), id).getVersions().stream()
                  .map(version -> JsonUtils.readValue((String) version, IngestionPipeline.class))
                  .toList();
      final String body = JsonUtils.pojoToJson(response);
      assertFalse(body.contains("test-storage-secret"));
      assertFalse(body.contains("test-app-secret"));
      assertEquals(
          "*********",
          JsonUtils.valueToTree(response.getFirst())
              .at(
                  "/sourceConfig/config/storageMetadataConfigSource/securityConfig/awsSecretAccessKey")
              .asText());
      assertNull(
          JsonUtils.valueToTree(response.get(1))
              .at("/sourceConfig/config")
              .get("appPrivateConfig"));
      assertEquals(2, response.size());
    } finally {
      EntityMaskerFactory.setEntityMasker(originalMasker);
    }
  }
}
