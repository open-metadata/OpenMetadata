package org.openmetadata.service.secrets;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.schema.api.services.CreateDatabaseService.DatabaseServiceType.Mysql;

import java.util.Map;
import org.apache.commons.lang3.StringUtils;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.services.DatabaseConnection;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.auth.SSOAuthMechanism;
import org.openmetadata.schema.entity.automations.TestServiceConnectionRequest;
import org.openmetadata.schema.entity.automations.Workflow;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism;
import org.openmetadata.schema.security.client.OktaSSOClientConfig;
import org.openmetadata.schema.security.client.OpenMetadataJWTClientConfig;
import org.openmetadata.schema.security.secrets.SecretsManagerConfiguration;
import org.openmetadata.schema.security.secrets.SecretsManagerProvider;
import org.openmetadata.schema.services.connections.database.MysqlConnection;
import org.openmetadata.schema.services.connections.database.common.basicAuth;
import org.openmetadata.schema.services.connections.metadata.OpenMetadataConnection;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.InvalidServiceConnectionException;
import org.openmetadata.service.exception.SecretsManagerException;
import org.openmetadata.service.secrets.masker.EntityMaskerFactory;

public abstract class ExternalSecretsManagerTest {
  protected ExternalSecretsManager secretsManager;

  @Test
  void testEncryptDecryptDatabaseServiceConnectionConfig() {
    String password = "openmetadata-test";
    MysqlConnection expectedConnection =
        new MysqlConnection().withAuthType(new basicAuth().withPassword(password));
    Map<String, Map<String, String>> mysqlConnection =
        Map.of("authType", Map.of("password", password));

    // Ensure encrypted service connection config encrypts the password
    MysqlConnection actualConnection =
        (MysqlConnection)
            secretsManager.encryptServiceConnectionConfig(
                mysqlConnection, Mysql.value(), "test", ServiceType.DATABASE);
    assertNotEquals(
        password,
        JsonUtils.convertValue(actualConnection.getAuthType(), basicAuth.class).getPassword());

    // Decrypt the encrypted password and validate
    actualConnection =
        (MysqlConnection)
            secretsManager.decryptServiceConnectionConfig(
                mysqlConnection, Mysql.value(), ServiceType.DATABASE);
    assertEquals(
        password,
        JsonUtils.convertValue(actualConnection.getAuthType(), basicAuth.class).getPassword());
    assertEquals(expectedConnection, actualConnection);
  }

  @Test
  void testEncryptDecryptSSSOConfig() {
    String privateKey = "secret:/openmetadata/bot/bot/config/authconfig/privatekey";
    OktaSSOClientConfig config = new OktaSSOClientConfig().withPrivateKey(privateKey);
    AuthenticationMechanism expectedAuthMechanism =
        new AuthenticationMechanism()
            .withAuthType(AuthenticationMechanism.AuthType.SSO)
            .withConfig(
                new SSOAuthMechanism()
                    .withAuthConfig(config)
                    .withSsoServiceType(SSOAuthMechanism.SsoServiceType.OKTA));

    AuthenticationMechanism actualAuthMechanism =
        JsonUtils.convertValue(expectedAuthMechanism, AuthenticationMechanism.class);

    // Encrypt private key and ensure it is indeed encrypted
    secretsManager.encryptAuthenticationMechanism("bot", actualAuthMechanism);
    assertNotEquals(privateKey, getPrivateKey(actualAuthMechanism));

    // Decrypt private key and ensure it is decrypted
    secretsManager.decryptAuthenticationMechanism("bot", actualAuthMechanism);
    assertEquals(privateKey, getPrivateKey(actualAuthMechanism));
  }

  @Test
  void testEncryptDecryptWorkflow() {
    String password =
        "secret:/openmetadata/workflow/my-workflow/request/connection/config/authtype/password";
    String secretKey = "secret:/openmetadata/serverconnection/securityconfig/secretkey";
    OpenMetadataConnection connection =
        new OpenMetadataConnection()
            .withSecurityConfig(new OpenMetadataJWTClientConfig().withJwtToken(secretKey));
    DatabaseConnection dbConnection =
        new DatabaseConnection()
            .withConfig(new MysqlConnection().withAuthType(new basicAuth().withPassword(password)));
    TestServiceConnectionRequest testRequest =
        new TestServiceConnectionRequest()
            .withConnection(dbConnection)
            .withServiceType(ServiceType.DATABASE)
            .withConnectionType("Mysql");
    Workflow expectedWorkflow =
        new Workflow()
            .withName("my-workflow")
            .withOpenMetadataServerConnection(connection)
            .withRequest(testRequest);
    Workflow actualWorkflow = JsonUtils.convertValue(expectedWorkflow, Workflow.class);

    // Encrypt the workflow and ensure password and secrete key are encrypted
    actualWorkflow = secretsManager.encryptWorkflow(actualWorkflow);
    assertNotEquals(password, getPassword(actualWorkflow));
    // JWT token is not encrypted since it's not stored in the db. It's handled at runtime.
    assertEquals(
        secretKey,
        actualWorkflow.getOpenMetadataServerConnection().getSecurityConfig().getJwtToken());

    // Decrypt the workflow and ensure password and secrete key are decrypted
    actualWorkflow = secretsManager.decryptWorkflow(actualWorkflow);
    assertEquals(password, getPassword(actualWorkflow));
    assertEquals(
        secretKey,
        actualWorkflow.getOpenMetadataServerConnection().getSecurityConfig().getJwtToken());
    assertEquals(expectedWorkflow, actualWorkflow);
  }

  @Test
  void testEncryptAcceptsTheServicesOwnStoredReference() {
    String storedReference = servicePasswordReference("test");
    MysqlConnection connection =
        new MysqlConnection().withAuthType(new basicAuth().withPassword(storedReference));

    // The reference the entity itself holds round-trips through the store
    MysqlConnection actualConnection =
        (MysqlConnection)
            secretsManager.encryptServiceConnectionConfig(
                connection, Mysql.value(), "test", ServiceType.DATABASE);
    assertNotEquals(
        storedReference,
        JsonUtils.convertValue(actualConnection.getAuthType(), basicAuth.class).getPassword());

    actualConnection =
        (MysqlConnection)
            secretsManager.decryptServiceConnectionConfig(
                actualConnection, Mysql.value(), ServiceType.DATABASE);
    assertEquals(
        storedReference,
        JsonUtils.convertValue(actualConnection.getAuthType(), basicAuth.class).getPassword());
  }

  /**
   * A reference under the deployment's own namespace - where every secret the server stores lives
   * - is a pointer at another entity's secret when its base is not this entity's. Storing it
   * would let the submitter's entity resolve, and later delete, that secret.
   */
  @Test
  void testEncryptRejectsAReferenceToAnotherEntitysSecret() {
    String foreignReference = servicePasswordReference("other-service");
    MysqlConnection connection =
        new MysqlConnection().withAuthType(new basicAuth().withPassword(foreignReference));

    SecretsManagerException rejected =
        assertThrows(
            SecretsManagerException.class,
            () ->
                secretsManager.encryptServiceConnectionConfig(
                    connection, Mysql.value(), "test", ServiceType.DATABASE));

    assertEquals(400, rejected.getResponse().getStatus());
    assertTrue(rejected.getMessage().contains("Password"), rejected.getMessage());
    assertFalse(
        rejected.getMessage().contains(foreignReference), "the reference must not be echoed");
  }

  /**
   * The backend resolves a padded parameter or secret name wherever it resolves the name - SSM
   * removes spaces at the beginning and end of a parameter name, for one - so a single space after
   * the {@code secret:} prefix cannot wave a reference to another entity's managed secret through
   * as an external one.
   */
  @Test
  void testEncryptRejectsAWhitespacePaddedReferenceToAnotherEntitysSecret() {
    String foreignReference = servicePasswordReference("other-service");
    String paddedReference =
        SecretsManager.SECRET_FIELD_PREFIX
            + " "
            + foreignReference.substring(SecretsManager.SECRET_FIELD_PREFIX.length());
    MysqlConnection connection =
        new MysqlConnection().withAuthType(new basicAuth().withPassword(paddedReference));

    SecretsManagerException rejected =
        assertThrows(
            SecretsManagerException.class,
            () ->
                secretsManager.encryptServiceConnectionConfig(
                    connection, Mysql.value(), "test", ServiceType.DATABASE));

    assertEquals(400, rejected.getResponse().getStatus());
    assertFalse(
        rejected.getMessage().contains(paddedReference), "the reference must not be echoed");
  }

  /**
   * The entity's name is not the end of the comparison: the separator is a character entity names
   * may contain, so a reference merely starting with the entity's base plus a separator can name a
   * different entity's secret ("test" borrowing "test-more"'s reference where the separator is "-",
   * say). A stored reference must be the whole id the walk derives for this field.
   */
  @Test
  void testEncryptRejectsAReferenceWhoseServiceNameExtendsTheEntitysName() {
    String separator = secretsManager.getSecretsIdConfig().separator();
    String extendedReference = servicePasswordReference("test" + separator + "more");
    MysqlConnection connection =
        new MysqlConnection().withAuthType(new basicAuth().withPassword(extendedReference));

    SecretsManagerException rejected =
        assertThrows(
            SecretsManagerException.class,
            () ->
                secretsManager.encryptServiceConnectionConfig(
                    connection, Mysql.value(), "test", ServiceType.DATABASE));

    assertEquals(400, rejected.getResponse().getStatus());
    assertFalse(
        rejected.getMessage().contains(extendedReference), "the reference must not be echoed");
  }

  @Test
  void testEncryptWorkflowAcceptsTheNamedServicesReference() {
    String serviceReference = servicePasswordReference("test-service");
    Workflow workflow = testConnectionWorkflow("test-service", serviceReference);

    Workflow encrypted = secretsManager.encryptWorkflow(workflow);
    assertNotEquals(serviceReference, getPassword(encrypted));

    Workflow decrypted = secretsManager.decryptWorkflow(encrypted);
    assertEquals(serviceReference, getPassword(decrypted));
  }

  @Test
  void testEncryptWorkflowRejectsAnotherServicesReference() {
    String foreignReference = servicePasswordReference("other-service");
    Workflow workflow = testConnectionWorkflow("test-service", foreignReference);

    SecretsManagerException rejected =
        assertThrows(SecretsManagerException.class, () -> secretsManager.encryptWorkflow(workflow));

    assertEquals(400, rejected.getResponse().getStatus());
    assertTrue(rejected.getMessage().contains("Password"), rejected.getMessage());
    assertFalse(
        rejected.getMessage().contains(foreignReference), "the reference must not be echoed");
  }

  /**
   * Rows stored before the write paths rejected a borrowed reference are only revisited when the
   * workflow is triggered: the pipeline service resolves the stored request's managed references
   * there, so the trigger rejects a reference borrowed from another service's connection before a
   * run connects with the victim's credential on the attacker's host.
   */
  @Test
  void testStoredWorkflowTriggerRejectsAnotherServicesReference() {
    String foreignReference = servicePasswordReference("other-service");
    Workflow storedWorkflow = testConnectionWorkflow("test-service", foreignReference);

    SecretsManagerException rejected =
        assertThrows(
            SecretsManagerException.class,
            () -> secretsManager.rejectStoredForeignReferences(storedWorkflow));

    assertEquals(400, rejected.getResponse().getStatus());
    assertTrue(rejected.getMessage().contains("Password"), rejected.getMessage());
    assertFalse(
        rejected.getMessage().contains(foreignReference), "the reference must not be echoed");
  }

  @Test
  void testUnmaskRejectsAnotherServicesReference() {
    SecretsManager previous = SecretsManagerFactory.getSecretsManager();
    try {
      SecretsManagerFactory.setSecretsManager(secretsManager);
      String foreignReference = servicePasswordReference("other-service");
      SecretsManagerException rejected =
          assertThrows(
              SecretsManagerException.class,
              () ->
                  EntityMaskerFactory.createEntityMasker()
                      .unmaskWorkflow(
                          testConnectionWorkflow("test-service", foreignReference), null));
      assertEquals(400, rejected.getResponse().getStatus());
      assertFalse(rejected.getMessage().contains(foreignReference));
    } finally {
      SecretsManagerFactory.setSecretsManager(previous);
    }
  }

  @Test
  void testStoredWorkflowTriggerRejectsEncryptedForeignReference() {
    String foreignReference = servicePasswordReference("other-service");
    Workflow encrypted =
        secretsManager.encryptWorkflow(
            testConnectionWorkflow("test-service", foreignReference),
            SecretsManager.CredentialPolicy.INTERNAL_RE_STORAGE);
    Workflow stored = JsonUtils.readValue(JsonUtils.pojoToJson(encrypted), Workflow.class);

    SecretsManagerException rejected =
        assertThrows(
            SecretsManagerException.class,
            () -> secretsManager.rejectStoredForeignReferences(stored));

    assertEquals(400, rejected.getResponse().getStatus());
    assertTrue(rejected.getMessage().contains("Password"));
    assertFalse(rejected.getMessage().contains(foreignReference));
  }

  /** A stored row is legitimate when its references are the walk's own or the service's echo. */
  @Test
  void testStoredWorkflowTriggerAcceptsOwnStoredReferencesAndTheServicesEcho() {
    Workflow storedWorkflow = testConnectionWorkflow("test-service", "openmetadata-test");
    Workflow encrypted = secretsManager.encryptWorkflow(storedWorkflow);
    assertDoesNotThrow(() -> secretsManager.rejectStoredForeignReferences(encrypted));
  }

  private String servicePasswordReference(String serviceName) {
    return SecretsManager.SECRET_FIELD_PREFIX
        + secretsManager.buildSecretId(
            false,
            secretsManager.buildSecretId(true, "database", serviceName),
            "authtype",
            "password");
  }

  private Workflow testConnectionWorkflow(String serviceName, String password) {
    DatabaseConnection dbConnection =
        new DatabaseConnection()
            .withConfig(new MysqlConnection().withAuthType(new basicAuth().withPassword(password)));
    TestServiceConnectionRequest testRequest =
        new TestServiceConnectionRequest()
            .withConnection(dbConnection)
            .withServiceType(ServiceType.DATABASE)
            .withConnectionType("Mysql")
            .withServiceName(serviceName);
    return new Workflow().withName("my-workflow").withRequest(testRequest);
  }

  @Test
  void testExceptionConnection() {
    Map<String, Object> mysqlConnection =
        Map.of(
            "username1", "openmetadata-test", "authType", Map.of("password", "openmetadata-test"));
    InvalidServiceConnectionException thrown =
        Assertions.assertThrows(
            InvalidServiceConnectionException.class,
            () ->
                secretsManager.encryptServiceConnectionConfig(
                    mysqlConnection, Mysql.value(), "test", ServiceType.DATABASE));

    assertEquals(
        "Failed to encrypt 'Mysql' connection stored in DB due to an unrecognized field: 'username1'",
        thrown.getMessage());
    thrown =
        Assertions.assertThrows(
            InvalidServiceConnectionException.class,
            () ->
                secretsManager.decryptServiceConnectionConfig(
                    mysqlConnection, Mysql.value(), ServiceType.DATABASE));

    assertEquals(
        "Failed to decrypt 'Mysql' connection stored in DB due to an unrecognized field: 'username1'",
        thrown.getMessage());
  }

  @Test
  void testReturnsExpectedSecretManagerProvider() {
    assertEquals(expectedSecretManagerProvider(), secretsManager.getSecretsManagerProvider());
  }

  abstract void setUpSpecific(SecretsManagerConfiguration config);

  protected abstract SecretsManagerProvider expectedSecretManagerProvider();

  private String getPrivateKey(AuthenticationMechanism authMechanism) {
    return ((OktaSSOClientConfig) ((SSOAuthMechanism) authMechanism.getConfig()).getAuthConfig())
        .getPrivateKey();
  }

  private String getPassword(Workflow workflow) {
    return JsonUtils.convertValue(
            ((MysqlConnection)
                    ((DatabaseConnection)
                            ((TestServiceConnectionRequest) workflow.getRequest()).getConnection())
                        .getConfig())
                .getAuthType(),
            basicAuth.class)
        .getPassword();
  }

  @Test
  void testCleanNullOrEmptyWithNull() {
    String result = secretsManager.cleanNullOrEmpty(null);
    assertEquals(
        ExternalSecretsManager.NULL_SECRET_STRING,
        result,
        "Null value should be converted to 'null' string");
  }

  @Test
  void testCleanNullOrEmptyWithEmptyString() {
    String result = secretsManager.cleanNullOrEmpty(StringUtils.EMPTY);
    assertEquals(
        ExternalSecretsManager.NULL_SECRET_STRING,
        result,
        "Empty string should be converted to 'null' string");
  }

  @Test
  void testCleanNullOrEmptyWithValidValue() {
    String validValue = "my-secret-password";
    String result = secretsManager.cleanNullOrEmpty(validValue);
    assertEquals(validValue, result, "Valid values should pass through unchanged");
  }

  @Test
  void testEncryptBotAuthMechanismWithEmptyToken() {
    JWTAuthMechanism jwtAuthMechanism = new JWTAuthMechanism().withJWTToken(StringUtils.EMPTY);
    AuthenticationMechanism authMechanism =
        new AuthenticationMechanism()
            .withAuthType(AuthenticationMechanism.AuthType.JWT)
            .withConfig(jwtAuthMechanism);

    Object result = secretsManager.encryptAuthenticationMechanism("test-bot", authMechanism);

    assertNotNull(result, "Encryption should succeed even with empty token");
  }

  @Test
  void testEncryptBotAuthMechanismWithNullToken() {
    JWTAuthMechanism jwtAuthMechanism = new JWTAuthMechanism().withJWTToken(null);
    AuthenticationMechanism authMechanism =
        new AuthenticationMechanism()
            .withAuthType(AuthenticationMechanism.AuthType.JWT)
            .withConfig(jwtAuthMechanism);

    Object result = secretsManager.encryptAuthenticationMechanism("test-bot", authMechanism);

    assertNotNull(result, "Encryption should succeed even with null token");
  }

  @Test
  void testEncryptDatabaseConnectionWithEmptyPassword() {
    Map<String, Map<String, String>> mysqlConnection =
        Map.of("authType", Map.of("password", StringUtils.EMPTY));

    MysqlConnection actualConnection =
        (MysqlConnection)
            secretsManager.encryptServiceConnectionConfig(
                mysqlConnection, Mysql.value(), "test-empty-password", ServiceType.DATABASE);

    assertNotNull(actualConnection, "Encryption should succeed even with empty password");
    assertNull(
        JsonUtils.convertValue(actualConnection.getAuthType(), basicAuth.class).getPassword(),
        "A cleared password must not keep a reference to a secret we did not store (#21259)");
  }
}
