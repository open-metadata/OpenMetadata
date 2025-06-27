package org.openmetadata.service.secrets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.openmetadata.schema.api.services.CreateDatabaseService.DatabaseServiceType.Mysql;

import java.util.Map;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.services.DatabaseConnection;
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
        "secret:/openmetadata/workflow/my-workflow/request/connection/config/password";
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
    assertNotEquals(
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

    Assertions.assertEquals(
        "Failed to encrypt 'Mysql' connection stored in DB due to an unrecognized field: 'username1'",
        thrown.getMessage());
    thrown =
        Assertions.assertThrows(
            InvalidServiceConnectionException.class,
            () ->
                secretsManager.decryptServiceConnectionConfig(
                    mysqlConnection, Mysql.value(), ServiceType.DATABASE));

    Assertions.assertEquals(
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
}
