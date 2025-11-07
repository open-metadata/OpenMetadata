package org.openmetadata.service.secrets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.security.secrets.SecretsManagerConfiguration;
import org.openmetadata.schema.security.secrets.SecretsManagerProvider;
import org.openmetadata.schema.services.connections.database.MysqlConnection;
import org.openmetadata.schema.services.connections.database.common.basicAuth;
import org.openmetadata.schema.utils.JsonUtils;
import software.amazon.awssdk.services.secretsmanager.SecretsManagerClient;
import software.amazon.awssdk.services.secretsmanager.model.CreateSecretRequest;
import software.amazon.awssdk.services.secretsmanager.model.CreateSecretResponse;
import software.amazon.awssdk.services.secretsmanager.model.DeleteSecretRequest;
import software.amazon.awssdk.services.secretsmanager.model.DeleteSecretResponse;
import software.amazon.awssdk.services.secretsmanager.model.GetSecretValueRequest;
import software.amazon.awssdk.services.secretsmanager.model.GetSecretValueResponse;
import software.amazon.awssdk.services.secretsmanager.model.UpdateSecretRequest;
import software.amazon.awssdk.services.secretsmanager.model.UpdateSecretResponse;

public class AWSSecretsManagerTest extends AWSBasedSecretsManagerTest {

  @Mock private SecretsManagerClient secretsManagerClient;
  private final Map<String, String> mockSecretStorage = new HashMap<>();

  @BeforeAll
  static void setUpAwsSystemProperties() {
    System.setProperty("aws.region", "us-east-1");
    System.setProperty("aws.accessKeyId", "test-access-key");
    System.setProperty("aws.secretAccessKey", "test-secret-key");
  }

  @AfterAll
  static void tearDownAwsSystemProperties() {
    System.clearProperty("aws.region");
    System.clearProperty("aws.accessKeyId");
    System.clearProperty("aws.secretAccessKey");
  }

  @Override
  void setUpSpecific(SecretsManagerConfiguration config) {
    mockSecretStorage.clear();
    secretsManager =
        AWSSecretsManager.getInstance(
            new SecretsManager.SecretsConfig(
                "openmetadata",
                "prefix",
                List.of("key:value", "key2:value2"),
                config.getParameters()));
    ((AWSSecretsManager) secretsManager).setSecretsClient(secretsManagerClient);
    reset(secretsManagerClient);

    // Mock the Secrets Manager client to simulate real storage and retrieval
    lenient()
        .when(secretsManagerClient.createSecret(any(CreateSecretRequest.class)))
        .thenAnswer(
            invocation -> {
              CreateSecretRequest request = invocation.getArgument(0);
              mockSecretStorage.put(request.name(), request.secretString());
              return CreateSecretResponse.builder().build();
            });

    lenient()
        .when(secretsManagerClient.updateSecret(any(UpdateSecretRequest.class)))
        .thenAnswer(
            invocation -> {
              UpdateSecretRequest request = invocation.getArgument(0);
              mockSecretStorage.put(request.secretId(), request.secretString());
              return UpdateSecretResponse.builder().build();
            });

    lenient()
        .when(secretsManagerClient.getSecretValue(any(GetSecretValueRequest.class)))
        .thenAnswer(
            invocation -> {
              GetSecretValueRequest request = invocation.getArgument(0);
              String secretId = request.secretId();
              String storedValue = mockSecretStorage.computeIfAbsent(secretId, i -> "secret:" + i);
              return GetSecretValueResponse.builder().secretString(storedValue).build();
            });

    lenient()
        .when(secretsManagerClient.deleteSecret(any(DeleteSecretRequest.class)))
        .thenAnswer(
            invocation -> {
              DeleteSecretRequest request = invocation.getArgument(0);
              mockSecretStorage.remove(request.secretId());
              return DeleteSecretResponse.builder().build();
            });
  }

  @Override
  protected SecretsManagerProvider expectedSecretManagerProvider() {
    return SecretsManagerProvider.MANAGED_AWS;
  }

  @Test
  void testNullSecretNotStored() {
    // Test that null secrets are not stored in the secrets manager
    Map<String, Map<String, String>> mysqlConnectionWithNull =
        Map.of("authType", Map.of("password", (String) null));

    // Encrypt with null password
    MysqlConnection connection =
        (MysqlConnection)
            secretsManager.encryptServiceConnectionConfig(
                mysqlConnectionWithNull, "Mysql", "test-null-secret", ServiceType.DATABASE);

    // Verify that the password field is null (not stored)
    basicAuth auth = JsonUtils.convertValue(connection.getAuthType(), basicAuth.class);
    assertNull(auth.getPassword(), "Null password should not be stored");

    // Verify that no secret was created in the mock storage for null values
    String expectedSecretId = "/prefix/openmetadata/database/test-null-secret/authtype/password";
    assertNull(
        mockSecretStorage.get(expectedSecretId), "Null secret should not exist in secrets manager");
  }

  @Test
  void testExistingNullSecretCleanup() {
    // Simulate an existing "null" string secret in the secrets manager
    String secretId = "/prefix/openmetadata/database/test-cleanup/authtype/password";
    mockSecretStorage.put(secretId, "null");

    // Try to retrieve the secret - it should be cleaned up and return null
    String retrievedSecret = secretsManager.getSecret(secretId);
    assertNull(retrievedSecret, "Retrieved 'null' string should be cleaned up and return null");

    // Verify that the secret was deleted from storage
    verify(secretsManagerClient, times(1)).deleteSecret(any(DeleteSecretRequest.class));
  }

  @Test
  void testNullSecretDeletesExistingSecret() {
    // First, store a valid password
    String secretId = "/prefix/openmetadata/database/test-delete/authtype/password";
    mockSecretStorage.put(secretId, "valid-password");

    // Now encrypt with null password - this should delete the existing secret
    Map<String, Map<String, String>> mysqlConnectionWithNull =
        Map.of("authType", Map.of("password", (String) null));

    secretsManager.encryptServiceConnectionConfig(
        mysqlConnectionWithNull, "Mysql", "test-delete", ServiceType.DATABASE);

    // Verify that the secret was deleted
    verify(secretsManagerClient, times(1)).deleteSecret(any(DeleteSecretRequest.class));
  }

  @Test
  void testPasswordUpdateToNull() {
    // Test scenario from the issue:
    // 1. Create service with password
    // 2. Edit service and remove password (set to null)
    // 3. Verify password is not stored as "null"

    // Step 1: Create with password
    Map<String, Map<String, String>> mysqlConnectionWithPassword =
        Map.of("authType", Map.of("password", "my-password"));

    MysqlConnection connection =
        (MysqlConnection)
            secretsManager.encryptServiceConnectionConfig(
                mysqlConnectionWithPassword, "Mysql", "snowflake-test", ServiceType.DATABASE);

    // Verify password is stored
    String expectedSecretId = "/prefix/openmetadata/database/snowflake-test/authtype/password";
    assertEquals("my-password", mockSecretStorage.get(expectedSecretId));

    // Step 2: Update with null password
    Map<String, Map<String, String>> mysqlConnectionWithNull =
        Map.of("authType", Map.of("password", (String) null));

    connection =
        (MysqlConnection)
            secretsManager.encryptServiceConnectionConfig(
                mysqlConnectionWithNull, "Mysql", "snowflake-test", ServiceType.DATABASE);

    // Step 3: Verify password is deleted, not stored as "null"
    assertNull(
        mockSecretStorage.get(expectedSecretId),
        "Password should be deleted, not stored as 'null'");

    basicAuth auth = JsonUtils.convertValue(connection.getAuthType(), basicAuth.class);
    assertNull(auth.getPassword(), "Password field should be null");
  }
}
