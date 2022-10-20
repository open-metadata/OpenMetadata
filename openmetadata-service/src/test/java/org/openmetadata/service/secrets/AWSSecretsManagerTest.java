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
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.core.JsonProcessingException;
import java.util.Objects;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.openmetadata.schema.api.services.ingestionPipelines.TestServiceConnection;
import org.openmetadata.schema.services.connections.database.MysqlConnection;
import org.openmetadata.schema.services.connections.metadata.SecretsManagerProvider;
import org.openmetadata.service.util.JsonUtils;
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
    ArgumentCaptor<CreateSecretRequest> createSecretCaptor = ArgumentCaptor.forClass(CreateSecretRequest.class);
    verify(secretsManagerClient).createSecret(createSecretCaptor.capture());
    verifySecretIdGetCalls(EXPECTED_SECRET_ID, 1);
    assertEquals(EXPECTED_SECRET_ID, createSecretCaptor.getValue().name());
    assertEquals(EXPECTED_CONNECTION_JSON, createSecretCaptor.getValue().secretString());
  }

  @Test
  void testEncryptTestServiceConnection() {
    String expectedSecretId = String.format("/openmetadata/%s/database", TEST_CONNECTION_SECRET_ID_PREFIX);
    mockClientGetValue(null);
    TestServiceConnection testServiceConnection =
        new TestServiceConnection()
            .withConnection(new MysqlConnection())
            .withConnectionType(TestServiceConnection.ConnectionType.Database)
            .withSecretsManagerProvider(secretsManager.getSecretsManagerProvider());
    ArgumentCaptor<CreateSecretRequest> createSecretCaptor = ArgumentCaptor.forClass(CreateSecretRequest.class);
    Object serviceConnection = secretsManager.storeTestConnectionObject(testServiceConnection);
    verify(secretsManagerClient).createSecret(createSecretCaptor.capture());
    verifySecretIdGetCalls(expectedSecretId, 1);
    assertEquals(expectedSecretId, createSecretCaptor.getValue().name());
    assertEquals(
        "{\"type\":\"Mysql\",\"scheme\":\"mysql+pymysql\",\"supportsMetadataExtraction\":true,\"supportsProfiler\":true,\"supportsQueryComment\":true}",
        createSecretCaptor.getValue().secretString());
    assertNull(serviceConnection);
  }

  @Test
  void testEncryptDatabaseServiceConnectionConfigWhenAlreadyExist() {
    mockClientGetValue(EXPECTED_CONNECTION_JSON);
    testEncryptDecryptServiceConnection(ENCRYPT);
    ArgumentCaptor<UpdateSecretRequest> updateSecretCaptor = ArgumentCaptor.forClass(UpdateSecretRequest.class);
    verify(secretsManagerClient).updateSecret(updateSecretCaptor.capture());
    verifySecretIdGetCalls(EXPECTED_SECRET_ID, 1);
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
