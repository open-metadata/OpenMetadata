package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.node.ArrayNode;
import java.sql.SQLException;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicInteger;
import org.jdbi.v3.core.transaction.TransactionException;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.UserTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.schema.api.services.CreateDatabaseService.DatabaseServiceType;
import org.openmetadata.schema.api.services.CreateMessagingService;
import org.openmetadata.schema.api.services.CreateMessagingService.MessagingServiceType;
import org.openmetadata.schema.api.services.DatabaseConnection;
import org.openmetadata.schema.api.services.ingestionPipelines.CreateIngestionPipeline;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.MessagingService;
import org.openmetadata.schema.entity.services.ingestionPipelines.AirflowConfig;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.governance.changeRequest.ChangeRequest;
import org.openmetadata.schema.governance.changeRequest.MutationOp;
import org.openmetadata.schema.metadataIngestion.DbtPipeline;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.schema.metadataIngestion.dbtconfig.DbtHttpConfig;
import org.openmetadata.schema.metadataIngestion.dbtconfig.DbtHttpHeaders;
import org.openmetadata.schema.services.connections.database.SnowflakeConnection;
import org.openmetadata.schema.services.connections.messaging.ConsumerConfig;
import org.openmetadata.schema.services.connections.messaging.KafkaConnection;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MessagingConnection;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.exceptions.ForbiddenException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.IngestionPipelineRepository;
import org.openmetadata.service.jdbi3.MessagingServiceRepository;
import org.openmetadata.service.secrets.ExternalSecretsManager;
import org.openmetadata.service.secrets.InMemorySecretsManager;
import org.openmetadata.service.secrets.SecretsManager;
import org.openmetadata.service.secrets.SecretsManagerFactory;
import org.openmetadata.service.util.PostCommitActionQueue;
import org.openmetadata.service.util.RequestEntityCache;

/**
 * Reproduces issue #21259 end to end: a Snowflake service is created with both a password and a
 * private key, then saved again with the password cleared — exactly what the UI sends when a user
 * types into the password field and deletes it again. The credential must disappear from the vault
 * instead of being written there as the literal string {@code "null"}, which downstream consumers
 * (the Snowflake driver, for one) would happily use as a real password.
 *
 * <p>The suite's server runs the {@code db} secrets manager, so the class swaps in the in-memory
 * external manager for the duration of the test and restores the original afterwards. {@code
 * @Isolated} keeps any other test class from observing the swapped singleton.
 */
@Isolated("swaps the process-wide secrets manager singleton")
@ExtendWith(TestNamespaceExtension.class)
public class SecretsManagerNullSecretIT {

  private static final String CLUSTER_NAME = "openmetadata";
  private static final String DATABASE_SERVICES_PATH = "/v1/services/databaseServices";
  private static final String MESSAGING_SERVICES_PATH = "/v1/services/messagingServices";
  private static final String PASSWORD = "s3cr3t";
  private static final String PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----";

  private static SecretsManager originalSecretsManager;
  private static InMemorySecretsManager vault;

  @BeforeAll
  static void installInMemoryVault() {
    UserTestFactory.getDataConsumer(null);
    originalSecretsManager = SecretsManagerFactory.getSecretsManager();
    vault =
        InMemorySecretsManager.getInstance(
            new SecretsManager.SecretsConfig(CLUSTER_NAME, null, List.of(), null));
    SecretsManagerFactory.setSecretsManager(vault);
  }

  @AfterAll
  static void restoreSecretsManager() {
    SecretsManagerFactory.setSecretsManager(originalSecretsManager);
    vault.getSecretsMap().clear();
  }

  @ParameterizedTest
  @CsvSource({
    "entry,false",
    "map,false",
    "number,false",
    "null,false",
    "empty,false",
    "entry,true",
    "map,true",
    "number,true",
    "null,true",
    "empty,true"
  })
  void removingAMapCredentialDoesNotLeaveASecretAfterHardDelete(
      String removal, boolean patch, TestNamespace ns) {
    String serviceName = ns.prefix("kafka_map_" + removal + "_" + patch);
    String userSecretId = "/user/" + serviceName;
    vault.upsertSecret(userSecretId, "user-owned");
    KafkaConnection connection =
        new KafkaConnection()
            .withBootstrapServers("broker:9092")
            .withSaslPassword(PASSWORD)
            .withConsumerConfig(
                new ConsumerConfig()
                    .withAdditionalProperty("user.reference", "secret:" + userSecretId));
    CreateMessagingService request =
        new CreateMessagingService()
            .withName(serviceName)
            .withServiceType(MessagingServiceType.Kafka)
            .withConnection(new MessagingConnection().withConfig(connection));
    MessagingService service = SdkClients.adminClient().messagingServices().create(request);
    ns.trackRoot(Entity.MESSAGING_SERVICE, service);
    String root = entitySecretRoot("messaging", serviceName);
    String entryId = root + "/consumerconfig/additionalproperties/client_secret";
    connection.getConsumerConfig().setAdditionalProperty("client.secret", PASSWORD);
    SdkClients.adminClient()
        .getHttpClient()
        .execute(HttpMethod.PUT, MESSAGING_SERVICES_PATH, request, MessagingService.class);
    assertEquals(PASSWORD, vault.getSecretsMap().get(entryId));

    connection.getConsumerConfig().getAdditionalProperties().remove("user.reference");
    switch (removal) {
      case "entry" -> connection.getConsumerConfig().getAdditionalProperties().clear();
      case "map" -> connection.setConsumerConfig(null);
      case "number" -> connection.getConsumerConfig().setAdditionalProperty("client.secret", 42);
      case "null" -> connection.getConsumerConfig().setAdditionalProperty("client.secret", null);
      case "empty" -> connection.getConsumerConfig().setAdditionalProperty("client.secret", "");
      default -> throw new IllegalArgumentException(removal);
    }
    assertThrows(
        ForbiddenException.class,
        () ->
            SdkClients.dataConsumerClient()
                .getHttpClient()
                .execute(HttpMethod.PUT, MESSAGING_SERVICES_PATH, request, MessagingService.class));
    assertEquals(PASSWORD, vault.getSecretsMap().get(entryId));
    if (patch) {
      ArrayNode changes = JsonUtils.getObjectMapper().createArrayNode();
      changes
          .addObject()
          .put("op", "replace")
          .put("path", "/connection/config")
          .set("value", JsonUtils.valueToTree(connection));
      SdkClients.adminClient().messagingServices().patch(service.getId(), changes);
    } else {
      SdkClients.adminClient()
          .getHttpClient()
          .execute(HttpMethod.PUT, MESSAGING_SERVICES_PATH, request, MessagingService.class);
    }
    assertFalse(vault.getSecretsMap().containsKey(entryId));
    assertEquals(PASSWORD, vault.getSecretsMap().get(root + "/saslpassword"));

    SdkClients.adminClient()
        .messagingServices()
        .delete(service.getId().toString(), Map.of("hardDelete", "true", "recursive", "true"));
    assertFalse(vault.getSecretsMap().keySet().stream().anyMatch(id -> id.startsWith(root + "/")));
    assertEquals("user-owned", vault.getSecretsMap().get(userSecretId));
  }

  @Test
  void clearingAPasswordRemovesTheSecretInsteadOfStoringNull(TestNamespace ns) {
    String serviceName = ns.prefix("snowflake_null_secret");
    SnowflakeConnection connection =
        new SnowflakeConnection()
            .withAccount("test-account")
            .withUsername("test_user")
            .withWarehouse("test_warehouse")
            .withPassword(PASSWORD)
            .withPrivateKey(PRIVATE_KEY);
    CreateDatabaseService request =
        new CreateDatabaseService()
            .withName(serviceName)
            .withServiceType(DatabaseServiceType.Snowflake)
            .withConnection(new DatabaseConnection().withConfig(connection));

    DatabaseService service = SdkClients.adminClient().databaseServices().create(request);
    ns.trackRoot(Entity.DATABASE_SERVICE, service);

    Map<String, String> secrets = vault.getSecretsMap();
    assertEquals(PASSWORD, secrets.get(secretId(serviceName, "password")));
    assertEquals(PRIVATE_KEY, secrets.get(secretId(serviceName, "privatekey")));

    // Saving an edited service is a PUT of the same create request, not a second POST — which the
    // server rejects as a duplicate. This is the call the UI makes when the user hits Save.
    connection.withPassword("");
    DatabaseService cleared =
        SdkClients.adminClient()
            .getHttpClient()
            .execute(HttpMethod.PUT, DATABASE_SERVICES_PATH, request, DatabaseService.class);

    assertFalse(
        secrets.containsKey(secretId(serviceName, "password")),
        "Clearing the password must remove the secret, not store it as \"null\"");
    assertEquals(
        PRIVATE_KEY,
        secrets.get(secretId(serviceName, "privatekey")),
        "Clearing one credential must leave the others untouched");
    assertNull(
        connectionOf(cleared).getPassword(),
        "The connection must not keep a reference to the removed secret");
  }

  @Test
  void removingDbtHeadersDeletesTheirExternalSecrets(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    String pipelineName = ns.prefix("dbt_header_removal");
    DbtHttpConfig config =
        new DbtHttpConfig()
            .withDbtManifestHttpPath("https://example.com/manifest.json")
            .withDbtHttpHeaders(
                new DbtHttpHeaders().withAdditionalProperty("Authorization", PASSWORD));
    CreateIngestionPipeline request =
        new CreateIngestionPipeline()
            .withName(pipelineName)
            .withPipelineType(PipelineType.DBT)
            .withService(service.getEntityReference())
            .withSourceConfig(
                new SourceConfig().withConfig(new DbtPipeline().withDbtConfigSource(config)))
            .withAirflowConfig(
                new AirflowConfig()
                    .withStartDate(Date.from(Instant.parse("2024-01-01T00:00:00Z"))));
    IngestionPipeline pipeline = SdkClients.adminClient().ingestionPipelines().create(request);
    ns.trackRoot(Entity.INGESTION_PIPELINE, pipeline);
    String entryId = dbtHeaderId(pipeline.getId());
    assertEquals(PASSWORD, vault.getSecretsMap().get(entryId));

    config.setDbtHttpHeaders(null);
    SdkClients.adminClient()
        .getHttpClient()
        .execute(
            HttpMethod.PUT, "/v1/services/ingestionPipelines", request, IngestionPipeline.class);

    assertFalse(vault.getSecretsMap().containsKey(entryId));
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void hardDeletingADbtPipelineCleansItsHeaders(boolean cascade, TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    String pipelineName = ns.prefix("dbt_delete_" + cascade);
    String userId = "/user/" + pipelineName;
    vault.upsertSecret(userId, "user-owned");
    IngestionPipeline pipeline =
        SdkClients.adminClient()
            .ingestionPipelines()
            .create(
                dbtRequest(
                    service,
                    pipelineName,
                    Map.of("Authorization", PASSWORD, "User", "secret:" + userId)));
    String entryId = dbtHeaderId(pipeline.getId());
    assertEquals(PASSWORD, vault.getSecretsMap().get(entryId));

    if (cascade) {
      SdkClients.adminClient()
          .databaseServices()
          .delete(service.getId().toString(), Map.of("hardDelete", "true", "recursive", "true"));
    } else {
      SdkClients.adminClient()
          .ingestionPipelines()
          .delete(pipeline.getId().toString(), Map.of("hardDelete", "true"));
    }

    assertFalse(vault.getSecretsMap().containsKey(entryId));
    assertEquals("user-owned", vault.getSecretsMap().get(userId));
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void delayedServiceCleanupSurvivesHardDelete(boolean recreate, TestNamespace ns) {
    String name = ns.prefix("delayed_service_" + recreate);
    MessagingService created =
        SdkClients.adminClient()
            .messagingServices()
            .create(kafkaRequest(name, Map.of("credential", PASSWORD)));
    MessagingServiceRepository repository =
        (MessagingServiceRepository) Entity.getEntityRepository(Entity.MESSAGING_SERVICE);
    MessagingService original = repository.get(null, created.getId(), repository.getFields("*"));
    MessagingService updated = JsonUtils.deepCopy(original, MessagingService.class);
    updated.setConnection(kafkaRequest(name, Map.of()).getConnection());
    List<Runnable> delayed = deferUpdate(repository, original, updated);
    String entryId =
        entitySecretRoot("messaging", name) + "/consumerconfig/additionalproperties/credential";
    assertEquals(PASSWORD, vault.getSecretsMap().get(entryId));

    SdkClients.adminClient()
        .messagingServices()
        .delete(created.getId().toString(), Map.of("hardDelete", "true", "recursive", "true"));
    assertFalse(vault.getSecretsMap().containsKey(entryId));
    updated.setConnection(kafkaRequest(name, Map.of("credential", "stale")).getConnection());
    assertThrows(EntityNotFoundException.class, () -> repository.storeEntity(updated, true));
    if (recreate) {
      MessagingService replacement =
          SdkClients.adminClient()
              .messagingServices()
              .create(kafkaRequest(name, Map.of("credential", "replacement")));
      ns.trackRoot(Entity.MESSAGING_SERVICE, replacement);
    }
    PostCommitActionQueue.run(delayed);
    assertEquals(recreate ? "replacement" : null, vault.getSecretsMap().get(entryId));
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void delayedPipelineCleanupSurvivesHardDelete(boolean recreate, TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    String name = ns.prefix("delayed_pipeline_" + recreate);
    IngestionPipeline created =
        SdkClients.adminClient()
            .ingestionPipelines()
            .create(dbtRequest(service, name, Map.of("Authorization", PASSWORD)));
    IngestionPipelineRepository repository =
        (IngestionPipelineRepository) Entity.getEntityRepository(Entity.INGESTION_PIPELINE);
    IngestionPipeline original = repository.get(null, created.getId(), repository.getFields("*"));
    IngestionPipeline updated = JsonUtils.deepCopy(original, IngestionPipeline.class);
    updated.setSourceConfig(dbtRequest(service, name, Map.of()).getSourceConfig());
    List<Runnable> delayed = deferUpdate(repository, original, updated);
    String entryId = dbtHeaderId(created.getId());
    assertEquals(PASSWORD, vault.getSecretsMap().get(entryId));

    SdkClients.adminClient()
        .ingestionPipelines()
        .delete(created.getId().toString(), Map.of("hardDelete", "true"));
    assertFalse(vault.getSecretsMap().containsKey(entryId));
    updated.setSourceConfig(
        dbtRequest(service, name, Map.of("Authorization", "stale")).getSourceConfig());
    assertThrows(EntityNotFoundException.class, () -> repository.storeEntity(updated, true));
    String currentEntryId = entryId;
    if (recreate) {
      IngestionPipeline replacement =
          SdkClients.adminClient()
              .ingestionPipelines()
              .create(dbtRequest(service, name, Map.of("Authorization", "replacement")));
      ns.trackRoot(Entity.INGESTION_PIPELINE, replacement);
      currentEntryId = dbtHeaderId(replacement.getId());
    }
    PostCommitActionQueue.run(delayed);
    assertFalse(vault.getSecretsMap().containsKey(entryId));
    assertEquals(recreate ? "replacement" : null, vault.getSecretsMap().get(currentEntryId));
  }

  private static <T extends EntityInterface<?>> List<Runnable> deferUpdate(
      EntityRepository<T> repository, T original, T updated) {
    assertTrue(PostCommitActionQueue.begin());
    try {
      repository.update(null, original, updated, "admin");
      return PostCommitActionQueue.drain();
    } finally {
      PostCommitActionQueue.clear();
      RequestEntityCache.clear();
    }
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void rollingBackAnEmptyMapEntryKeepsItsCredential(boolean wrapped, TestNamespace ns) {
    String name = ns.prefix("rollback_empty_map_" + wrapped);
    MessagingService created =
        SdkClients.adminClient()
            .messagingServices()
            .create(kafkaRequest(name, Map.of("credential", PASSWORD)));
    ns.trackRoot(Entity.MESSAGING_SERVICE, created);
    MessagingServiceRepository repository =
        (MessagingServiceRepository) Entity.getEntityRepository(Entity.MESSAGING_SERVICE);
    MessagingService original = repository.get(null, created.getId(), repository.getFields("*"));
    MessagingService updated = JsonUtils.deepCopy(original, MessagingService.class);
    updated.setConnection(
        kafkaRequest(name, Map.of("credential", wrapped ? Fernet.getInstance().encrypt("") : ""))
            .getConnection());
    MessagingService stored =
        Entity.getCollectionDAO()
            .messagingServiceDAO()
            .findEntityById(created.getId(), Include.ALL);
    assertThrows(
        IllegalStateException.class,
        () ->
            repository.executeInTransaction(
                () -> {
                  repository.storeEntity(updated, true);
                  throw new IllegalStateException("Injected failure after storage, before commit");
                }));
    RequestEntityCache.clear();
    assertEquals(
        stored,
        Entity.getCollectionDAO()
            .messagingServiceDAO()
            .findEntityById(created.getId(), Include.ALL));
    assertEquals(
        PASSWORD,
        vault
            .getSecretsMap()
            .get(
                entitySecretRoot("messaging", name)
                    + "/consumerconfig/additionalproperties/credential"));
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void anOuterCreateRetryRetainsSecretOwnership(boolean writeTwice, TestNamespace ns) {
    String name = ns.prefix("retry_owned_secret_" + writeTwice);
    MessagingService entity =
        new MessagingService()
            .withId(UUID.randomUUID())
            .withName(name)
            .withFullyQualifiedName(name)
            .withServiceType(MessagingServiceType.Kafka)
            .withConnection(kafkaRequest(name, Map.of("credential", PASSWORD)).getConnection())
            .withVersion(0.1)
            .withUpdatedBy("admin")
            .withUpdatedAt(System.currentTimeMillis())
            .withDeleted(false);
    MessagingServiceRepository repository =
        (MessagingServiceRepository) Entity.getEntityRepository(Entity.MESSAGING_SERVICE);
    AtomicInteger attempts = new AtomicInteger();
    repository.executeInTransaction(
        () -> {
          KafkaConnection input =
              JsonUtils.convertValue(entity.getConnection().getConfig(), KafkaConnection.class);
          assertEquals(
              PASSWORD, input.getConsumerConfig().getAdditionalProperties().get("credential"));
          repository.storeEntity(entity, false);
          if (writeTwice) {
            repository.storeEntity(entity, true);
          }
          if (attempts.incrementAndGet() == 1) {
            throw new TransactionException(
                "Injected deadlock after entity storage",
                new SQLException("Deadlock found when trying to get lock", "40001", 1213));
          }
          return null;
        });
    assertEquals(2, attempts.get());
    SdkClients.adminClient()
        .messagingServices()
        .delete(entity.getId().toString(), Map.of("hardDelete", "true", "recursive", "true"));
    assertFalse(
        vault
            .getSecretsMap()
            .containsKey(
                entitySecretRoot("messaging", name)
                    + "/consumerconfig/additionalproperties/credential"));
  }

  private static CreateIngestionPipeline dbtRequest(
      DatabaseService service, String name, Map<String, String> headers) {
    DbtHttpHeaders values = new DbtHttpHeaders();
    headers.forEach(values::setAdditionalProperty);
    return new CreateIngestionPipeline()
        .withName(name)
        .withPipelineType(PipelineType.DBT)
        .withService(service.getEntityReference())
        .withSourceConfig(
            new SourceConfig()
                .withConfig(
                    new DbtPipeline()
                        .withDbtConfigSource(
                            new DbtHttpConfig()
                                .withDbtManifestHttpPath("https://example.com/manifest.json")
                                .withDbtHttpHeaders(values))))
        .withAirflowConfig(
            new AirflowConfig().withStartDate(Date.from(Instant.parse("2024-01-01T00:00:00Z"))));
  }

  private static String dbtHeaderId(UUID pipelineId) {
    return entitySecretRoot("pipeline", pipelineId.toString())
        + "/sourceconfig/config/dbtconfigsource/dbthttpheaders/additionalproperties/authorization";
  }

  @Test
  void readdingACredentialWaitsForThePreviousRemoval(TestNamespace ns) throws Exception {
    BlockingVault blockingVault = new BlockingVault();
    SecretsManagerFactory.setSecretsManager(blockingVault);
    String serviceName = ns.prefix("concurrent_map_removal");
    String entryId =
        entitySecretRoot("messaging", serviceName)
            + "/consumerconfig/additionalproperties/credential";
    try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
      MessagingService service =
          SdkClients.adminClient()
              .messagingServices()
              .create(kafkaRequest(serviceName, Map.of("credential", PASSWORD)));
      ns.trackRoot(Entity.MESSAGING_SERVICE, service);
      blockingVault.blockedSecret = entryId;
      try {
        var removal =
            executor.submit(
                () ->
                    SdkClients.adminClient()
                        .getHttpClient()
                        .execute(
                            HttpMethod.PUT,
                            MESSAGING_SERVICES_PATH,
                            kafkaRequest(serviceName, Map.of()),
                            MessagingService.class));
        assertTrue(blockingVault.deleting.await(20, TimeUnit.SECONDS));
        CountDownLatch readdStarted = new CountDownLatch(1);
        var readd =
            executor.submit(
                () -> {
                  readdStarted.countDown();
                  return SdkClients.adminClient()
                      .getHttpClient()
                      .execute(
                          HttpMethod.PUT,
                          MESSAGING_SERVICES_PATH,
                          kafkaRequest(serviceName, Map.of("credential", "replacement")),
                          MessagingService.class);
                });
        assertTrue(readdStarted.await(20, TimeUnit.SECONDS));
        assertThrows(TimeoutException.class, () -> readd.get(1, TimeUnit.SECONDS));
        blockingVault.release.countDown();
        removal.get(20, TimeUnit.SECONDS);
        readd.get(20, TimeUnit.SECONDS);
        assertEquals("replacement", blockingVault.getSecretsMap().get(entryId));
      } finally {
        blockingVault.release.countDown();
      }
    } finally {
      SecretsManagerFactory.setSecretsManager(vault);
    }
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void aliasedOwnedSecretIsDeletedWithItsLastReference(boolean hardDelete, TestNamespace ns) {
    String name = ns.prefix("owned_alias_" + hardDelete);
    MessagingService service =
        SdkClients.adminClient()
            .messagingServices()
            .create(kafkaRequest(name, Map.of("credential", PASSWORD)));
    ns.trackRoot(Entity.MESSAGING_SERVICE, service);
    String entryId =
        entitySecretRoot("messaging", name) + "/consumerconfig/additionalproperties/credential";
    SdkClients.adminClient()
        .getHttpClient()
        .execute(
            HttpMethod.PUT,
            MESSAGING_SERVICES_PATH,
            kafkaRequest(name, Map.of("alias", "secret:" + entryId)),
            MessagingService.class);
    assertEquals(PASSWORD, vault.getSecretsMap().get(entryId));
    if (hardDelete) {
      SdkClients.adminClient()
          .messagingServices()
          .delete(service.getId().toString(), Map.of("hardDelete", "true", "recursive", "true"));
    } else {
      SdkClients.adminClient()
          .getHttpClient()
          .execute(
              HttpMethod.PUT,
              MESSAGING_SERVICES_PATH,
              kafkaRequest(name, Map.of()),
              MessagingService.class);
    }
    assertFalse(vault.getSecretsMap().containsKey(entryId));
  }

  private static CreateMessagingService kafkaRequest(String name, Map<String, String> entries) {
    return new CreateMessagingService()
        .withName(name)
        .withServiceType(MessagingServiceType.Kafka)
        .withConnection(
            new MessagingConnection()
                .withConfig(Map.of("bootstrapServers", "broker:9092", "consumerConfig", entries)));
  }

  @Test
  void aCleanupFailureDoesNotRollBackToDeletedCredentials(TestNamespace ns) {
    InMemorySecretsManager failingVault =
        new InMemorySecretsManager(
            new SecretsManager.SecretsConfig(CLUSTER_NAME, null, List.of(), null)) {
          private int deletions;

          @Override
          protected void deleteSecretInternal(String secretName) {
            if (++deletions == 2) {
              throw new IllegalStateException("Injected second-delete failure");
            }
            super.deleteSecretInternal(secretName);
          }
        };
    SecretsManagerFactory.setSecretsManager(failingVault);
    try {
      String serviceName = ns.prefix("failed_map_cleanup");
      MessagingService service =
          SdkClients.adminClient()
              .messagingServices()
              .create(kafkaRequest(serviceName, Map.of("first", PASSWORD, "second", PASSWORD)));
      ns.trackRoot(Entity.MESSAGING_SERVICE, service);

      SdkClients.adminClient()
          .getHttpClient()
          .execute(
              HttpMethod.PUT,
              MESSAGING_SERVICES_PATH,
              kafkaRequest(serviceName, Map.of()),
              MessagingService.class);

      MessagingService persisted =
          SdkClients.ingestionBotClient().messagingServices().get(service.getId());
      KafkaConnection connection =
          JsonUtils.convertValue(persisted.getConnection().getConfig(), KafkaConnection.class);
      assertTrue(connection.getConsumerConfig().getAdditionalProperties().isEmpty());
      assertEquals(1, failingVault.getSecretsMap().size());
      SdkClients.adminClient()
          .messagingServices()
          .delete(service.getId().toString(), Map.of("hardDelete", "true", "recursive", "true"));
      assertTrue(
          failingVault.getSecretsMap().isEmpty(),
          "Hard deletion must retry durable pending cleanup");
    } finally {
      SecretsManagerFactory.setSecretsManager(vault);
    }
  }

  private static class BlockingVault extends InMemorySecretsManager {
    private final CountDownLatch deleting = new CountDownLatch(1);
    private final CountDownLatch release = new CountDownLatch(1);
    private volatile String blockedSecret;

    private BlockingVault() {
      super(new SecretsManager.SecretsConfig(CLUSTER_NAME, null, List.of(), null));
    }

    @Override
    protected void deleteSecretInternal(String secretName) {
      if (secretName.equals(blockedSecret)) {
        deleting.countDown();
        try {
          if (!release.await(20, TimeUnit.SECONDS)) {
            throw new IllegalStateException("Timed out waiting to finish credential removal");
          }
        } catch (InterruptedException e) {
          Thread.currentThread().interrupt();
          throw new IllegalStateException(e);
        }
      }
      super.deleteSecretInternal(secretName);
    }
  }

  @Test
  void aSecretAlreadyStoredAsNullResolvesToNoValue(TestNamespace ns) {
    String secretId = secretId(ns.prefix("legacy_null_secret"), "password");
    vault.getSecretsMap().put(secretId, ExternalSecretsManager.NULL_SECRET_STRING);

    assertNull(
        vault.getSecretValue(SecretsManager.SECRET_FIELD_PREFIX + secretId),
        "A service stored before the fix must read back no credential, not the string \"null\"");
  }

  @ParameterizedTest
  @ValueSource(strings = {"replacement-password", ""})
  void aDeniedServiceUpdateLeavesStoredCredentialsUntouched(String password, TestNamespace ns) {
    String serviceName = ns.prefix("denied_secret_update");
    SnowflakeConnection connection =
        new SnowflakeConnection()
            .withAccount("test-account")
            .withUsername("test_user")
            .withPassword(PASSWORD)
            .withPrivateKey(PRIVATE_KEY);
    CreateDatabaseService request =
        new CreateDatabaseService()
            .withName(serviceName)
            .withServiceType(DatabaseServiceType.Snowflake)
            .withConnection(new DatabaseConnection().withConfig(connection));
    DatabaseService service = SdkClients.adminClient().databaseServices().create(request);
    ns.trackRoot(Entity.DATABASE_SERVICE, service);

    connection.withPassword(password);
    ForbiddenException denied =
        assertThrows(
            ForbiddenException.class,
            () ->
                SdkClients.dataConsumerClient()
                    .getHttpClient()
                    .execute(
                        HttpMethod.PUT, DATABASE_SERVICES_PATH, request, DatabaseService.class));

    assertEquals(403, denied.getStatusCode());
    assertEquals(PASSWORD, vault.getSecretsMap().get(secretId(serviceName, "password")));
    assertEquals(PRIVATE_KEY, vault.getSecretsMap().get(secretId(serviceName, "privatekey")));
    DatabaseService unchanged =
        SdkClients.adminClient()
            .getHttpClient()
            .execute(
                HttpMethod.GET,
                DATABASE_SERVICES_PATH + "/" + service.getId(),
                null,
                DatabaseService.class);
    assertEquals(service.getVersion(), unchanged.getVersion());
  }

  @Test
  void anExternalPlaintextReplacementIsRecordedButAReferenceRoundTripIsNot(TestNamespace ns) {
    String serviceName = ns.prefix("external_replacement");
    CreateDatabaseService request = request(serviceName);
    DatabaseService original = SdkClients.adminClient().databaseServices().create(request);
    ns.trackRoot(Entity.DATABASE_SERVICE, original);

    DatabaseService replaced = put(request);
    assertTrue(
        replaced.getChangeDescription().getFieldsUpdated().stream()
            .anyMatch(field -> "connection".equals(field.getName())));
    assertEquals(PASSWORD, vault.getSecretsMap().get(secretId(serviceName, "password")));

    SnowflakeConnection referenceConfig =
        connectionOf(original)
            .withPassword(SecretsManager.SECRET_FIELD_PREFIX + secretId(serviceName, "password"))
            .withPrivateKey(
                SecretsManager.SECRET_FIELD_PREFIX + secretId(serviceName, "privatekey"));
    request.setConnection(new DatabaseConnection().withConfig(referenceConfig));
    assertEquals(replaced.getVersion(), put(request).getVersion());
  }

  @Test
  void identicalDatabaseCredentialsRemainANoOp(TestNamespace ns) {
    SecretsManagerFactory.setSecretsManager(originalSecretsManager);
    try {
      CreateDatabaseService request = request(ns.prefix("db_secret_noop"));
      DatabaseService original = SdkClients.adminClient().databaseServices().create(request);
      ns.trackRoot(Entity.DATABASE_SERVICE, original);

      assertEquals(original.getVersion(), put(request).getVersion());
    } finally {
      SecretsManagerFactory.setSecretsManager(vault);
    }
  }

  @Test
  void aPendingApprovalKeepsSecretsEncryptedAndLeavesTheVaultUntouched(TestNamespace ns) {
    String serviceName = ns.prefix("pending_secret_update");
    CreateDatabaseService request = request(serviceName);
    DatabaseService original = SdkClients.adminClient().databaseServices().create(request);
    ns.trackRoot(Entity.DATABASE_SERVICE, original);
    ChangeRequestITSupport.deployHookWorkflowFor(
        ns,
        Entity.DATABASE_SERVICE,
        "\"description\"",
        "",
        ChangeRequestITSupport.filterScopedTo(
            Entity.DATABASE_SERVICE, original.getFullyQualifiedName()));
    request.withDescription("proposed description");
    request.setConnection(
        new DatabaseConnection()
            .withConfig(connectionOf(original).withPassword("proposed-password")));

    DatabaseService held = put(request);
    assertEquals(original.getVersion(), held.getVersion());
    assertEquals(PASSWORD, vault.getSecretsMap().get(secretId(serviceName, "password")));
    ChangeRequest pending = ChangeRequestITSupport.onlyPendingRequest(original.getId());
    ChangeRequest response =
        SdkClients.adminClient()
            .getHttpClient()
            .execute(
                HttpMethod.GET, "/v1/changeRequests/" + pending.getId(), null, ChangeRequest.class);
    MutationOp connection =
        response.getActiveRevision().getOps().stream()
            .filter(op -> "connection".equals(op.getField()))
            .findFirst()
            .orElseThrow();
    SnowflakeConnection proposed =
        JsonUtils.convertValue(
            JsonUtils.readValue(connection.getValue(), DatabaseConnection.class).getConfig(),
            SnowflakeConnection.class);
    assertTrue(Fernet.isTokenized(proposed.getPassword()));
    assertEquals("proposed-password", Fernet.getInstance().decrypt(proposed.getPassword()));
    assertFalse(JsonUtils.pojoToJson(response).contains("proposed-password"));
  }

  /** A PUT that omits the connection keeps the stored one and its vault secrets (#29494). */
  @Test
  void aPutWithoutAConnectionKeepsTheStoredConnectionAndItsSecrets(TestNamespace ns) {
    String serviceName = ns.prefix("put_without_connection");
    CreateDatabaseService request = request(serviceName);
    DatabaseService original = SdkClients.adminClient().databaseServices().create(request);
    ns.trackRoot(Entity.DATABASE_SERVICE, original);
    request.withDescription("described without a connection").setConnection(null);

    DatabaseService updated = put(request);

    assertTrue(
        updated.getChangeDescription().getFieldsUpdated().stream()
            .noneMatch(field -> "connection".equals(field.getName())));
    assertEquals(PASSWORD, vault.getSecretsMap().get(secretId(serviceName, "password")));
    assertEquals(PRIVATE_KEY, vault.getSecretsMap().get(secretId(serviceName, "privatekey")));
    DatabaseService stored =
        SdkClients.adminClient()
            .getHttpClient()
            .execute(
                HttpMethod.GET,
                DATABASE_SERVICES_PATH + "/" + original.getId(),
                null,
                DatabaseService.class);
    assertEquals("test-account", connectionOf(stored).getAccount());
    assertEquals("described without a connection", stored.getDescription());
  }

  /** The approval gate must not stage a PUT that omits the connection as clearing it. */
  @Test
  void aHeldPutWithoutAConnectionStagesNoConnectionChange(TestNamespace ns) {
    CreateDatabaseService request = request(ns.prefix("held_put_without_connection"));
    DatabaseService original = SdkClients.adminClient().databaseServices().create(request);
    ns.trackRoot(Entity.DATABASE_SERVICE, original);
    ChangeRequestITSupport.deployHookWorkflowFor(
        ns,
        Entity.DATABASE_SERVICE,
        "\"description\"",
        "",
        ChangeRequestITSupport.filterScopedTo(
            Entity.DATABASE_SERVICE, original.getFullyQualifiedName()));
    request.withDescription("proposed description").setConnection(null);

    DatabaseService held = put(request);

    assertEquals(original.getVersion(), held.getVersion());
    ChangeRequest pending = ChangeRequestITSupport.onlyPendingRequest(original.getId());
    List<String> stagedFields =
        SdkClients.adminClient()
            .getHttpClient()
            .execute(
                HttpMethod.GET, "/v1/changeRequests/" + pending.getId(), null, ChangeRequest.class)
            .getActiveRevision()
            .getOps()
            .stream()
            .map(MutationOp::getField)
            .toList();
    assertTrue(stagedFields.contains("description"), stagedFields.toString());
    assertFalse(stagedFields.contains("connection"), stagedFields.toString());
    assertFalse(stagedFields.contains("serviceAttributes"), stagedFields.toString());
  }

  private static CreateDatabaseService request(String serviceName) {
    return new CreateDatabaseService()
        .withName(serviceName)
        .withServiceType(DatabaseServiceType.Snowflake)
        .withConnection(
            new DatabaseConnection()
                .withConfig(
                    new SnowflakeConnection()
                        .withAccount("test-account")
                        .withUsername("test_user")
                        .withWarehouse("test_warehouse")
                        .withPassword(PASSWORD)
                        .withPrivateKey(PRIVATE_KEY)));
  }

  private static DatabaseService put(CreateDatabaseService request) {
    return SdkClients.adminClient()
        .getHttpClient()
        .execute(HttpMethod.PUT, DATABASE_SERVICES_PATH, request, DatabaseService.class);
  }

  private static String entitySecretRoot(String entityType, String name) {
    return String.format("/%s/%s/%s", CLUSTER_NAME, entityType, name).toLowerCase(Locale.ROOT);
  }

  private static String secretId(String serviceName, String fieldName) {
    return String.format("/%s/database/%s/%s", CLUSTER_NAME, serviceName, fieldName)
        .toLowerCase(Locale.ROOT);
  }

  private static SnowflakeConnection connectionOf(DatabaseService service) {
    return JsonUtils.convertValue(service.getConnection().getConfig(), SnowflakeConnection.class);
  }
}
