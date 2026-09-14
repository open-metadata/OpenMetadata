package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.macasaet.fernet.Key;
import java.lang.reflect.Field;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.Collectors;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.schema.security.secrets.SecretsManagerProvider;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.PreconditionFailedException;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.secrets.DBSecretsManager;
import org.openmetadata.service.secrets.InMemorySecretsManager;
import org.openmetadata.service.secrets.SecretsManager;
import org.openmetadata.service.secrets.SecretsManagerFactory;
import org.openmetadata.service.secrets.masker.EntityMasker;
import org.openmetadata.service.secrets.masker.EntityMaskerFactory;

class IngestionPipelinePersistenceSecretsTest {
  private static final String SECRET = "test-secret-value";
  private static final String SECRET_PATH =
      "/sourceConfig/config/storageMetadataConfigSource/securityConfig/awsSecretAccessKey";
  private String originalKey;
  private SecretsManager originalManager;
  private EntityMasker originalMasker;
  private IngestionPipelineRepository repository;
  private EntityDAO<IngestionPipeline> dao;
  private final AtomicReference<String> storedJson = new AtomicReference<>();

  @BeforeEach
  void setup() throws Exception {
    final Fernet fernet = Fernet.getInstance();
    originalKey =
        fernet.isKeyDefined()
            ? fernet.getCachedKeys().stream().map(Key::serialise).collect(Collectors.joining(","))
            : null;
    fernet.setFernetKey(Key.generateKey().serialise());
    originalManager = SecretsManagerFactory.getSecretsManager();
    originalMasker = EntityMaskerFactory.getEntityMasker();
    SecretsManagerFactory.setSecretsManager(
        DBSecretsManager.getInstance(
            SecretsManagerProvider.DB,
            new SecretsManager.SecretsConfig("test", "test", List.of(), null)));
    EntityMaskerFactory.setEntityMasker(null);
    EntityMaskerFactory.createEntityMasker();
    repository = mock(IngestionPipelineRepository.class, CALLS_REAL_METHODS);
    dao = mock(EntityDAO.class);
    setRepositoryField("dao", dao);
    setRepositoryField("storedEntityJson", new ThreadLocal<>());
    doNothing().when(repository).invalidate(any());
    when(dao.getTableName()).thenReturn("ingestion_pipeline_entity");
    when(dao.getNameHashColumn()).thenReturn("nameHash");
    doAnswer(
            call -> {
              storedJson.set(call.getArgument(2));
              return null;
            })
        .when(dao)
        .update(any(UUID.class), anyString(), anyString());
    when(dao.updateWithVersion(
            anyString(), anyString(), anyString(), anyString(), anyString(), anyString()))
        .thenAnswer(
            call -> {
              storedJson.set(call.getArgument(4));
              return 1;
            });
  }

  @AfterEach
  void cleanup() {
    SecretsManagerFactory.setSecretsManager(originalManager);
    EntityMaskerFactory.setEntityMasker(originalMasker);
    Fernet.getInstance().setFernetKey(originalKey);
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void maskedUpdatePreservesAndEncryptsSecretForBothStoragePaths(boolean versionChecked) {
    final IngestionPipeline original = pipeline();
    SecretsManagerFactory.getSecretsManager().encryptIngestionPipeline(original);
    final IngestionPipeline updated = JsonUtils.deepCopy(original, IngestionPipeline.class);
    EntityMaskerFactory.getEntityMasker().maskIngestionPipeline(updated);
    updated.setDescription("Updated description");
    repository.restorePatchSecrets(original, updated);
    if (versionChecked) {
      repository.storeEntityWithVersion(updated, true, 0.1);
    } else {
      repository.storeEntity(updated, true);
    }
    final String token = JsonUtils.readTree(storedJson.get()).at(SECRET_PATH).asText();
    assertTrue(Fernet.isTokenized(token));
    assertEquals(SECRET, Fernet.getInstance().decrypt(token));
    assertFalse(storedJson.get().contains(SECRET));
    assertEquals(
        "Updated description", JsonUtils.readTree(storedJson.get()).path("description").asText());
  }

  @Test
  void versionCheckedWriteStillRejectsStaleVersion() {
    when(dao.updateWithVersion(
            anyString(), anyString(), anyString(), anyString(), anyString(), anyString()))
        .thenReturn(0);
    assertThrows(
        PreconditionFailedException.class,
        () -> repository.storeEntityWithVersion(pipeline(), true, 0.1));
  }

  @Test
  void updaterHistoryEncryptsDecryptedCredentialsWithoutChangingLiveConfig() {
    final IngestionPipeline original = pipeline();
    SecretsManagerFactory.getSecretsManager().encryptIngestionPipeline(original);
    final IngestionPipeline updated = pipeline().withDescription("Updated description");
    final var updater =
        repository
        .new IngestionPipelineUpdater(original, updated, EntityRepository.Operation.PATCH);
    final String history = repository.serializeForVersionHistory(updater.getOriginal());
    final String storedSecret = JsonUtils.readTree(history).at(SECRET_PATH).asText();
    assertTrue(Fernet.isTokenized(storedSecret));
    assertEquals(SECRET, Fernet.getInstance().decrypt(storedSecret));
    assertFalse(history.contains(SECRET));
    assertEquals(SECRET, JsonUtils.valueToTree(updater.getOriginal()).at(SECRET_PATH).asText());
  }

  @Test
  void historyEncryptionDoesNotOverwriteActiveManagedCredential() {
    final InMemorySecretsManager manager =
        InMemorySecretsManager.getInstance(
            new SecretsManager.SecretsConfig("test", "test", List.of(), null));
    SecretsManagerFactory.setSecretsManager(manager);
    final IngestionPipeline active = pipeline();
    manager.encryptIngestionPipeline(active);
    final Map<String, String> existingSecrets = Map.copyOf(manager.getSecretsMap());
    final IngestionPipeline historical =
        JsonUtils.readValue(
            JsonUtils.pojoToJson(pipeline()).replace(SECRET, "previous-secret-value"),
            IngestionPipeline.class);

    final String history = repository.serializeForVersionHistory(historical);

    assertEquals(existingSecrets, manager.getSecretsMap());
    assertEquals(
        "previous-secret-value",
        Fernet.getInstance().decrypt(JsonUtils.readTree(history).at(SECRET_PATH).asText()));
    assertFalse(history.contains("previous-secret-value"));
  }

  @Test
  void sourceComparisonIgnoresEncryptionAndDetectsCredentialChanges() {
    final IngestionPipeline plain = pipeline();
    final IngestionPipeline encrypted =
        JsonUtils.readValue(repository.serializeForVersionHistory(plain), IngestionPipeline.class);
    assertFalse(repository.hasSourceConfigChanged(encrypted, plain));
    assertFalse(repository.hasSourceConfigChanged(plain, encrypted));

    final IngestionPipeline changed =
        JsonUtils.readValue(
            JsonUtils.pojoToJson(plain).replace(SECRET, "replacement-secret-value"),
            IngestionPipeline.class);
    assertTrue(repository.hasSourceConfigChanged(encrypted, changed));
  }

  private void setRepositoryField(String name, Object value) throws Exception {
    final Field field = EntityRepository.class.getDeclaredField(name);
    field.setAccessible(true);
    field.set(repository, value);
  }

  private static IngestionPipeline pipeline() {
    return new IngestionPipeline()
        .withId(UUID.randomUUID())
        .withName("test_pipeline")
        .withFullyQualifiedName("test_service.test_pipeline")
        .withUpdatedBy("admin")
        .withVersion(0.1)
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
                            Map.of("awsSecretAccessKey", SECRET),
                            "prefixConfig",
                            Map.of("containerName", "my_bucket")))));
  }
}
