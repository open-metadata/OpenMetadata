package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.RETURNS_DEEP_STUBS;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.lang.reflect.Field;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.mockito.ArgumentCaptor;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.metadataIngestion.DbtPipeline;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.schema.metadataIngestion.dbtconfig.DbtS3Config;
import org.openmetadata.schema.security.credentials.AWSCredentials;
import org.openmetadata.schema.security.secrets.SecretsManagerProvider;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.PreconditionFailedException;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.secrets.DBSecretsManager;
import org.openmetadata.service.secrets.SecretsManager;
import org.openmetadata.service.secrets.SecretsManagerFactory;

/**
 * An If-Match PATCH never runs {@link IngestionPipelineRepository#storeEntity}: its store is
 * version-checked, so the credentials staged in {@code sourceConfig} must be encrypted before that
 * store runs - on a pipeline whose patch's masker pass restored a stored token into plaintext,
 * anything short of an encryption in {@code storeEntityWithVersion} serializes the plaintext
 * into the new version.
 */
@Execution(ExecutionMode.SAME_THREAD)
class IngestionPipelineStoredCredentialStoreTest {
  private static final String FERNET_KEY = "jJ/9sz0g0OHxsfxOoSfdFdmk3ysNmPRnH3TUAbz3IHA=";
  private static final String PLAIN_PASSWORD = "openmetadata-password";

  private CollectionDAO.IngestionPipelineDAO pipelineDao;
  private IngestionPipelineRepository repository;

  @BeforeEach
  void setUp() throws Exception {
    CollectionDAO daoCollection = mock(CollectionDAO.class, RETURNS_DEEP_STUBS);
    pipelineDao = daoCollection.ingestionPipelineDAO();
    Entity.setCollectionDAO(daoCollection);
    repository = new IngestionPipelineRepository(null);

    // DBSecretsManager caches a JVM-wide singleton with the first caller's configuration, and
    // other classes in the unit lane bootstrap it with no prefix - build this class's own
    // instance so the managed-namespace checks read the cluster name these tests store under.
    resetDbSecretsManagerSingleton();
    SecretsManager secretsManager =
        DBSecretsManager.getInstance(
            SecretsManagerProvider.DB,
            new SecretsManager.SecretsConfig("openmetadata", "prefix", List.of(), null));
    SecretsManagerFactory.setSecretsManager(secretsManager);
    Fernet.getInstance().setFernetKey(FERNET_KEY);

    lenient().when(pipelineDao.getNameHashColumn()).thenReturn("fqnHash");
    lenient()
        .when(pipelineDao.updateWithVersion(any(), any(), any(), any(), any(), any()))
        .thenReturn(1);
  }

  @AfterEach
  void tearDown() throws Exception {
    Entity.cleanup();
    SecretsManagerFactory.setSecretsManager(null);
    resetDbSecretsManagerSingleton();
    Fernet.getInstance().setFernetKey((String) null);
  }

  private static void resetDbSecretsManagerSingleton() throws Exception {
    Field instance = DBSecretsManager.class.getDeclaredField("instance");
    instance.setAccessible(true);
    instance.set(null, null);
  }

  @Test
  void aVersionCheckedStoreEncryptsTheCredentialsPlaintextMaskerUnmaskRestored() {
    IngestionPipeline pipeline = dbtPipeline();
    lenient()
        .when(pipelineDao.findByIdForUpdate(any(), eq(pipeline.getId()), any()))
        .thenReturn("{\"id\":\"" + pipeline.getId() + "\",\"version\":1.0}");

    repository.storeEntityWithVersion(pipeline, true, 1.0);

    ArgumentCaptor<String> storedJson = ArgumentCaptor.forClass(String.class);
    verify(pipelineDao)
        .updateWithVersion(any(), any(), any(), any(), storedJson.capture(), eq("1.0"));
    assertFalse(
        storedJson.getValue().contains(PLAIN_PASSWORD), "the plaintext was stored in the JSON");
    assertTrue(
        storedJson.getValue().contains("fernet:"),
        "the credentials must reach the version-checked store encrypted");
  }

  @Test
  void aStaleVersionIsRejectedBeforeAnyCredentialIsReEncrypted() {
    IngestionPipeline pipeline = dbtPipeline();
    when(pipelineDao.findByIdForUpdate(any(), eq(pipeline.getId()), any()))
        .thenReturn("{\"id\":\"" + pipeline.getId() + "\",\"version\":1.1}");

    assertThrows(
        PreconditionFailedException.class,
        () -> repository.storeEntityWithVersion(pipeline, true, 1.0));

    verify(pipelineDao, never()).updateWithVersion(any(), any(), any(), any(), any(), any());
  }

  private IngestionPipeline dbtPipeline() {
    AWSCredentials credentials =
        new AWSCredentials().withAwsSecretAccessKey(PLAIN_PASSWORD).withAwsRegion("eu-west-1");
    DbtS3Config config = new DbtS3Config().withDbtSecurityConfig(credentials);
    DbtPipeline dbtPipeline = new DbtPipeline().withDbtConfigSource(config);
    return new IngestionPipeline()
        .withId(UUID.randomUUID())
        .withName("my-pipeline")
        .withFullyQualifiedName("test-service.my-pipeline")
        .withService(new DatabaseService().getEntityReference().withType(Entity.DATABASE_SERVICE))
        .withPipelineType(PipelineType.DBT)
        .withVersion(1.0)
        .withSourceConfig(new SourceConfig().withConfig(dbtPipeline));
  }
}
