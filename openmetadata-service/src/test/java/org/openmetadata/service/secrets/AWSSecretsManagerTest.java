/*
 *  Copyright 2022 Collate
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
package org.openmetadata.service.secrets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.verify;
import static org.openmetadata.schema.api.services.CreateDatabaseService.DatabaseServiceType.Mysql;

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
import software.amazon.awssdk.services.secretsmanager.model.GetSecretValueRequest;
import software.amazon.awssdk.services.secretsmanager.model.GetSecretValueResponse;
import software.amazon.awssdk.services.secretsmanager.model.ResourceNotFoundException;
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
  }

  @Override
  protected SecretsManagerProvider expectedSecretManagerProvider() {
    return SecretsManagerProvider.MANAGED_AWS;
  }

  /**
   * Tests external secret references provided by users.
   *
   * <p>When a user provides a "secret:" prefixed value pointing to their own secrets manager:
   *
   * <ul>
   *   <li>The reference points to secrets in an external AWS account
   *   <li>The ingestion framework resolves these secrets at runtime
   *   <li>OpenMetadata server should NOT try to fetch these secrets during decrypt
   * </ul>
   *
   * <p>This test verifies that when a user provides a "secret:" prefixed value:
   *
   * <ol>
   *   <li>Encryption: keeps the reference (Fernet-wrapped for DB storage), no new secret created
   *   <li>Decryption: returns the reference as-is WITHOUT trying to fetch from SM
   * </ol>
   */
  @Test
  void testExternalSecretReferenceShouldNotBeFetchedDuringDecrypt() {
    String externalSecretReference = "secret:/external/aws/path/database/password";

    Map<String, Map<String, String>> mysqlConnection =
        Map.of("authType", Map.of("password", externalSecretReference));

    MysqlConnection encryptedConnection =
        (MysqlConnection)
            secretsManager.encryptServiceConnectionConfig(
                mysqlConnection, Mysql.value(), "external-secrets-service", ServiceType.DATABASE);

    verify(secretsManagerClient, never()).createSecret(any(CreateSecretRequest.class));

    reset(secretsManagerClient);
    lenient()
        .when(secretsManagerClient.getSecretValue(any(GetSecretValueRequest.class)))
        .thenThrow(
            ResourceNotFoundException.builder()
                .message("Secrets Manager can't find the specified secret.")
                .build());

    MysqlConnection decryptedConnection =
        (MysqlConnection)
            secretsManager.decryptServiceConnectionConfig(
                encryptedConnection, Mysql.value(), ServiceType.DATABASE);

    String decryptedPassword =
        JsonUtils.convertValue(decryptedConnection.getAuthType(), basicAuth.class).getPassword();
    assertEquals(
        externalSecretReference,
        decryptedPassword,
        "External secret reference should be returned as-is during decryption, "
            + "not fetched from the server's secrets manager");
  }
}
