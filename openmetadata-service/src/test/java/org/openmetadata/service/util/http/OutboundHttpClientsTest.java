/*
 *  Copyright 2026 Collate
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

package org.openmetadata.service.util.http;

import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.client.Client;
import jakarta.ws.rs.client.ClientBuilder;
import java.util.concurrent.TimeUnit;
import org.glassfish.jersey.client.ClientProperties;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.service.util.OutboundUrlPolicyFilter;

class OutboundHttpClientsTest {

  @Test
  void getClientClampsTimeoutsAndCarriesTheOutboundPolicy() {
    ClientBuilder builder = mock(ClientBuilder.class);
    Client client = mock(Client.class);
    when(builder.connectTimeout(5, TimeUnit.SECONDS)).thenReturn(builder);
    when(builder.readTimeout(120, TimeUnit.SECONDS)).thenReturn(builder);
    when(builder.build()).thenReturn(client);

    try (MockedStatic<ClientBuilder> mockedClientBuilder = mockStatic(ClientBuilder.class)) {
      mockedClientBuilder.when(ClientBuilder::newBuilder).thenReturn(builder);

      Client createdClient = OutboundHttpClients.newClient(1, 999);

      assertSame(client, createdClient);
      verify(builder).connectTimeout(5, TimeUnit.SECONDS);
      verify(builder).readTimeout(120, TimeUnit.SECONDS);
      verify(builder).property(ClientProperties.FOLLOW_REDIRECTS, false);
      verify(builder).register(any(OutboundUrlPolicyFilter.class));
    }
  }
}
