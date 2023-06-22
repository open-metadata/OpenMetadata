package org.openmetadata.service.secrets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.openmetadata.schema.api.services.CreateDatabaseService.DatabaseServiceType.Mysql;

import java.util.Map;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.api.services.DatabaseConnection;
import org.openmetadata.schema.entity.automations.TestServiceConnectionRequest;
import org.openmetadata.schema.entity.automations.Workflow;
import org.openmetadata.schema.entity.automations.WorkflowType;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.services.connections.database.MysqlConnection;
import org.openmetadata.schema.services.connections.database.common.basicAuth;
import org.openmetadata.service.exception.SecretsManagerException;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.util.JsonUtils;

@ExtendWith(MockitoExtension.class)
public class SecretsManagerLifecycleTest {

  private static final String ENCRYPTED_VALUE = "fernet:abcdef";
  private static final String DECRYPTED_VALUE = "123456";

  // We'll test the secret creation and deletion using the In Memory SM
  private static InMemorySecretsManager secretsManager;

  @BeforeAll
  static void setUp() {
    secretsManager = InMemorySecretsManager.getInstance("openmetadata");
    Fernet fernet = Mockito.mock(Fernet.class);
    lenient().when(fernet.decrypt(anyString())).thenReturn(DECRYPTED_VALUE);
    lenient().when(fernet.decryptIfApplies(anyString())).thenReturn(DECRYPTED_VALUE);
    lenient().when(fernet.encrypt(anyString())).thenReturn(ENCRYPTED_VALUE);
    secretsManager.setFernet(fernet);
  }

  @Test
  void testDatabaseServiceConnectionConfigLifecycle() {
    String password = "openmetadata-test";
    String secretName = "/openmetadata/database/test/authtype/password";
    String connectionName = "test";
    Map<String, Map<String, String>> mysqlConnection = Map.of("authType", Map.of("password", password));

    // Ensure encrypted service connection config encrypts the password
    MysqlConnection actualConnection =
        (MysqlConnection)
            secretsManager.encryptServiceConnectionConfig(
                mysqlConnection, Mysql.value(), connectionName, ServiceType.DATABASE);
    assertNotEquals(password, JsonUtils.convertValue(actualConnection.getAuthType(), basicAuth.class).getPassword());

    // Decrypt the encrypted password and validate
    actualConnection =
        (MysqlConnection)
            secretsManager.decryptServiceConnectionConfig(actualConnection, Mysql.value(), ServiceType.DATABASE);
    assertEquals(
        DECRYPTED_VALUE, JsonUtils.convertValue(actualConnection.getAuthType(), basicAuth.class).getPassword());

    // SM will have the key stored
    String secretValue = secretsManager.getSecret(secretName);
    assertEquals(secretValue, DECRYPTED_VALUE);

    // Now we delete the service
    secretsManager.deleteSecretsFromServiceConnectionConfig(
        mysqlConnection, "Mysql", connectionName, ServiceType.DATABASE);

    // We won't be able to get the key again
    SecretsManagerException exception =
        assertThrows(SecretsManagerException.class, () -> secretsManager.getSecret(secretName));

    assertEquals(exception.getMessage(), String.format("Key [%s] not found in in-memory secrets manager", secretName));
  }

  @Test
  void testWorkflowLifecycle() {
    String password = "openmetadata_password";
    String secretName = "/openmetadata/workflow/test-connection/request/connection/config/authtype/password";

    Workflow workflow =
        new Workflow()
            .withName("test-connection")
            .withWorkflowType(WorkflowType.TEST_CONNECTION)
            .withRequest(
                new TestServiceConnectionRequest()
                    .withServiceType(ServiceType.DATABASE)
                    .withConnectionType("Mysql")
                    .withConnection(
                        new DatabaseConnection()
                            .withConfig(
                                new MysqlConnection()
                                    .withHostPort("mysql:3306")
                                    .withUsername("openmetadata_user")
                                    .withAuthType(new basicAuth().withPassword(password)))));

    Workflow encrypted = secretsManager.encryptWorkflow(workflow);
    TestServiceConnectionRequest encryptedRequest = (TestServiceConnectionRequest) encrypted.getRequest();
    DatabaseConnection encryptedConnection = (DatabaseConnection) encryptedRequest.getConnection();
    MysqlConnection encryptedConfig = (MysqlConnection) encryptedConnection.getConfig();
    assertNotEquals(password, JsonUtils.convertValue(encryptedConfig.getAuthType(), basicAuth.class).getPassword());

    Workflow decrypted = secretsManager.decryptWorkflow(encrypted);
    TestServiceConnectionRequest decryptedRequest = (TestServiceConnectionRequest) decrypted.getRequest();
    DatabaseConnection decryptedConnection = (DatabaseConnection) decryptedRequest.getConnection();
    MysqlConnection decryptedConfig = (MysqlConnection) decryptedConnection.getConfig();
    assertEquals(DECRYPTED_VALUE, JsonUtils.convertValue(decryptedConfig.getAuthType(), basicAuth.class).getPassword());

    // SM will have the key stored
    String secretValue = secretsManager.getSecret(secretName);
    assertEquals(secretValue, DECRYPTED_VALUE);

    // Now we delete the service
    secretsManager.deleteSecretsFromWorkflow(workflow);

    // We won't be able to get the key again
    SecretsManagerException exception =
        assertThrows(SecretsManagerException.class, () -> secretsManager.getSecret(secretName));

    assertEquals(exception.getMessage(), String.format("Key [%s] not found in in-memory secrets manager", secretName));
  }
}
