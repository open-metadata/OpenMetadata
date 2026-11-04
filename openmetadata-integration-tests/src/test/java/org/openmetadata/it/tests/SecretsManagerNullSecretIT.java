package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.node.ArrayNode;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
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
import org.openmetadata.schema.type.MessagingConnection;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.exceptions.ForbiddenException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.secrets.ExternalSecretsManager;
import org.openmetadata.service.secrets.InMemorySecretsManager;
import org.openmetadata.service.secrets.SecretsManager;
import org.openmetadata.service.secrets.SecretsManagerFactory;

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
    "entry,true",
    "map,true",
    "number,true",
    "null,true"
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
    String entryId =
        entitySecretRoot("pipeline", pipelineName)
            + "/sourceconfig/config/dbtconfigsource/dbthttpheaders/additionalproperties/authorization";
    assertEquals(PASSWORD, vault.getSecretsMap().get(entryId));

    config.setDbtHttpHeaders(null);
    SdkClients.adminClient()
        .getHttpClient()
        .execute(
            HttpMethod.PUT, "/v1/services/ingestionPipelines", request, IngestionPipeline.class);

    assertFalse(vault.getSecretsMap().containsKey(entryId));
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
