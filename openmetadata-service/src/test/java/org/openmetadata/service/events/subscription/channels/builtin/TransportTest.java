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

package org.openmetadata.service.events.subscription.channels.builtin;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.client.Client;
import jakarta.ws.rs.client.ClientBuilder;
import jakarta.ws.rs.client.Invocation;
import jakarta.ws.rs.client.WebTarget;
import java.net.URI;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.entity.events.authentication.WebhookBearerAuth;
import org.openmetadata.schema.type.Webhook;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.notifications.recipients.context.WebhookRecipient;
import org.openmetadata.service.security.SecurityUtil;

class TransportTest {
  private static final String SECRET = "plain-secret";

  @Test
  void timeoutsAreClamped() {
    ClientBuilder builder = mock(ClientBuilder.class);
    when(builder.connectTimeout(any(Long.class), any())).thenReturn(builder);
    when(builder.readTimeout(any(Long.class), any())).thenReturn(builder);
    when(builder.build()).thenReturn(mock(Client.class));

    try (MockedStatic<ClientBuilder> builders = mockStatic(ClientBuilder.class)) {
      builders.when(ClientBuilder::newBuilder).thenReturn(builder);
      new HttpWebhookTransport().clientFor(1, 999);
    }

    verify(builder).connectTimeout(HttpWebhookTransport.MIN_CONNECT_SECONDS, TimeUnit.SECONDS);
    verify(builder).readTimeout(HttpWebhookTransport.MAX_READ_SECONDS, TimeUnit.SECONDS);
  }

  @Test
  void oneClientPerDistinctClampedPair() {
    HttpWebhookTransport transport = new HttpWebhookTransport();
    try {
      Client tooLow = transport.clientFor(1, 1);
      Client atTheFloor =
          transport.clientFor(
              HttpWebhookTransport.MIN_CONNECT_SECONDS, HttpWebhookTransport.MIN_READ_SECONDS);
      Client another = transport.clientFor(20, 60);

      assertSame(tooLow, atTheFloor);
      assertNotSame(tooLow, another);
      assertEquals(2, transport.openClients());
    } finally {
      transport.close();
    }
  }

  @Test
  void clientsCloseOnShutdown() {
    Client client = mock(Client.class);
    ClientBuilder builder = mock(ClientBuilder.class);
    when(builder.connectTimeout(any(Long.class), any())).thenReturn(builder);
    when(builder.readTimeout(any(Long.class), any())).thenReturn(builder);
    when(builder.build()).thenReturn(client);
    HttpWebhookTransport transport = new HttpWebhookTransport();

    try (MockedStatic<ClientBuilder> builders = mockStatic(ClientBuilder.class)) {
      builders.when(ClientBuilder::newBuilder).thenReturn(builder);
      transport.clientFor(10, 10);
    }
    transport.close();

    verify(client).close();
    assertEquals(0, transport.openClients());
  }

  // The signature covers one body, so a request is built for each payload.
  @Test
  void signatureMatchesEachBody() {
    Webhook webhook =
        new Webhook()
            .withEndpoint(URI.create("https://hooks.example.com"))
            .withAuthType(
                Map.of("type", WebhookBearerAuth.Type.BEARER.value(), "secretKey", SECRET));
    WebhookRecipient recipient = new WebhookRecipient(webhook);

    for (String body : new String[] {"{\"n\":1}", "{\"n\":2}"}) {
      Invocation.Builder request = requestFor(recipient, body);
      verify(request)
          .header(eq("X-OM-Signature"), eq("sha256=" + CommonUtil.calculateHMAC(SECRET, body)));
    }
  }

  private static Invocation.Builder requestFor(WebhookRecipient recipient, String body) {
    Client client = mock(Client.class);
    WebTarget target = mock(WebTarget.class);
    Invocation.Builder request = mock(Invocation.Builder.class);
    when(client.target(any(String.class))).thenReturn(target);
    try (MockedStatic<SecurityUtil> security = mockStatic(SecurityUtil.class);
        MockedStatic<Fernet> fernets = mockStatic(Fernet.class)) {
      Fernet fernet = mock(Fernet.class);
      when(fernet.isKeyDefined()).thenReturn(false);
      fernets.when(Fernet::getInstance).thenReturn(fernet);
      security.when(() -> SecurityUtil.authHeaders(any())).thenReturn(Map.of());
      security.when(() -> SecurityUtil.addHeaders(eq(target), any())).thenReturn(request);
      return recipient.getConfiguredRequest(client, body);
    }
  }
}
