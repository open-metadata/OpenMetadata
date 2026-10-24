package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.ws.rs.core.MediaType;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.schema.api.services.CreateDatabaseService.DatabaseServiceType;
import org.openmetadata.schema.api.services.DatabaseConnection;
import org.openmetadata.schema.entity.automations.CreateWorkflow;
import org.openmetadata.schema.entity.automations.TestServiceConnectionRequest;
import org.openmetadata.schema.entity.automations.Workflow;
import org.openmetadata.schema.entity.automations.WorkflowType;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.services.connections.database.SnowflakeConnection;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.exceptions.InvalidRequestException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.service.Entity;
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

  @Test
  void aServiceRejectsAnotherServicesSecretReference(TestNamespace ns) {
    String ownerName = ns.prefix("snowflake_secret_owner");
    DatabaseService owner =
        SdkClients.adminClient().databaseServices().create(snowflakeRequest(ownerName, PASSWORD));
    ns.trackRoot(Entity.DATABASE_SERVICE, owner);
    String ownedReference = SecretsManager.SECRET_FIELD_PREFIX + secretId(ownerName, "password");

    CreateDatabaseService borrowerRequest =
        snowflakeRequest(ns.prefix("snowflake_secret_borrower"), ownedReference);
    InvalidRequestException rejected =
        assertThrows(
            InvalidRequestException.class,
            () -> SdkClients.adminClient().databaseServices().create(borrowerRequest),
            "a service must not store a reference to another service's secret");
    assertEquals(400, rejected.getStatusCode());
    String message = rejected.getResponseBody();
    assertTrue(message != null && message.contains("Password"), message);
    assertFalse(
        message.contains(ownedReference), "the rejection must not echo the rejected reference");
  }

  /**
   * A patch that changes the name reaches the prepare pass with the new name - the server only
   * reverts a service rename after that, in restorePatchAttributes. The masker pass ahead of the
   * prepare has already proven the patched values are the stored ones, so the prepare pass must
   * store what it accepted instead of rejecting the old-name reference against the new name's
   * credential scope.
   */
  @Test
  void aRenamePatchKeepsTheStoredCredential(TestNamespace ns) {
    String serviceName = ns.prefix("snowflake_rename");
    DatabaseService service =
        SdkClients.adminClient().databaseServices().create(snowflakeRequest(serviceName, PASSWORD));
    ns.trackRoot(Entity.DATABASE_SERVICE, service);

    DatabaseService renamed = JsonUtils.convertValue(service, DatabaseService.class);
    renamed.setName(ns.prefix("snowflake_rename_renamed"));
    String patched =
        SdkClients.adminClient()
            .getHttpClient()
            .executeForString(
                HttpMethod.PATCH,
                DATABASE_SERVICES_PATH + "/" + service.getId(),
                JsonUtils.getJsonPatch(service, renamed).toString(),
                RequestOptions.builder()
                    .header("Content-Type", MediaType.APPLICATION_JSON_PATCH_JSON)
                    .build());

    DatabaseService patchedService = JsonUtils.readValue(patched, DatabaseService.class);
    assertEquals(
        serviceName, patchedService.getName(), "services do not take a rename from a patch");
    assertTrue(
        vault.getSecretsMap().containsKey(secretId(serviceName, "password")),
        "a rename patch must leave the stored credential in place and resolvable");
  }

  /**
   * A TEST_CONNECTION request arrives over HTTP as raw JSON; the reference it echoes is the tested
   * service's own stored reference, so the workflow must type the request, find the stored
   * service and validate the echo against its connection instead of rejecting the reference with
   * nothing to compare against.
   */
  @Test
  void aTestConnectionWorkflowEchoesTheStoredServiceReference(TestNamespace ns) {
    String serviceName = ns.prefix("snowflake_workflow_reference");
    DatabaseService service =
        SdkClients.adminClient().databaseServices().create(snowflakeRequest(serviceName, PASSWORD));
    ns.trackRoot(Entity.DATABASE_SERVICE, service);
    String ownedReference = SecretsManager.SECRET_FIELD_PREFIX + secretId(serviceName, "password");

    CreateWorkflow request =
        new CreateWorkflow()
            .withName(ns.prefix("test_connection"))
            .withWorkflowType(WorkflowType.TEST_CONNECTION)
            .withRequest(
                new TestServiceConnectionRequest()
                    .withServiceType(ServiceType.DATABASE)
                    .withServiceName(serviceName)
                    .withConnectionType("Snowflake")
                    .withConnection(
                        new DatabaseConnection().withConfig(snowflakeConnection(ownedReference))));

    Workflow workflow = SdkClients.adminClient().workflows().create(request);
    assertNotNull(workflow.getId(), "echoing the tested service's own reference must pass");
  }

  private static SnowflakeConnection snowflakeConnection(String password) {
    return new SnowflakeConnection()
        .withAccount("test-account")
        .withUsername("test_user")
        .withWarehouse("test_warehouse")
        .withPassword(password);
  }

  private static CreateDatabaseService snowflakeRequest(String serviceName, String password) {
    return new CreateDatabaseService()
        .withName(serviceName)
        .withServiceType(DatabaseServiceType.Snowflake)
        .withConnection(new DatabaseConnection().withConfig(snowflakeConnection(password)));
  }

  private static String secretId(String serviceName, String fieldName) {
    return String.format("/%s/database/%s/%s", CLUSTER_NAME, serviceName, fieldName)
        .toLowerCase(Locale.ROOT);
  }

  private static SnowflakeConnection connectionOf(DatabaseService service) {
    return JsonUtils.convertValue(service.getConnection().getConfig(), SnowflakeConnection.class);
  }
}
