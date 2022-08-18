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
package org.openmetadata.catalog.secrets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.core.JsonProcessingException;
import java.util.Objects;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.openmetadata.catalog.services.connections.metadata.OpenMetadataServerConnection;
import org.openmetadata.catalog.util.JsonUtils;
import software.amazon.awssdk.services.secretsmanager.SecretsManagerClient;
import software.amazon.awssdk.services.secretsmanager.model.CreateSecretRequest;
import software.amazon.awssdk.services.secretsmanager.model.GetSecretValueRequest;
import software.amazon.awssdk.services.secretsmanager.model.GetSecretValueResponse;
import software.amazon.awssdk.services.secretsmanager.model.UpdateSecretRequest;

public class AWSSecretsManagerTest extends ExternalSecretsManagerTest {

  @Mock private SecretsManagerClient secretsManagerClient;

  @Test
  void testEncryptDatabaseServiceConnectionConfig() {
    mockClientGetValue(null);
    testEncryptDecryptServiceConnection(ENCRYPT);
    ArgumentCaptor<GetSecretValueRequest> getSecretCaptor = ArgumentCaptor.forClass(GetSecretValueRequest.class);
    ArgumentCaptor<CreateSecretRequest> createSecretCaptor = ArgumentCaptor.forClass(CreateSecretRequest.class);
    verify(secretsManagerClient).getSecretValue(getSecretCaptor.capture());
    verify(secretsManagerClient).createSecret(createSecretCaptor.capture());
    assertEquals(EXPECTED_SECRET_ID, getSecretCaptor.getValue().secretId());
    assertEquals(EXPECTED_SECRET_ID, createSecretCaptor.getValue().name());
    assertEquals(EXPECTED_CONNECTION_JSON, createSecretCaptor.getValue().secretString());
  }

  @Test
  void testEncryptDatabaseServiceConnectionConfigWhenAlreadyExist() {
    mockClientGetValue(EXPECTED_CONNECTION_JSON);
    testEncryptDecryptServiceConnection(ENCRYPT);
    ArgumentCaptor<GetSecretValueRequest> getSecretCaptor = ArgumentCaptor.forClass(GetSecretValueRequest.class);
    ArgumentCaptor<UpdateSecretRequest> updateSecretCaptor = ArgumentCaptor.forClass(UpdateSecretRequest.class);
    verify(secretsManagerClient).getSecretValue(getSecretCaptor.capture());
    verify(secretsManagerClient).updateSecret(updateSecretCaptor.capture());
    assertEquals(EXPECTED_SECRET_ID, getSecretCaptor.getValue().secretId());
    assertEquals(EXPECTED_SECRET_ID, updateSecretCaptor.getValue().secretId());
    assertEquals(EXPECTED_CONNECTION_JSON, updateSecretCaptor.getValue().secretString());
  }

  @Override
  void setUpSpecific(SecretsManagerConfiguration config) {
    secretsManager = AWSSecretsManager.getInstance(config, "openmetadata");
    ((AWSSecretsManager) secretsManager).setSecretsClient(secretsManagerClient);
    reset(secretsManagerClient);
  }

  @Override
  void mockClientGetValue(String value) {
    if (value == null) {
      when(secretsManagerClient.getSecretValue(any(GetSecretValueRequest.class)))
          .thenReturn(GetSecretValueResponse.builder().build());
    } else {
      when(secretsManagerClient.getSecretValue(any(GetSecretValueRequest.class)))
          .thenReturn(GetSecretValueResponse.builder().secretString(value).build());
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
  OpenMetadataServerConnection.SecretsManagerProvider expectedSecretManagerProvider() {
    return OpenMetadataServerConnection.SecretsManagerProvider.AWS;
  }
}
