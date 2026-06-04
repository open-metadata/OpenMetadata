package org.openmetadata.service.security;

import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.servlet.RequestDispatcher;
import jakarta.servlet.ServletContext;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AuthCallbackServletTest {

  @Mock private HttpServletRequest request;
  @Mock private HttpServletResponse response;
  @Mock private ServletContext servletContext;
  @Mock private RequestDispatcher requestDispatcher;
  @Mock private AuthServeletHandler handler;

  private AuthCallbackServlet servlet;

  @BeforeEach
  void setUp() {
    servlet = new AuthCallbackServlet();
    when(request.getServletContext()).thenReturn(servletContext);
  }

  @Test
  void doGet_nonMcpState_delegatesToHandler() {
    when(request.getParameter("state")).thenReturn("regular-state-value");

    try (MockedStatic<AuthenticationCodeFlowHandler> flowMock =
            mockStatic(AuthenticationCodeFlowHandler.class);
        MockedStatic<AuthServeletHandlerRegistry> registryMock =
            mockStatic(AuthServeletHandlerRegistry.class)) {

      flowMock
          .when(() -> AuthenticationCodeFlowHandler.isMcpState("regular-state-value"))
          .thenReturn(false);
      registryMock
          .when(() -> AuthServeletHandlerRegistry.getHandler(servletContext))
          .thenReturn(handler);

      servlet.doGet(request, response);

      verify(handler).handleCallback(request, response);
    }
  }

  @Test
  void doGet_mcpState_forwardsToMcpCallback() throws ServletException, IOException {
    when(request.getParameter("state")).thenReturn("mcp-state-value");
    when(request.getRequestDispatcher("/mcp/callback")).thenReturn(requestDispatcher);

    try (MockedStatic<AuthenticationCodeFlowHandler> flowMock =
            mockStatic(AuthenticationCodeFlowHandler.class);
        MockedStatic<AuthServeletHandlerRegistry> registryMock =
            mockStatic(AuthServeletHandlerRegistry.class)) {

      flowMock
          .when(() -> AuthenticationCodeFlowHandler.isMcpState("mcp-state-value"))
          .thenReturn(true);

      servlet.doGet(request, response);

      verify(requestDispatcher).forward(request, response);
      registryMock.verifyNoInteractions();
      verify(handler, never()).handleCallback(request, response);
    }
  }

  @Test
  void doGet_mcpForwardThrowsException_returns500() throws ServletException, IOException {
    when(request.getParameter("state")).thenReturn("mcp-state-value");
    when(request.getRequestDispatcher("/mcp/callback")).thenReturn(requestDispatcher);

    try (MockedStatic<AuthenticationCodeFlowHandler> flowMock =
        mockStatic(AuthenticationCodeFlowHandler.class)) {

      flowMock
          .when(() -> AuthenticationCodeFlowHandler.isMcpState("mcp-state-value"))
          .thenReturn(true);
      doThrow(new ServletException("Forward failed"))
          .when(requestDispatcher)
          .forward(request, response);

      servlet.doGet(request, response);

      verify(response)
          .sendError(
              HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Failed to process MCP callback");
    }
  }

  @Test
  void doPost_delegatesToHandler() {
    try (MockedStatic<AuthServeletHandlerRegistry> registryMock =
        mockStatic(AuthServeletHandlerRegistry.class)) {

      registryMock
          .when(() -> AuthServeletHandlerRegistry.getHandler(servletContext))
          .thenReturn(handler);

      servlet.doPost(request, response);

      verify(handler).handleCallback(request, response);
    }
  }
}
