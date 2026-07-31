/*
 *  Copyright 2021 Collate
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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.schema.api.services.CreateDatabaseService.DatabaseServiceType.Mysql;

import java.lang.reflect.Field;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.security.secrets.Parameters;
import org.openmetadata.service.fernet.Fernet;
import org.testcontainers.containers.localstack.LocalStackContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.secretsmanager.SecretsManagerClient;
import software.amazon.awssdk.services.secretsmanager.model.ListSecretsRequest;
import software.amazon.awssdk.services.secretsmanager.model.ListSecretsResponse;
import software.amazon.awssdk.services.secretsmanager.model.SecretListEntry;

/**
 * End-to-end test of {@link AWSSecretsManager} against a real AWS Secrets Manager backend emulated
 * by LocalStack in a Testcontainer. Exercises the create/update/read/exist/delete paths and the
 * connection-encrypt flow through the real AWS SDK and the rate limiter, rather than Mockito stand-
 * ins. Skipped automatically when Docker is not available.
 */
@Testcontainers(disabledWithoutDocker = true)
class AWSSecretsManagerLocalStackTest {

  private static final DockerImageName LOCALSTACK_IMAGE =
      DockerImageName.parse("localstack/localstack:3.8.1");

  private static final String FERNET_KEY = "jJ/9sz0g0OHxsfxOoSfdFdmk3ysNmPRnH3TUAbz3IHA=";

  @Container
  static final LocalStackContainer LOCALSTACK =
      new LocalStackContainer(LOCALSTACK_IMAGE)
          .withServices(LocalStackContainer.Service.SECRETSMANAGER);

  private AWSSecretsManager secretsManager;
  private SecretsManagerClient rawClient;

  @BeforeEach
  void setUp() throws Exception {
    Fernet.getInstance().setFernetKey(FERNET_KEY);
    resetSingleton();
    rawClient = newSecretsManagerClient();
    secretsManager = AWSSecretsManager.getInstance(localStackConfig());
    secretsManager.setSecretsClient(rawClient);
  }

  @AfterEach
  void tearDown() throws Exception {
    if (rawClient != null) {
      rawClient.close();
    }
    resetSingleton();
  }

  @Test
  void createReadAndUpdateRoundTripAgainstLocalStack() {
    String secretName = "/openmetadata/it/round-trip";

    assertFalse(secretsManager.existSecret(secretName), "a never-created secret must not exist");

    secretsManager.upsertSecret(secretName, "first-value");
    assertTrue(secretsManager.existSecret(secretName), "the stored secret must now exist");
    assertEquals("first-value", secretsManager.getSecret(secretName));

    secretsManager.upsertSecret(secretName, "rotated-value");
    assertEquals(
        "rotated-value",
        secretsManager.getSecret(secretName),
        "a second upsert must update the existing secret in place");
  }

  @Test
  void existSecretReturnsFalseForAGenuinelyMissingSecret() {
    assertFalse(secretsManager.existSecret("/openmetadata/it/never-created"));
  }

  @Test
  void deleteRemovesTheSecretFromTheVault() {
    String secretName = "/openmetadata/it/to-delete";
    secretsManager.upsertSecret(secretName, "value");
    assertTrue(secretsManager.existSecret(secretName));

    secretsManager.deleteSecretInternal(secretName);

    assertFalse(secretsManager.existSecret(secretName), "a force-deleted secret must not exist");
  }

  @Test
  void encryptingAConnectionPersistsThePasswordInTheVault() {
    String password = "openmetadata-localstack-secret";
    Map<String, Map<String, String>> mysqlConnection =
        Map.of("authType", Map.of("password", password));

    secretsManager.encryptServiceConnectionConfig(
        mysqlConnection, Mysql.value(), "ls-service", ServiceType.DATABASE);

    ListSecretsResponse listed = rawClient.listSecrets(ListSecretsRequest.builder().build());
    boolean retrievableFromVault =
        listed.secretList().stream()
            .map(SecretListEntry::name)
            .map(secretsManager::getSecret)
            .anyMatch(password::equals);
    assertTrue(
        retrievableFromVault,
        "the connection password must be stored and retrievable from the vault");
  }

  private SecretsManager.SecretsConfig localStackConfig() {
    Parameters parameters = new Parameters();
    parameters.setAdditionalProperty("region", LOCALSTACK.getRegion());
    parameters.setAdditionalProperty("accessKeyId", LOCALSTACK.getAccessKey());
    parameters.setAdditionalProperty("secretAccessKey", LOCALSTACK.getSecretKey());
    return new SecretsManager.SecretsConfig(
        "openmetadata", "prefix", List.of("managed-by:openmetadata"), parameters);
  }

  private static SecretsManagerClient newSecretsManagerClient() {
    return SecretsManagerClient.builder()
        .endpointOverride(LOCALSTACK.getEndpoint())
        .region(Region.of(LOCALSTACK.getRegion()))
        .credentialsProvider(
            StaticCredentialsProvider.create(
                AwsBasicCredentials.create(LOCALSTACK.getAccessKey(), LOCALSTACK.getSecretKey())))
        .build();
  }

  private static void resetSingleton() throws Exception {
    Field instanceField = AWSSecretsManager.class.getDeclaredField("instance");
    instanceField.setAccessible(true);
    instanceField.set(null, null);
  }
}
