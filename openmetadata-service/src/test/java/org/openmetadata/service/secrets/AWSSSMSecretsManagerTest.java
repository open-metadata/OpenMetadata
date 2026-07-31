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

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.openmetadata.schema.security.secrets.SecretsManagerConfiguration;
import org.openmetadata.schema.security.secrets.SecretsManagerProvider;
import software.amazon.awssdk.services.ssm.SsmClient;
import software.amazon.awssdk.services.ssm.model.GetParameterRequest;
import software.amazon.awssdk.services.ssm.model.GetParameterResponse;
import software.amazon.awssdk.services.ssm.model.Parameter;
import software.amazon.awssdk.services.ssm.model.ParameterAlreadyExistsException;
import software.amazon.awssdk.services.ssm.model.ParameterNotFoundException;
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

  @Test
  void createTagsTheParameterWithoutOverwriteAndWithoutAnExistenceRead() {
    ArgumentCaptor<PutParameterRequest> captor = ArgumentCaptor.forClass(PutParameterRequest.class);

    secretsManager.upsertSecret("/prefix/database/myservice/newparam", "value");

    verify(ssmClient).putParameter(captor.capture());
    PutParameterRequest request = captor.getValue();
    assertFalse(request.overwrite(), "creating a parameter must not overwrite");
    assertTrue(request.hasTags(), "creating a parameter must apply the configured tags");
    verify(ssmClient, never()).getParameter(any(GetParameterRequest.class));
  }

  @Test
  void updateFallsBackToOverwriteWithoutTagsWhenTheParameterAlreadyExists() {
    reset(ssmClient);
    when(ssmClient.putParameter(any(PutParameterRequest.class)))
        .thenAnswer(
            invocation -> {
              PutParameterRequest request = invocation.getArgument(0);
              if (Boolean.FALSE.equals(request.overwrite())) {
                throw ParameterAlreadyExistsException.builder().message("already exists").build();
              }
              return PutParameterResponse.builder().build();
            });
    ArgumentCaptor<PutParameterRequest> captor = ArgumentCaptor.forClass(PutParameterRequest.class);

    secretsManager.upsertSecret("/prefix/database/myservice/password", "rotated-value");

    verify(ssmClient, times(2)).putParameter(captor.capture());
    PutParameterRequest create = captor.getAllValues().get(0);
    PutParameterRequest overwrite = captor.getAllValues().get(1);
    assertFalse(create.overwrite(), "the first attempt must be a tagged create");
    assertTrue(create.hasTags(), "the create attempt must carry the configured tags");
    assertTrue(overwrite.overwrite(), "the fallback must overwrite the existing parameter");
    assertFalse(
        overwrite.hasTags(),
        "SSM rejects Overwrite combined with Tags, so the overwrite must omit tags");
    verify(ssmClient, never()).getParameter(any(GetParameterRequest.class));
  }

  @Test
  void isNotFoundExceptionRecognizesParameterNotFoundButNotOtherErrors() {
    assertTrue(
        secretsManager.isNotFoundException(
            ParameterNotFoundException.builder().message("parameter not found").build()),
        "ParameterNotFoundException must be classified as a genuine not-found");
    assertFalse(
        secretsManager.isNotFoundException(new RuntimeException("throttled / access denied")),
        "Other read failures must not be mistaken for a missing parameter");
  }
}
