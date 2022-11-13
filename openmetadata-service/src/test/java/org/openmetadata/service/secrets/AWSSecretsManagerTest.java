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
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import com.fasterxml.jackson.core.JsonProcessingException;
import java.util.Objects;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.openmetadata.schema.services.connections.metadata.SecretsManagerProvider;
import org.openmetadata.service.util.JsonUtils;
import software.amazon.awssdk.services.secretsmanager.SecretsManagerClient;
import software.amazon.awssdk.services.secretsmanager.model.CreateSecretRequest;
import software.amazon.awssdk.services.secretsmanager.model.GetSecretValueRequest;
import software.amazon.awssdk.services.secretsmanager.model.GetSecretValueResponse;

public class AWSSecretsManagerTest extends ExternalSecretsManagerTest {

  @Mock private SecretsManagerClient secretsManagerClient;

  @Override
  void setUpSpecific(SecretsManagerConfiguration config) {
    secretsManager = AWSSecretsManager.getInstance(config, "openmetadata");
    ((AWSSecretsManager) secretsManager).setSecretsClient(secretsManagerClient);
    reset(secretsManagerClient);
  }

  @Override
  void mockClientGetValue(String value) {
    if (value == null) {
      lenient()
          .when(secretsManagerClient.getSecretValue(any(GetSecretValueRequest.class)))
          .thenReturn(GetSecretValueResponse.builder().build());
    } else {
      lenient()
          .when(secretsManagerClient.getSecretValue(any(GetSecretValueRequest.class)))
          .thenReturn(GetSecretValueResponse.builder().secretString(value).build());
    }
  }

  @Override
  void verifySecretIdGetCalls(String expectedSecretId, int times) {
    ArgumentCaptor<GetSecretValueRequest> getSecretCaptor = ArgumentCaptor.forClass(GetSecretValueRequest.class);
    verify(secretsManagerClient, times(times)).getSecretValue(getSecretCaptor.capture());
    for (int i = 0; i < times; i++) {
      assertEquals(expectedSecretId, getSecretCaptor.getAllValues().get(i).secretId());
    }
  }

  @Override
  void verifyClientCalls(Object expectedAuthProviderConfig, String expectedSecretId) throws JsonProcessingException {
    ArgumentCaptor<CreateSecretRequest> createSecretCaptor = ArgumentCaptor.forClass(CreateSecretRequest.class);
    if (Objects.isNull(expectedAuthProviderConfig)) {
      verifyNoInteractions(secretsManagerClient);
    } else {
      verify(secretsManagerClient).createSecret(createSecretCaptor.capture());
      assertEquals(expectedSecretId, createSecretCaptor.getValue().name());
      assertNotNull(createSecretCaptor.getValue().secretString());
      assertEquals(JsonUtils.pojoToJson(expectedAuthProviderConfig), createSecretCaptor.getValue().secretString());
    }
  }

  @Override
  SecretsManagerProvider expectedSecretManagerProvider() {
    return SecretsManagerProvider.AWS;
  }
}
