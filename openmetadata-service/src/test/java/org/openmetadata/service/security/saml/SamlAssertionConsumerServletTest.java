/*
 *  Copyright 2025 Collate.
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
package org.openmetadata.service.security.saml;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.servlet.ServletContext;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.PrintWriter;
import java.io.StringWriter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.service.security.AuthServeletHandler;
import org.openmetadata.service.security.AuthServeletHandlerRegistry;
import org.openmetadata.service.security.TestLoginCallbackPage;
import org.openmetadata.service.security.auth.SamlAuthServletHandler;

class SamlAssertionConsumerServletTest {
  private final HttpServletRequest request = mock(HttpServletRequest.class);
  private final HttpServletResponse response = mock(HttpServletResponse.class);
  private final ServletContext servletContext = mock(ServletContext.class);
  private final AuthServeletHandler liveHandler = mock(AuthServeletHandler.class);
  private final SamlAssertionConsumerServlet servlet = new SamlAssertionConsumerServlet();

  @BeforeEach
  void setUp() {
    when(request.getServletContext()).thenReturn(servletContext);
  }

  @Test
  void aTestLoginPostRendersTheConstantPageAndNeverReachesTheLiveHandler() throws IOException {
    StringWriter body = new StringWriter();
    when(request.getParameter("RelayState")).thenReturn("omtest:no-such-test");
    when(response.getWriter()).thenReturn(new PrintWriter(body));

    try (MockedStatic<AuthServeletHandlerRegistry> registry =
        mockStatic(AuthServeletHandlerRegistry.class)) {
      registry
          .when(() -> AuthServeletHandlerRegistry.getHandler(servletContext))
          .thenReturn(liveHandler);

      servlet.doPost(request, response);
    }

    verify(liveHandler, never()).handleCallback(any(), any());
    assertEquals(TestLoginCallbackPage.HTML, body.toString());
  }

  @Test
  void anyOtherPostIsNotFoundWhileANonSamlProviderIsLive() throws IOException {
    when(request.getParameter("RelayState")).thenReturn("a-live-login-relay-state");

    try (MockedStatic<AuthServeletHandlerRegistry> registry =
        mockStatic(AuthServeletHandlerRegistry.class)) {
      registry
          .when(() -> AuthServeletHandlerRegistry.getHandler(servletContext))
          .thenReturn(liveHandler);

      servlet.doPost(request, response);
    }

    verify(response).setStatus(HttpServletResponse.SC_NOT_FOUND);
    verify(response, never()).sendError(anyInt());
    verify(liveHandler, never()).handleCallback(any(), any());
  }

  @Test
  void aLiveSamlLoginStillReachesItsHandler() {
    SamlAuthServletHandler samlHandler = mock(SamlAuthServletHandler.class);
    when(request.getParameter("RelayState")).thenReturn("a-live-login-relay-state");

    try (MockedStatic<AuthServeletHandlerRegistry> registry =
        mockStatic(AuthServeletHandlerRegistry.class)) {
      registry
          .when(() -> AuthServeletHandlerRegistry.getHandler(servletContext))
          .thenReturn(samlHandler);

      servlet.doPost(request, response);
    }

    verify(samlHandler).handleCallback(request, response);
  }
}
