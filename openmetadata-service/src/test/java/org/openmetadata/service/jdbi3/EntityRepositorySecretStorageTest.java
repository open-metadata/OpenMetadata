/*
 *  Copyright 2026 Collate
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
package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Isolated;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.openmetadata.schema.api.services.DatabaseConnection;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.entity.automations.TestServiceConnectionRequest;
import org.openmetadata.schema.entity.automations.Workflow;
import org.openmetadata.schema.entity.automations.WorkflowType;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.metadataIngestion.DbtPipeline;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.schema.metadataIngestion.dbtconfig.DbtS3Config;
import org.openmetadata.schema.security.credentials.AWSCredentials;
import org.openmetadata.schema.security.secrets.SecretsManagerProvider;
import org.openmetadata.schema.services.connections.database.MysqlConnection;
import org.openmetadata.schema.services.connections.database.common.basicAuth;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.exception.PreconditionFailedException;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.secrets.DBSecretsManager;
import org.openmetadata.service.secrets.InMemorySecretsManager;
import org.openmetadata.service.secrets.SecretsManager;
import org.openmetadata.service.secrets.SecretsManagerFactory;

@Isolated
class EntityRepositorySecretStorageTest {
  private static final String SECRET = "storage-regression-secret";
  private static final String PIPELINE_SECRET =
      "/sourceConfig/config/dbtConfigSource/dbtSecurityConfig/awsSecretAccessKey";
  private final AtomicReference<String> storedJson = new AtomicReference<>();
  private IngestionPipelineRepository repository;
  private CollectionDAO.IngestionPipelineDAO pipelineDAO;
  private SecretsManager previousSecretsManager;

  private enum WritePath {
    CREATE,
    UPDATE,
    CONDITIONAL,
    BULK
  }

  @BeforeEach
  void setUp() {
    previousSecretsManager = SecretsManagerFactory.getSecretsManager();
    SecretsManagerFactory.setSecretsManager(
        DBSecretsManager.getInstance(
            SecretsManagerProvider.DB,
            new SecretsManager.SecretsConfig("secret-storage-test", "", List.of(), null)));
    Fernet.getInstance().setFernetKey("jJ/9sz0g0OHxsfxOoSfdFdmk3ysNmPRnH3TUAbz3IHA=");
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    pipelineDAO = mock(CollectionDAO.IngestionPipelineDAO.class);
    when(collectionDAO.ingestionPipelineDAO()).thenReturn(pipelineDAO);
    when(pipelineDAO.getTableName()).thenReturn("ingestion_pipeline_entity");
    when(pipelineDAO.getNameHashColumn()).thenReturn("nameHash");
    captureWrites(pipelineDAO);
    Entity.setCollectionDAO(collectionDAO);
    repository = new IngestionPipelineRepository(new OpenMetadataApplicationConfig());
  }

  @AfterEach
  void tearDown() {
    Entity.cleanup();
    SecretsManagerFactory.setSecretsManager(previousSecretsManager);
    Fernet.getInstance().setFernetKey((String) null);
  }

  private void captureWrites(CollectionDAO.IngestionPipelineDAO dao) {
    when(dao.findJsonByIdForUpdate(any(UUID.class), eq(Include.ALL)))
        .thenAnswer(invocation -> storedJson.get());
    doAnswer(
            invocation -> {
              storedJson.set(invocation.getArgument(3));
              return null;
            })
        .when(dao)
        .insert(anyString(), anyString(), anyString(), anyString());
    doAnswer(
            invocation -> {
              storedJson.set(invocation.getArgument(2));
              return null;
            })
        .when(dao)
        .update(any(UUID.class), anyString(), anyString());
    doAnswer(
            invocation -> {
              List<String> rows = invocation.getArgument(3);
              storedJson.set(rows.getFirst());
              return null;
            })
        .when(dao)
        .insertMany(anyString(), anyString(), anyList(), anyList());
    when(dao.updateWithVersion(
            anyString(), anyString(), anyString(), anyString(), anyString(), eq("0.1")))
        .thenAnswer(
            invocation -> {
              storedJson.set(invocation.getArgument(4));
              return 1;
            });
  }

  @ParameterizedTest
  @EnumSource(WritePath.class)
  void everyPipelineWriteEncryptsCredentials(WritePath path) {
    IngestionPipeline pipeline = pipeline().withVersion(0.2);
    switch (path) {
      case CREATE -> repository.storeEntity(pipeline, false);
      case UPDATE -> repository.storeEntity(pipeline, true);
      case CONDITIONAL -> {
        repository.storeEntity(pipeline().withId(pipeline.getId()), false);
        repository.storeEntityWithVersion(pipeline, true, 0.1, 1L);
      }
      case BULK -> repository.storeEntities(List.of(pipeline));
    }

    assertEncrypted(storedJson.get(), PIPELINE_SECRET);
    IngestionPipeline stored = JsonUtils.readValue(storedJson.get(), IngestionPipeline.class);
    assertEquals(0.2, stored.getVersion());
    assertFalse(JsonUtils.readTree(storedJson.get()).has("service"));
  }

  @Test
  void staleConditionalWriteLeavesStoredCredentialsUnchanged() {
    IngestionPipeline original = pipeline();
    IngestionPipeline staleUpdate =
        JsonUtils.deepCopy(original, IngestionPipeline.class).withVersion(0.3);
    repository.storeEntity(original, false);
    String originalJson = storedJson.get();

    assertThrows(
        PreconditionFailedException.class,
        () -> repository.storeEntityWithVersion(staleUpdate, true, 0.0, 1L));

    assertEquals(originalJson, storedJson.get());
    assertEncrypted(storedJson.get(), PIPELINE_SECRET);
  }

  @Test
  void pipelineHistoryEncryptsCredentialsWithoutChangingTheSnapshot() {
    IngestionPipeline original = pipeline();
    String originalJson = JsonUtils.pojoToJson(original);

    String history = repository.serializeForVersionHistory(original);

    assertEncrypted(history, PIPELINE_SECRET);
    assertEquals(originalJson, JsonUtils.pojoToJson(original));
    assertEquals(
        original.getService(), JsonUtils.readValue(history, IngestionPipeline.class).getService());
  }

  @Test
  void pipelineHistoryDoesNotOverwriteExternalSecrets() {
    InMemorySecretsManager vault =
        new InMemorySecretsManager(
            new SecretsManager.SecretsConfig("history-storage-test", "", List.of(), null)) {};
    SecretsManagerFactory.setSecretsManager(vault);
    IngestionPipeline current = pipeline("rotated-secret");
    vault.encryptIngestionPipeline(current);
    Map<String, String> liveSecrets = Map.copyOf(vault.getSecretsMap());

    assertEncrypted(repository.serializeForVersionHistory(pipeline()), PIPELINE_SECRET);
    String reference =
        Fernet.getInstance()
            .decrypt(
                JsonUtils.readTree(JsonUtils.pojoToJson(current)).at(PIPELINE_SECRET).asText());
    String history = repository.serializeForVersionHistory(current);

    assertTrue(reference.startsWith("secret:"));
    assertEquals(
        reference,
        Fernet.getInstance().decrypt(JsonUtils.readTree(history).at(PIPELINE_SECRET).asText()));
    assertEquals(liveSecrets, vault.getSecretsMap());
  }

  @Test
  void rejectedConditionalWriteDoesNotOverwriteExternalSecrets() {
    InMemorySecretsManager vault =
        new InMemorySecretsManager(
            new SecretsManager.SecretsConfig("conditional-storage-test", "", List.of(), null)) {};
    SecretsManagerFactory.setSecretsManager(vault);
    IngestionPipeline winner = pipeline("winning-secret").withVersion(0.2);
    IngestionPipeline staleUpdate =
        pipeline("rejected-secret").withId(winner.getId()).withVersion(0.2);
    repository.storeEntity(winner, false);
    String committedJson = storedJson.get();
    Map<String, String> committedSecrets = Map.copyOf(vault.getSecretsMap());
    when(pipelineDAO.updateWithVersion(
            anyString(), anyString(), anyString(), anyString(), anyString(), eq("0.1")))
        .thenReturn(0);

    assertThrows(
        PreconditionFailedException.class,
        () -> repository.storeEntityWithVersion(staleUpdate, true, 0.1, 1L));

    assertEquals(committedJson, storedJson.get());
    assertEquals(committedSecrets, vault.getSecretsMap());
  }

  @Test
  void botStorageEncryptsAuthenticationCredentials() {
    User bot =
        new User()
            .withName("storage-bot")
            .withIsBot(true)
            .withAuthenticationMechanism(
                new AuthenticationMechanism()
                    .withAuthType(AuthenticationMechanism.AuthType.JWT)
                    .withConfig(new JWTAuthMechanism().withJWTToken(SECRET)));

    assertEncrypted(
        new UserRepository().serializeForStorage(bot), "/authenticationMechanism/config/JWTToken");
  }

  @Test
  void workflowStorageEncryptsTheConvertedConnection() {
    Workflow workflow =
        new Workflow()
            .withName("storage-workflow")
            .withWorkflowType(WorkflowType.TEST_CONNECTION)
            .withRequest(
                new TestServiceConnectionRequest()
                    .withServiceType(ServiceType.DATABASE)
                    .withConnectionType("Mysql")
                    .withConnection(
                        new DatabaseConnection()
                            .withConfig(
                                new MysqlConnection()
                                    .withHostPort("localhost:3306")
                                    .withUsername("test")
                                    .withAuthType(new basicAuth().withPassword(SECRET)))));

    assertEncrypted(
        new WorkflowRepository().serializeForStorage(workflow),
        "/request/connection/config/authType/password");
  }

  private static IngestionPipeline pipeline() {
    return pipeline(SECRET);
  }

  private static IngestionPipeline pipeline(String secret) {
    return new IngestionPipeline()
        .withId(UUID.randomUUID())
        .withName("storage-pipeline")
        .withFullyQualifiedName("service.storage-pipeline")
        .withVersion(0.1)
        .withService(
            new EntityReference().withId(UUID.randomUUID()).withType(Entity.DATABASE_SERVICE))
        .withPipelineType(PipelineType.DBT)
        .withSourceConfig(
            new SourceConfig()
                .withConfig(
                    new DbtPipeline()
                        .withDbtConfigSource(
                            new DbtS3Config()
                                .withDbtSecurityConfig(
                                    new AWSCredentials()
                                        .withAwsAccessKeyId("test-access-key")
                                        .withAwsSecretAccessKey(secret)
                                        .withAwsRegion("us-east-1")))));
  }

  private static void assertEncrypted(String json, String secretPath) {
    assertFalse(json.contains(SECRET));
    String ciphertext = JsonUtils.readTree(json).at(secretPath).asText();
    assertTrue(Fernet.isTokenized(ciphertext));
    assertEquals(SECRET, Fernet.getInstance().decrypt(ciphertext));
  }
}
