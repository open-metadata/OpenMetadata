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

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.reset;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.mockito.Mock;
import org.openmetadata.schema.security.secrets.SecretsManagerConfiguration;
import org.openmetadata.schema.security.secrets.SecretsManagerProvider;
import software.amazon.awssdk.services.ssm.SsmClient;
import software.amazon.awssdk.services.ssm.model.GetParameterRequest;
import software.amazon.awssdk.services.ssm.model.GetParameterResponse;
import software.amazon.awssdk.services.ssm.model.Parameter;
import software.amazon.awssdk.services.ssm.model.PutParameterRequest;
import software.amazon.awssdk.services.ssm.model.PutParameterResponse;

public class AWSSSMSecretsManagerTest extends AWSBasedSecretsManagerTest {

  @Mock private SsmClient ssmClient;
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
        AWSSSMSecretsManager.getInstance(
            new SecretsManager.SecretsConfig(
                "openmetadata",
                "prefix",
                List.of("key:value", "key2:value2"),
                config.getParameters()));
    ((AWSSSMSecretsManager) secretsManager).setSsmClient(ssmClient);
    reset(ssmClient);

    // Mock the SSM client to simulate real storage and retrieval
    lenient()
        .when(ssmClient.putParameter(any(PutParameterRequest.class)))
        .thenAnswer(
            invocation -> {
              PutParameterRequest request = invocation.getArgument(0);
              mockSecretStorage.put(request.name(), request.value());
              return PutParameterResponse.builder().build();
            });

    lenient()
        .when(ssmClient.getParameter(any(GetParameterRequest.class)))
        .thenAnswer(
            invocation -> {
              GetParameterRequest request = invocation.getArgument(0);
              String paramName = request.name();
              String storedValue = mockSecretStorage.computeIfAbsent(paramName, n -> "secret:" + n);
              return GetParameterResponse.builder()
                  .parameter(Parameter.builder().value(storedValue).build())
                  .build();
            });
  }

  @Override
  protected SecretsManagerProvider expectedSecretManagerProvider() {
    return SecretsManagerProvider.MANAGED_AWS_SSM;
  }
}
