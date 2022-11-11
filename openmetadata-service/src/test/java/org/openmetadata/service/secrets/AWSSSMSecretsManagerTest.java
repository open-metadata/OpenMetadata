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
import software.amazon.awssdk.services.ssm.SsmClient;
import software.amazon.awssdk.services.ssm.model.GetParameterRequest;
import software.amazon.awssdk.services.ssm.model.GetParameterResponse;
import software.amazon.awssdk.services.ssm.model.Parameter;
import software.amazon.awssdk.services.ssm.model.PutParameterRequest;

public class AWSSSMSecretsManagerTest extends ExternalSecretsManagerTest {

  @Mock private SsmClient ssmClient;

  @Override
  void setUpSpecific(SecretsManagerConfiguration config) {
    secretsManager = AWSSSMSecretsManager.getInstance(config, "openmetadata");
    ((AWSSSMSecretsManager) secretsManager).setSsmClient(ssmClient);
    reset(ssmClient);
  }

  @Override
  void mockClientGetValue(String value) {
    if (value == null) {
      lenient()
          .when(ssmClient.getParameter(any(GetParameterRequest.class)))
          .thenReturn(GetParameterResponse.builder().build());
    } else {
      lenient()
          .when(ssmClient.getParameter(any(GetParameterRequest.class)))
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
  SecretsManagerProvider expectedSecretManagerProvider() {
    return SecretsManagerProvider.AWS_SSM;
  }
}
