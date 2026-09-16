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

import java.lang.reflect.Field;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.security.secrets.Parameters;
import org.openmetadata.service.fernet.Fernet;
import org.testcontainers.containers.localstack.LocalStackContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.ssm.SsmClient;

/**
 * End-to-end test of {@link AWSSSMSecretsManager} against a real AWS SSM Parameter Store backend
 * emulated by LocalStack in a Testcontainer. Exercises the create/update/read/exist/delete paths
 * through the real AWS SDK and the rate limiter. Skipped automatically when Docker is unavailable.
 */
@Testcontainers(disabledWithoutDocker = true)
class AWSSSMSecretsManagerLocalStackTest {

  private static final DockerImageName LOCALSTACK_IMAGE =
      DockerImageName.parse("localstack/localstack:3.8.1");

  private static final String FERNET_KEY = "jJ/9sz0g0OHxsfxOoSfdFdmk3ysNmPRnH3TUAbz3IHA=";

  @Container
  static final LocalStackContainer LOCALSTACK =
      new LocalStackContainer(LOCALSTACK_IMAGE).withServices(LocalStackContainer.Service.SSM);

  private AWSSSMSecretsManager secretsManager;
  private SsmClient rawClient;

  @BeforeEach
  void setUp() throws Exception {
    Fernet.getInstance().setFernetKey(FERNET_KEY);
    resetSingleton();
    rawClient = newSsmClient();
    secretsManager = AWSSSMSecretsManager.getInstance(localStackConfig());
    secretsManager.setSsmClient(rawClient);
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
    String parameterName = "/openmetadata/it/ssm-round-trip";

    assertFalse(
        secretsManager.existSecret(parameterName), "a never-created parameter must not exist");

    secretsManager.upsertSecret(parameterName, "first-value");
    assertTrue(secretsManager.existSecret(parameterName), "the stored parameter must now exist");
    assertEquals("first-value", secretsManager.getSecret(parameterName));

    secretsManager.upsertSecret(parameterName, "rotated-value");
    assertEquals(
        "rotated-value",
        secretsManager.getSecret(parameterName),
        "a second upsert must overwrite the existing parameter");
  }

  @Test
  void existSecretReturnsFalseForAGenuinelyMissingParameter() {
    assertFalse(secretsManager.existSecret("/openmetadata/it/ssm-never-created"));
  }

  @Test
  void deleteRemovesTheParameterFromTheStore() {
    String parameterName = "/openmetadata/it/ssm-to-delete";
    secretsManager.upsertSecret(parameterName, "value");
    assertTrue(secretsManager.existSecret(parameterName));

    secretsManager.deleteSecretInternal(parameterName);

    assertFalse(secretsManager.existSecret(parameterName), "a deleted parameter must not exist");
  }

  private SecretsManager.SecretsConfig localStackConfig() {
    Parameters parameters = new Parameters();
    parameters.setAdditionalProperty("region", LOCALSTACK.getRegion());
    parameters.setAdditionalProperty("accessKeyId", LOCALSTACK.getAccessKey());
    parameters.setAdditionalProperty("secretAccessKey", LOCALSTACK.getSecretKey());
    return new SecretsManager.SecretsConfig(
        "openmetadata", "prefix", List.of("managed-by:openmetadata"), parameters);
  }

  private static SsmClient newSsmClient() {
    return SsmClient.builder()
        .endpointOverride(LOCALSTACK.getEndpoint())
        .region(Region.of(LOCALSTACK.getRegion()))
        .credentialsProvider(
            StaticCredentialsProvider.create(
                AwsBasicCredentials.create(LOCALSTACK.getAccessKey(), LOCALSTACK.getSecretKey())))
        .build();
  }

  private static void resetSingleton() throws Exception {
    Field instanceField = AWSSSMSecretsManager.class.getDeclaredField("instance");
    instanceField.setAccessible(true);
    instanceField.set(null, null);
  }
}
