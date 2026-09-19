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

package org.openmetadata.service.clients.pipeline;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.configuration.pipelineServiceClient.PipelineServiceClientConfiguration;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineServiceClientResponse;
import org.openmetadata.sdk.PipelineServiceClientInterface;
import org.openmetadata.service.clients.pipeline.noop.NoopClient;

/**
 * Metering wraps every pipeline service client, so it must survive whatever the decorated client
 * answers. Reading the status code off a {@code null} response turned a Noop deployment's status
 * polls into NullPointerExceptions.
 */
class MeteredPipelineServiceClientTest {

  private static MeteredPipelineServiceClient meteredNoopClient() {
    return new MeteredPipelineServiceClient(
        new NoopClient(
            new PipelineServiceClientConfiguration()
                .withEnabled(true)
                .withClassName(NoopClient.class.getName())
                .withIngestionIpInfoEnabled(false)));
  }

  @Test
  void getServiceStatusOnANoopClientIsMeteredAndAnswered() {
    PipelineServiceClientResponse status = meteredNoopClient().getServiceStatus();

    assertNotNull(status);
    assertEquals(200, status.getCode());
  }

  @Test
  void aNullResponseFromTheDecoratedClientIsPassedThrough() {
    PipelineServiceClientInterface decoratedClient = mock(PipelineServiceClientInterface.class);
    when(decoratedClient.getServiceStatus()).thenReturn(null);

    assertNull(new MeteredPipelineServiceClient(decoratedClient).getServiceStatus());
  }

  @Test
  void aResponseWithoutAStatusCodeIsPassedThrough() {
    PipelineServiceClientInterface decoratedClient = mock(PipelineServiceClientInterface.class);
    when(decoratedClient.getServiceStatus()).thenReturn(new PipelineServiceClientResponse());

    assertNull(new MeteredPipelineServiceClient(decoratedClient).getServiceStatus().getCode());
  }
}
