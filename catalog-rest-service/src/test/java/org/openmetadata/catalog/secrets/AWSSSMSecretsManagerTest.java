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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
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
import org.openmetadata.catalog.services.connections.metadata.OpenMetadataServerConnection;
import org.openmetadata.catalog.util.JsonUtils;
import software.amazon.awssdk.services.ssm.SsmClient;
import software.amazon.awssdk.services.ssm.model.GetParameterRequest;
import software.amazon.awssdk.services.ssm.model.GetParameterResponse;
import software.amazon.awssdk.services.ssm.model.Parameter;
import software.amazon.awssdk.services.ssm.model.ParameterType;
import software.amazon.awssdk.services.ssm.model.PutParameterRequest;

public class AWSSSMSecretsManagerTest extends ExternalSecretsManagerTest {

  @Mock private SsmClient ssmClient;

  @Test
  void testEncryptDatabaseServiceConnectionConfig() {
    mockClientGetValue(null);
    testEncryptDecryptServiceConnection(ENCRYPT);
    ArgumentCaptor<PutParameterRequest> createSecretCaptor = ArgumentCaptor.forClass(PutParameterRequest.class);
    verify(ssmClient).putParameter(createSecretCaptor.capture());
    verifySecretIdGetCalls(EXPECTED_SECRET_ID, 1);
    assertEquals(EXPECTED_SECRET_ID, createSecretCaptor.getValue().name());
    assertFalse(createSecretCaptor.getValue().overwrite());
    assertEquals(ParameterType.SECURE_STRING, createSecretCaptor.getValue().type());
    assertEquals(EXPECTED_CONNECTION_JSON, createSecretCaptor.getValue().value());
  }

  @Test
  void testEncryptDatabaseServiceConnectionConfigWhenAlreadyExist() {
    mockClientGetValue(EXPECTED_CONNECTION_JSON);
    testEncryptDecryptServiceConnection(ENCRYPT);
    ArgumentCaptor<PutParameterRequest> updateSecretCaptor = ArgumentCaptor.forClass(PutParameterRequest.class);
    verify(ssmClient).putParameter(updateSecretCaptor.capture());
    verifySecretIdGetCalls(EXPECTED_SECRET_ID, 1);
    assertEquals(EXPECTED_SECRET_ID, updateSecretCaptor.getValue().name());
    assertTrue(updateSecretCaptor.getValue().overwrite());
    assertEquals(ParameterType.SECURE_STRING, updateSecretCaptor.getValue().type());
    assertEquals(EXPECTED_CONNECTION_JSON, updateSecretCaptor.getValue().value());
  }

  @Override
  void setUpSpecific(SecretsManagerConfiguration config) {
    secretsManager = AWSSSMSecretsManager.getInstance(config, "openmetadata");
    ((AWSSSMSecretsManager) secretsManager).setSsmClient(ssmClient);
    reset(ssmClient);
  }

  @Override
  void mockClientGetValue(String value) {
    if (value == null) {
      when(ssmClient.getParameter(any(GetParameterRequest.class))).thenReturn(GetParameterResponse.builder().build());
    } else {
      when(ssmClient.getParameter(any(GetParameterRequest.class)))
          .thenReturn(GetParameterResponse.builder().parameter(Parameter.builder().value(value).build()).build());
    }
  }

  @Override
  void verifySecretIdGetCalls(String expectedSecretId, int times) {
    ArgumentCaptor<GetParameterRequest> getSecretCaptor = ArgumentCaptor.forClass(GetParameterRequest.class);
    verify(ssmClient, times(times)).getParameter(getSecretCaptor.capture());
    for (int i = 0; i < times; i++) {
      assertEquals(expectedSecretId, getSecretCaptor.getAllValues().get(i).name());
    }
  }

  @Override
  void verifyClientCalls(Object expectedAuthProviderConfig, String expectedSecretId) throws JsonProcessingException {
    ArgumentCaptor<PutParameterRequest> createSecretCaptor = ArgumentCaptor.forClass(PutParameterRequest.class);
    if (Objects.isNull(expectedAuthProviderConfig)) {
      verifyNoInteractions(ssmClient);
    } else {
      verify(ssmClient).putParameter(createSecretCaptor.capture());
      assertEquals(expectedSecretId, createSecretCaptor.getValue().name());
      assertNotNull(createSecretCaptor.getValue().value());
      assertEquals(JsonUtils.pojoToJson(expectedAuthProviderConfig), createSecretCaptor.getValue().value());
    }
  }

  @Override
  OpenMetadataServerConnection.SecretsManagerProvider expectedSecretManagerProvider() {
    return OpenMetadataServerConnection.SecretsManagerProvider.AWS_SSM;
  }
}
