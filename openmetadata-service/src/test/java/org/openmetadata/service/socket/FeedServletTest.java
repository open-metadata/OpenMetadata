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

package org.openmetadata.service.socket;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.socket.engineio.server.EngineIoServer;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.PrintWriter;
import java.io.StringWriter;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;

class FeedServletTest {

  @Test
  void serviceDelegatesValidRequestsToEngineIoServer() throws IOException {
    final HttpServletRequest request = mock(HttpServletRequest.class);
    final HttpServletResponse response = mock(HttpServletResponse.class);
    final WebSocketManager webSocketManager = mock(WebSocketManager.class);
    final EngineIoServer engineIoServer = mock(EngineIoServer.class);
    when(webSocketManager.getEngineIoServer()).thenReturn(engineIoServer);

    try (MockedStatic<WebSocketManager> manager = mockStatic(WebSocketManager.class)) {
      manager.when(WebSocketManager::getInstance).thenReturn(webSocketManager);

      new FeedServlet().service(request, response);
    }

    verify(engineIoServer).handleRequest(any(), any());
    verify(response, never()).sendError(anyInt(), any());
  }

  @Test
  void serviceDoesNotExposeInternalExceptionMessage() throws IOException {
    final String sensitiveMessage = "/srv/openmetadata/private/config.yaml";
    final HttpServletRequest request = mock(HttpServletRequest.class);
    final HttpServletResponse response = mock(HttpServletResponse.class);
    final WebSocketManager webSocketManager = mock(WebSocketManager.class);
    final EngineIoServer engineIoServer = mock(EngineIoServer.class);
    final StringWriter responseBody = new StringWriter();
    when(response.getWriter()).thenReturn(new PrintWriter(responseBody));
    when(webSocketManager.getEngineIoServer()).thenReturn(engineIoServer);
    doThrow(new IOException(sensitiveMessage)).when(engineIoServer).handleRequest(any(), any());

    try (MockedStatic<WebSocketManager> manager = mockStatic(WebSocketManager.class)) {
      manager.when(WebSocketManager::getInstance).thenReturn(webSocketManager);

      new FeedServlet().service(request, response);
    }

    final ArgumentCaptor<String> errorMessage = ArgumentCaptor.forClass(String.class);
    verify(response)
        .sendError(eq(HttpServletResponse.SC_INTERNAL_SERVER_ERROR), errorMessage.capture());
    assertFalse(errorMessage.getValue().contains(sensitiveMessage));
    assertFalse(responseBody.toString().contains(sensitiveMessage));
    verify(response, never()).getWriter();
  }
}
