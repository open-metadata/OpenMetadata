/*
 *  Copyright 2026 Collate.
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
package org.openmetadata.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import jakarta.servlet.http.HttpServletResponse;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpResponse;
import java.net.http.WebSocket;
import java.net.http.WebSocketHandshakeException;
import java.time.Duration;
import java.util.Optional;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import org.eclipse.jetty.ee10.servlet.ServletContextHandler;
import org.eclipse.jetty.ee10.websocket.server.config.JettyWebSocketServletContainerInitializer;
import org.eclipse.jetty.server.Server;
import org.eclipse.jetty.server.ServerConnector;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.security.AuthenticationException;
import org.openmetadata.service.security.credentials.CredentialUnavailableException;
import org.openmetadata.service.socket.HandshakeRejectedException;
import org.openmetadata.service.socket.SocketAddressFilter;

/** What a client sees when the push-feed WebSocket upgrade does not accept its handshake. */
class OpenMetadataApplicationPushFeedUpgradeTest {
  private final SocketAddressFilter websocketFilter = mock(SocketAddressFilter.class);
  private Server server;

  @BeforeEach
  void startServer() throws Exception {
    server = new Server(0);
    ServletContextHandler context = new ServletContextHandler();
    JettyWebSocketServletContainerInitializer.configure(
        context,
        (servletContext, container) ->
            container.addMapping(
                "/api/v1/push/feed/*",
                (upgradeRequest, upgradeResponse) ->
                    OpenMetadataApplication.authenticateUpgrade(
                        websocketFilter, upgradeRequest, upgradeResponse)));
    server.setHandler(context);
    server.start();
  }

  @AfterEach
  void stopServer() throws Exception {
    server.stop();
  }

  @Test
  void upgradeAsksToRetryWhenTheTokenCannotBeConfirmed() throws Exception {
    when(websocketFilter.authenticate(any()))
        .thenThrow(new CredentialUnavailableException("No read slot for sam", 2, null));

    HttpResponse<?> answer = openFeedSocketExpectingRejection();

    assertEquals(503, answer.statusCode());
    assertEquals(Optional.of("2"), answer.headers().firstValue("Retry-After"));
  }

  @Test
  void upgradeAnswersARejectedHandshakeWithItsStatus() throws Exception {
    when(websocketFilter.authenticate(any()))
        .thenThrow(
            new HandshakeRejectedException(
                HttpServletResponse.SC_FORBIDDEN, "Socket user does not match session"));

    assertEquals(403, openFeedSocketExpectingRejection().statusCode());
  }

  @Test
  void upgradeAnswersUnauthorizedWhenAuthenticationFails() throws Exception {
    when(websocketFilter.authenticate(any()))
        .thenThrow(new AuthenticationException("Unknown WebSocket principal"));

    assertEquals(401, openFeedSocketExpectingRejection().statusCode());
  }

  private HttpResponse<?> openFeedSocketExpectingRejection() {
    int port = ((ServerConnector) server.getConnectors()[0]).getLocalPort();
    URI feed =
        URI.create("ws://localhost:" + port + "/api/v1/push/feed/?EIO=4&transport=websocket");
    try (HttpClient client = HttpClient.newHttpClient()) {
      ExecutionException failure =
          assertThrows(
              ExecutionException.class,
              () ->
                  client
                      .newWebSocketBuilder()
                      .connectTimeout(Duration.ofSeconds(10))
                      .buildAsync(feed, new WebSocket.Listener() {})
                      .get(20, TimeUnit.SECONDS));
      return assertInstanceOf(WebSocketHandshakeException.class, failure.getCause()).getResponse();
    }
  }
}
