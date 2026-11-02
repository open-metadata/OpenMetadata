package org.openmetadata.mcp.server.auth.handlers;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.openmetadata.service.security.SecurityUtil.findEmailFromClaims;
import static org.openmetadata.service.security.SecurityUtil.findUserNameFromClaims;

import jakarta.servlet.ServletOutputStream;
import jakarta.servlet.WriteListener;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.ByteArrayOutputStream;
import java.lang.reflect.Constructor;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.mcp.server.auth.provider.UserSSOOAuthProvider;
import org.openmetadata.mcp.server.auth.repository.McpPendingAuthRequestRepository;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.service.security.AuthenticationCodeFlowHandler;
import org.openmetadata.service.security.auth.SecurityConfigurationManager;

class McpCallbackServletTest {

  // ── existing test ────────────────────────────────────────────────────────

  @Test
  void bufferedResponseSendErrorSupportsExistingOutputStreamUsage() throws Exception {
    HttpServletResponse delegateResponse = mock(HttpServletResponse.class);
    ByteArrayOutputStream committedBody = new ByteArrayOutputStream();

    when(delegateResponse.getOutputStream())
        .thenReturn(new CapturingServletOutputStream(committedBody));

    HttpServletResponse bufferedResponse = newBufferedResponse(delegateResponse);
    bufferedResponse.getOutputStream().write("prefix:".getBytes(StandardCharsets.UTF_8));

    assertDoesNotThrow(
        () -> bufferedResponse.sendError(HttpServletResponse.SC_BAD_REQUEST, "invalid-request"));

    commitTo(bufferedResponse, delegateResponse);

    verify(delegateResponse).setStatus(HttpServletResponse.SC_BAD_REQUEST);
    assertThat(committedBody.toString(StandardCharsets.UTF_8)).isEqualTo("prefix:invalid-request");
  }

  // ── doGet: a callback must carry state ───────────────────────────────────

  @Test
  void doGet_idTokenWithoutState_returns400AndIssuesNoCode() throws Exception {
    UserSSOOAuthProvider provider = mock(UserSSOOAuthProvider.class);
    McpPendingAuthRequestRepository pendingRepo = mock(McpPendingAuthRequestRepository.class);
    AuthenticationCodeFlowHandler[] holder = new AuthenticationCodeFlowHandler[1];
    McpCallbackServlet servlet = makeServletWithCapturedHandler(provider, pendingRepo, holder);
    HttpServletRequest request = mockCallbackRequest(null, null, null);
    when(request.getParameter("id_token")).thenReturn("header.payload.signature");
    HttpServletResponse response = mock(HttpServletResponse.class);

    servlet.doGet(request, response);

    verify(response)
        .sendError(HttpServletResponse.SC_BAD_REQUEST, McpCallbackServlet.ERR_MISSING_STATE);
    verify(provider, never()).handleSSOCallbackWithDbState(any(), any(), any(), any(), any());
    verify(holder[0], never()).handleCallback(any(), any());
  }

  @Test
  void getClaimsMapping_keepsClaimNamesThatContainAColon() throws Exception {
    // Without the colon-safe split, both entries are dropped and the username falls back to the
    // email prefix, which can name a different OpenMetadata user than the web login resolves.
    AuthenticationConfiguration authConfig =
        new AuthenticationConfiguration()
            .withJwtPrincipalClaimsMapping(List.of("username:custom:login", "email:custom:mail"));
    Map<String, Object> claims =
        Map.of(
            "custom:login", "employee42",
            "custom:mail", "employee42@corp.example",
            "email", "jdoe@example.com");

    try (MockedStatic<SecurityConfigurationManager> scm =
        mockStatic(SecurityConfigurationManager.class)) {
      scm.when(SecurityConfigurationManager::getCurrentAuthConfig).thenReturn(authConfig);
      Map<String, String> mapping = invokeGetClaimsMapping(makeServlet());

      assertThat(findUserNameFromClaims(mapping, List.of("email"), claims)).isEqualTo("employee42");
      assertThat(findEmailFromClaims(mapping, List.of("email"), claims, ""))
          .isEqualTo("employee42@corp.example");
    }
  }

  // ── helpers ──────────────────────────────────────────────────────────────

  private static McpCallbackServlet makeServlet() {
    return new McpCallbackServlet(
        mock(UserSSOOAuthProvider.class), mock(McpPendingAuthRequestRepository.class));
  }

  @SuppressWarnings("unchecked")
  private static Map<String, String> invokeGetClaimsMapping(McpCallbackServlet servlet)
      throws Exception {
    Method m = McpCallbackServlet.class.getDeclaredMethod("getClaimsMapping");
    m.setAccessible(true);
    return (Map<String, String>) m.invoke(servlet);
  }

  private static HttpServletResponse newBufferedResponse(HttpServletResponse response)
      throws Exception {
    Class<?> wrapperClass =
        Class.forName(
            "org.openmetadata.mcp.server.auth.handlers.McpCallbackServlet$BufferedServletResponseWrapper");
    Constructor<?> constructor = wrapperClass.getDeclaredConstructor(HttpServletResponse.class);
    constructor.setAccessible(true);
    return (HttpServletResponse) constructor.newInstance(response);
  }

  private static void commitTo(HttpServletResponse bufferedResponse, HttpServletResponse response)
      throws Exception {
    Method method =
        bufferedResponse.getClass().getDeclaredMethod("commitTo", HttpServletResponse.class);
    method.setAccessible(true);
    method.invoke(bufferedResponse, response);
  }

  private static final class CapturingServletOutputStream extends ServletOutputStream {
    private final ByteArrayOutputStream outputStream;

    private CapturingServletOutputStream(ByteArrayOutputStream outputStream) {
      this.outputStream = outputStream;
    }

    @Override
    public void write(int b) {
      outputStream.write(b);
    }

    @Override
    public boolean isReady() {
      return true;
    }

    @Override
    public void setWriteListener(WriteListener writeListener) {}
  }

  /**
   * Builds a servlet wired with the given provider + pending repo, whose resolveSsoHandler()
   * returns a captured mock so we can assert handleCallback is/isn't invoked.
   */
  private static McpCallbackServlet makeServletWithCapturedHandler(
      UserSSOOAuthProvider provider,
      McpPendingAuthRequestRepository pendingRepo,
      AuthenticationCodeFlowHandler[] holder) {
    return new McpCallbackServlet(provider, pendingRepo) {
      @Override
      protected AuthenticationCodeFlowHandler resolveSsoHandler() {
        AuthenticationCodeFlowHandler ssoHandler = mock(AuthenticationCodeFlowHandler.class);
        holder[0] = ssoHandler;
        return ssoHandler;
      }
    };
  }

  private static HttpServletRequest mockCallbackRequest(
      String pac4jState, String error, String errorDescription) {
    HttpServletRequest request = mock(HttpServletRequest.class);
    when(request.getParameter("state")).thenReturn(pac4jState);
    if (error != null) {
      when(request.getParameter("error")).thenReturn(error);
    }
    if (errorDescription != null) {
      when(request.getParameter("error_description")).thenReturn(errorDescription);
    }
    return request;
  }
}
