package org.openmetadata.mcp.server.auth.handlers;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.RETURNS_DEEP_STUBS;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.openmetadata.service.security.SecurityUtil.findEmailFromClaims;
import static org.openmetadata.service.security.SecurityUtil.findUserNameFromClaims;

import com.nimbusds.jwt.JWTClaimsSet;
import jakarta.servlet.ServletOutputStream;
import jakarta.servlet.WriteListener;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.io.ByteArrayOutputStream;
import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.mcp.server.auth.provider.UserSSOOAuthProvider;
import org.openmetadata.mcp.server.auth.repository.McpPendingAuthRequestRepository;
import org.openmetadata.mcp.server.auth.validators.IdTokenValidator;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.service.jdbi3.oauth.OAuthRecords.McpPendingAuthRequest;
import org.openmetadata.service.security.AuthenticationCodeFlowHandler;
import org.openmetadata.service.security.auth.SecurityConfigurationManager;
import org.pac4j.oidc.credentials.OidcCredentials;

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

  // ── doGet: IdP error callback is relayed to the MCP client ────────────────

  /** A pending MCP request fixture with an MCP client redirect_uri and original client state. */
  private static McpPendingAuthRequest samplePendingRequest() {
    return new McpPendingAuthRequest(
        "auth-req-1",
        "client-1",
        "codeChallenge-123456789012345678901234567890123456789012",
        "S256",
        "https://mcp-client.example.com/callback",
        "mcp-client-state-xyz",
        List.of("openid", "profile"),
        "pac4j-state-abc",
        "pac4j-nonce",
        "v".repeat(43),
        System.currentTimeMillis() + 600_000L);
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

  @Test
  void doGet_idpErrorCallback_loginRequired_relaysErrorToMcpClient() throws Exception {
    // Silent-auth error (prompt=none, no IdP session) must reach the MCP client as an OAuth
    // error redirect rather than being swallowed into an opaque 500.
    UserSSOOAuthProvider provider = mock(UserSSOOAuthProvider.class);
    McpPendingAuthRequestRepository pendingRepo = mock(McpPendingAuthRequestRepository.class);
    when(pendingRepo.findByPac4jState("pac4j-state-abc")).thenReturn(samplePendingRequest());
    AuthenticationCodeFlowHandler[] holder = new AuthenticationCodeFlowHandler[1];
    McpCallbackServlet servlet = makeServletWithCapturedHandler(provider, pendingRepo, holder);

    HttpServletRequest request =
        mockCallbackRequest("pac4j-state-abc", "login_required", "The user is not logged in.");
    HttpServletResponse response = mock(HttpServletResponse.class);

    servlet.doGet(request, response);

    verify(provider)
        .handleSSOErrorCallback(
            any(), eq("auth-req-1"), eq("login_required"), eq("The user is not logged in."));
    verify(holder[0], never()).handleCallback(any(), any());
  }

  @Test
  void doGet_idpErrorCallback_accessDenied_relaysErrorToMcpClient() throws Exception {
    // Non-silent error (user clicked "Deny" at IdP consent) must also be relayed.
    UserSSOOAuthProvider provider = mock(UserSSOOAuthProvider.class);
    McpPendingAuthRequestRepository pendingRepo = mock(McpPendingAuthRequestRepository.class);
    when(pendingRepo.findByPac4jState("pac4j-state-abc")).thenReturn(samplePendingRequest());
    AuthenticationCodeFlowHandler[] holder = new AuthenticationCodeFlowHandler[1];
    McpCallbackServlet servlet = makeServletWithCapturedHandler(provider, pendingRepo, holder);

    HttpServletRequest request =
        mockCallbackRequest("pac4j-state-abc", "access_denied", "The user denied the request.");
    HttpServletResponse response = mock(HttpServletResponse.class);

    servlet.doGet(request, response);

    verify(provider)
        .handleSSOErrorCallback(
            any(), eq("auth-req-1"), eq("access_denied"), eq("The user denied the request."));
    verify(holder[0], never()).handleCallback(any(), any());
  }

  @Test
  void doGet_idpErrorCallback_nullErrorDescription_passesNull() throws Exception {
    UserSSOOAuthProvider provider = mock(UserSSOOAuthProvider.class);
    McpPendingAuthRequestRepository pendingRepo = mock(McpPendingAuthRequestRepository.class);
    when(pendingRepo.findByPac4jState("pac4j-state-abc")).thenReturn(samplePendingRequest());
    AuthenticationCodeFlowHandler[] holder = new AuthenticationCodeFlowHandler[1];
    McpCallbackServlet servlet = makeServletWithCapturedHandler(provider, pendingRepo, holder);

    HttpServletRequest request = mockCallbackRequest("pac4j-state-abc", "server_error", null);
    HttpServletResponse response = mock(HttpServletResponse.class);

    servlet.doGet(request, response);

    verify(provider).handleSSOErrorCallback(any(), eq("auth-req-1"), eq("server_error"), eq(null));
    verify(holder[0], never()).handleCallback(any(), any());
  }

  @Test
  void doGet_idpErrorCallback_emptyErrorParam_doesNotRelayError() throws Exception {
    // An empty error param is not a valid OAuth error response; do not short-circuit the
    // error relay (the malformed callback falls through to handleCallback). Critically, the
    // provider error method must not be invoked with an empty error code.
    UserSSOOAuthProvider provider = mock(UserSSOOAuthProvider.class);
    McpPendingAuthRequestRepository pendingRepo = mock(McpPendingAuthRequestRepository.class);
    when(pendingRepo.findByPac4jState("pac4j-state-abc")).thenReturn(samplePendingRequest());
    AuthenticationCodeFlowHandler[] holder = new AuthenticationCodeFlowHandler[1];
    McpCallbackServlet servlet = makeServletWithCapturedHandler(provider, pendingRepo, holder);

    HttpServletRequest request = mockCallbackRequest("pac4j-state-abc", "", null);
    HttpServletResponse response = mock(HttpServletResponse.class);

    // Empty error => falls through; the downstream handleCallback path throws because no
    // credentials are returned, landing in the 500 catch. Either way the error relay is skipped.
    servlet.doGet(request, response);

    verify(provider, never()).handleSSOErrorCallback(any(), any(), any(), any());
  }

  @Test
  void doGet_idpErrorCallback_pendingRequestNotFound_returns400AndDoesNotRelay() throws Exception {
    // Without a pending request we cannot recover the MCP client redirect_uri/state, so the
    // error cannot be relayed; preserve the existing 400 (state not found) behavior and never
    // invoke the provider error method.
    UserSSOOAuthProvider provider = mock(UserSSOOAuthProvider.class);
    McpPendingAuthRequestRepository pendingRepo = mock(McpPendingAuthRequestRepository.class);
    when(pendingRepo.findByPac4jState("unknown-state")).thenReturn(null);
    AuthenticationCodeFlowHandler[] holder = new AuthenticationCodeFlowHandler[1];
    McpCallbackServlet servlet = makeServletWithCapturedHandler(provider, pendingRepo, holder);

    HttpServletRequest request = mockCallbackRequest("unknown-state", "login_required", null);
    HttpServletResponse response = mock(HttpServletResponse.class);

    servlet.doGet(request, response);

    verify(response)
        .sendError(HttpServletResponse.SC_BAD_REQUEST, McpCallbackServlet.ERR_STATE_NOT_FOUND);
    verify(provider, never()).handleSSOErrorCallback(any(), any(), any(), any());
  }

  @Test
  void doGet_callbackWithoutLogin_ignoresCredentialsLeftInSession() throws Exception {
    // With no pending login in this browser, handleCallback only redirects to /signin and checks no
    // code. ID token credentials an earlier MCP login left in the session must not be used.
    UserSSOOAuthProvider provider = mock(UserSSOOAuthProvider.class);
    McpPendingAuthRequestRepository pendingRepo = mock(McpPendingAuthRequestRepository.class);
    when(pendingRepo.findByPac4jState("pac4j-state-abc")).thenReturn(samplePendingRequest());
    AuthenticationCodeFlowHandler ssoHandler =
        mock(AuthenticationCodeFlowHandler.class, RETURNS_DEEP_STUBS);
    doAnswer(
            call -> {
              call.<HttpServletResponse>getArgument(1).sendRedirect("/signin");
              return null;
            })
        .when(ssoHandler)
        .handleCallback(any(), any());
    McpCallbackServlet servlet = makeServletWithHandler(provider, pendingRepo, ssoHandler);
    IdTokenValidator validator = mock(IdTokenValidator.class);
    when(validator.validateAndDecode("earlier.id.token"))
        .thenReturn(new JWTClaimsSet.Builder().claim("email", "alice@example.com").build());
    setField(servlet, "idTokenValidator", validator);
    setField(servlet, "validatorBuiltFrom", ssoHandler);

    OidcCredentials earlierLogin = mock(OidcCredentials.class);
    when(earlierLogin.getIdToken()).thenReturn("earlier.id.token");
    HttpSession session = mock(HttpSession.class);
    when(session.getAttribute(AuthenticationCodeFlowHandler.OIDC_CREDENTIAL_PROFILE))
        .thenReturn(earlierLogin);
    HttpServletRequest request = mockCallbackRequest("pac4j-state-abc", null, null);
    when(request.getSession(true)).thenReturn(session);
    HttpServletResponse response = mock(HttpServletResponse.class);

    servlet.doGet(request, response);

    verify(ssoHandler).handleCallback(eq(request), any());
    verify(response).setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
    verify(provider, never()).handleSSOCallbackWithDbState(any(), any(), any(), any(), any());
  }

  @Test
  void doGet_completedLogin_usesTheCredentialsThisCallbackValidated() throws Exception {
    UserSSOOAuthProvider provider = mock(UserSSOOAuthProvider.class);
    McpPendingAuthRequestRepository pendingRepo = mock(McpPendingAuthRequestRepository.class);
    when(pendingRepo.findByPac4jState("pac4j-state-abc")).thenReturn(samplePendingRequest());
    HttpServletRequest request = mockCallbackRequest("pac4j-state-abc", null, null);
    when(request.getSession(true)).thenReturn(mock(HttpSession.class));
    Map<String, Object> attributes = new HashMap<>();
    doAnswer(call -> attributes.put(call.getArgument(0), call.getArgument(1)))
        .when(request)
        .setAttribute(anyString(), any());
    when(request.getAttribute(anyString()))
        .thenAnswer(call -> attributes.get(call.<String>getArgument(0)));
    OidcCredentials thisLogin = mock(OidcCredentials.class);
    when(thisLogin.getIdToken()).thenReturn("this.id.token");
    AuthenticationCodeFlowHandler ssoHandler =
        mock(AuthenticationCodeFlowHandler.class, RETURNS_DEEP_STUBS);
    doAnswer(
            call -> {
              call.<HttpServletRequest>getArgument(0)
                  .setAttribute(AuthenticationCodeFlowHandler.OIDC_CREDENTIAL_PROFILE, thisLogin);
              call.<HttpServletResponse>getArgument(1).sendRedirect("https://om.test/mcp/callback");
              return null;
            })
        .when(ssoHandler)
        .handleCallback(any(), any());
    McpCallbackServlet servlet = makeServletWithHandler(provider, pendingRepo, ssoHandler);
    IdTokenValidator validator = mock(IdTokenValidator.class);
    when(validator.validateAndDecode("this.id.token"))
        .thenReturn(new JWTClaimsSet.Builder().claim("email", "alice@example.com").build());
    setField(servlet, "idTokenValidator", validator);
    setField(servlet, "validatorBuiltFrom", ssoHandler);

    servlet.doGet(request, mock(HttpServletResponse.class));

    verify(provider)
        .handleSSOCallbackWithDbState(
            eq(request), any(), eq("alice"), eq("alice@example.com"), eq("mcp:auth-req-1"));
  }

  private static McpCallbackServlet makeServletWithHandler(
      UserSSOOAuthProvider provider,
      McpPendingAuthRequestRepository pendingRepo,
      AuthenticationCodeFlowHandler handler) {
    return new McpCallbackServlet(provider, pendingRepo) {
      @Override
      protected AuthenticationCodeFlowHandler resolveSsoHandler() {
        return handler;
      }
    };
  }

  private static void setField(Object target, String name, Object value) throws Exception {
    Field field = McpCallbackServlet.class.getDeclaredField(name);
    field.setAccessible(true);
    field.set(target, value);
  }

  @Test
  void doGet_noErrorParam_doesNotInvokeErrorRelay() throws Exception {
    // Regression guard: a success callback (no error param) must never trigger the error relay.
    UserSSOOAuthProvider provider = mock(UserSSOOAuthProvider.class);
    McpPendingAuthRequestRepository pendingRepo = mock(McpPendingAuthRequestRepository.class);
    when(pendingRepo.findByPac4jState("pac4j-state-abc")).thenReturn(samplePendingRequest());
    AuthenticationCodeFlowHandler[] holder = new AuthenticationCodeFlowHandler[1];
    McpCallbackServlet servlet = makeServletWithCapturedHandler(provider, pendingRepo, holder);

    HttpServletRequest request = mockCallbackRequest("pac4j-state-abc", null, null);
    HttpServletResponse response = mock(HttpServletResponse.class);

    servlet.doGet(request, response);

    verify(provider, never()).handleSSOErrorCallback(any(), any(), any(), any());
  }

  // ── BufferedServletResponseWrapper.sendRedirect records 302 ──────────────

  @Test
  void bufferedResponseSendRedirect_records302Status() throws Exception {
    HttpServletResponse delegate = mock(HttpServletResponse.class);
    HttpServletResponse buffered = newBufferedResponse(delegate);

    assertDoesNotThrow(() -> buffered.sendRedirect("https://om.test/signin"));

    assertEquals(HttpServletResponse.SC_FOUND, getStatusCode(buffered));
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

  private static int getStatusCode(HttpServletResponse bufferedResponse) throws Exception {
    Method method = bufferedResponse.getClass().getDeclaredMethod("getStatusCode");
    method.setAccessible(true);
    return (int) method.invoke(bufferedResponse);
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
}
