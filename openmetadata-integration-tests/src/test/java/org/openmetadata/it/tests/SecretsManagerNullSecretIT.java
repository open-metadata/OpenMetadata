package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.schema.api.services.CreateDatabaseService.DatabaseServiceType;
import org.openmetadata.schema.api.services.DatabaseConnection;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.governance.changeRequest.ChangeRequest;
import org.openmetadata.schema.governance.changeRequest.MutationOp;
import org.openmetadata.schema.services.connections.database.SnowflakeConnection;
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
  private static final String PASSWORD = "s3cr3t";
  private static final String PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----";

  private static SecretsManager originalSecretsManager;
  private static InMemorySecretsManager vault;

  @BeforeAll
  static void installInMemoryVault() {
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

  private static String secretId(String serviceName, String fieldName) {
    return String.format("/%s/database/%s/%s", CLUSTER_NAME, serviceName, fieldName)
        .toLowerCase(Locale.ROOT);
  }

  private static SnowflakeConnection connectionOf(DatabaseService service) {
    return JsonUtils.convertValue(service.getConnection().getConfig(), SnowflakeConnection.class);
  }
}
