package org.openmetadata.mcp.server.auth.handlers;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockConstruction;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import jakarta.ws.rs.core.Response;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.MockedConstruction;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.openmetadata.mcp.server.auth.provider.UserSSOOAuthProvider;
import org.openmetadata.mcp.server.auth.repository.McpPendingAuthRequestRepository;
import org.openmetadata.mcp.server.auth.repository.OAuthClientRepository;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;
import org.openmetadata.service.exception.CustomExceptionMessage;
import org.openmetadata.service.jdbi3.oauth.OAuthRecords.McpPendingAuthRequest;
import org.openmetadata.service.security.AuthenticationException;
import org.openmetadata.service.security.auth.AuthenticatorHandler;
import org.openmetadata.service.security.auth.LoginAttemptCache;
import org.openmetadata.service.security.auth.SecurityConfigurationManager;

/**
 * Tests for {@link BasicAuthLoginServlet}.
 *
 * <p>The servlet re-renders the login form with a friendly inline error when the wired
 * {@link AuthenticatorHandler} throws the security-package {@link AuthenticationException} for
 * the login-blocked and Basic-wrong-password (existing user) cases. These cases previously fell
 * through to the generic 500 handler because the servlet imported the unrelated
 * {@code org.openmetadata.service.exception.AuthenticationException} (a JAX-RS subtype) and so its
 * {@code catch} clauses never matched the type the authenticators actually throw. These tests pin
 * the import to the security-package type and guard against that regression.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class BasicAuthLoginServletTest {

  // Mirror of the private session-attribute key used by the servlet.
  private static final String SESSION_LOGIN_FORM = "mcp.login.form";

  private static final String CSRF_TOKEN = "csrf-token-abc";
  private static final String AUTH_REQUEST_ID = "auth-req-123";
  private static final String EMAIL = "user@example.com";
  private static final String PASSWORD = "p@ssw0rd";
  private static final String CLIENT_ID = "client-1";

  @Mock private UserSSOOAuthProvider authProvider;
  @Mock private AuthenticatorHandler authenticator;
  @Mock private HttpServletRequest request;
  @Mock private HttpServletResponse response;
  @Mock private HttpSession session;
  @Mock private AuthenticationConfiguration authConfig;

  private MockedConstruction<McpPendingAuthRequestRepository> pendingRepoConstruction;
  private MockedConstruction<OAuthClientRepository> clientRepoConstruction;
  private McpPendingAuthRequestRepository pendingRepo;
  private OAuthClientRepository clientRepo;
  private StringWriter responseBody;
  private BasicAuthLoginServlet servlet;

  @BeforeEach
  void setUp() throws Exception {
    // Repositories are constructed inside the servlet constructor; mock those constructions so
    // their real constructors (which call Entity.getCollectionDAO()) never run.
    pendingRepoConstruction = mockConstruction(McpPendingAuthRequestRepository.class);
    clientRepoConstruction = mockConstruction(OAuthClientRepository.class);
    servlet = new BasicAuthLoginServlet(authProvider, authenticator);
    pendingRepo = pendingRepoConstruction.constructed().get(0);
    clientRepo = clientRepoConstruction.constructed().get(0);

    McpPendingAuthRequest pending =
        new McpPendingAuthRequest(
            AUTH_REQUEST_ID,
            CLIENT_ID,
            "code-challenge",
            "S256",
            "https://client.example.com/callback",
            "state-123",
            List.of("openid"),
            null,
            null,
            null,
            System.currentTimeMillis() + 600_000L);
    when(pendingRepo.findByAuthRequestId(AUTH_REQUEST_ID)).thenReturn(pending);
    when(clientRepo.findByClientId(anyString())).thenReturn(null);

    // Common request / session / CSRF stubs shared by every doPost scenario.
    when(request.getSession(false)).thenReturn(session);
    when(request.getSession(true)).thenReturn(session);
    when(session.getAttribute(SESSION_LOGIN_FORM))
        .thenReturn(new BasicAuthLoginServlet.LoginForm(CSRF_TOKEN, AUTH_REQUEST_ID));
    when(request.getParameter("csrf_token")).thenReturn(CSRF_TOKEN);
    when(request.getParameter("username")).thenReturn(EMAIL);
    when(request.getParameter("password")).thenReturn(PASSWORD);

    // Capture the re-rendered login form body.
    responseBody = new StringWriter();
    when(response.getWriter()).thenReturn(new PrintWriter(responseBody));

    // Default to a non-LDAP provider so validatePassword is invoked by the servlet.
    when(authConfig.getProvider()).thenReturn(AuthProvider.BASIC);
  }

  @AfterEach
  void tearDown() {
    clientRepoConstruction.close();
    pendingRepoConstruction.close();
  }

  // ── login-blocked (Basic and LDAP) ───────────────────────────────────────

  @Test
  void doPost_loginBlocked_rendersLoginFormWithLoginBlockedMessage() throws Exception {
    // The wired authenticators throw the security-package AuthenticationException from
    // checkIfLoginBlocked for both Basic and LDAP providers; the servlet must catch it and
    // re-render the form instead of returning HTTP 500.
    doThrow(new AuthenticationException("account locked"))
        .when(authenticator)
        .checkIfLoginBlocked(EMAIL);

    servlet.doPost(request, response);

    verify(response).setStatus(HttpServletResponse.SC_OK);
    verify(response, never()).sendError(anyInt(), anyString());
    assertThat(responseBody.toString()).contains("Login blocked");
    // Authentication stops at the lock check.
    verify(authenticator, never()).lookUserInProvider(anyString(), anyString());
    verify(authenticator, never()).recordFailedLoginAttempt(anyString(), anyString());
  }

  // ── Basic wrong password (existing user) ─────────────────────────────────

  @Test
  void doPost_basicWrongPassword_rendersLoginFormWithInvalidCredentialsMessage() throws Exception {
    User user = mock(User.class);
    when(user.getName()).thenReturn("user");
    when(authenticator.lookUserInProvider(EMAIL, PASSWORD)).thenReturn(user);
    // BasicAuthenticator.validatePassword throws the security-package AuthenticationException
    // after recording the failed attempt; the servlet must catch it and re-render the form.
    doThrow(new AuthenticationException("invalid username or password"))
        .when(authenticator)
        .validatePassword(any(String.class), any(String.class), any(User.class));

    try (MockedStatic<SecurityConfigurationManager> scm =
        mockStatic(SecurityConfigurationManager.class)) {
      scm.when(SecurityConfigurationManager::getCurrentAuthConfig).thenReturn(authConfig);

      servlet.doPost(request, response);
    }

    verify(response).setStatus(HttpServletResponse.SC_OK);
    verify(response, never()).sendError(anyInt(), anyString());
    assertThat(responseBody.toString()).contains("Invalid username or password");
    // Relative, so the form posts back to <BASE_PATH>mcp/login under a non-root BASE_PATH
    assertThat(responseBody.toString()).contains("action=\"login\"");
    // The catch block records the failed attempt exactly once.
    verify(authenticator).recordFailedLoginAttempt(EMAIL, EMAIL);
  }

  // ── the re-rendered form stays bound to its auth request ─────────────────

  @Test
  void doPost_otherAuthRequestOpenedWhilePasswordIsChecked_retryCompletesItsOwnRequest()
      throws Exception {
    // Another tab can GET /mcp/login?auth_request_id=<its own> while a POST is in flight. The form
    // shown after the failed login must still complete the request it names, not the other one.
    Map<String, Object> attributes = sessionAttributes();
    HttpServletRequest otherTab = loginPageRequest("other-auth-req", "other-client");
    HttpServletResponse otherTabResponse = mock(HttpServletResponse.class);
    when(otherTabResponse.getWriter()).thenReturn(new PrintWriter(new StringWriter()));
    User user = mock(User.class);
    when(user.getName()).thenReturn("user");
    when(authenticator.lookUserInProvider(EMAIL, PASSWORD)).thenReturn(user);
    when(authProvider.createAuthorizationCode(eq("user"), any(), any(), any(), any()))
        .thenAnswer(call -> "code-for-" + call.getArgument(0));
    doAnswer(
            whilePasswordIsChecked -> {
              servlet.doGet(otherTab, otherTabResponse);
              throw new AuthenticationException("invalid username or password");
            })
        .doNothing()
        .when(authenticator)
        .validatePassword(any(String.class), any(String.class), any(User.class));

    try (MockedStatic<SecurityConfigurationManager> scm =
            mockStatic(SecurityConfigurationManager.class);
        MockedStatic<LoginAttemptCache> attempts = mockStatic(LoginAttemptCache.class)) {
      scm.when(SecurityConfigurationManager::getCurrentAuthConfig).thenReturn(authConfig);
      attempts.when(LoginAttemptCache::getInstance).thenReturn(mock(LoginAttemptCache.class));

      servlet.doPost(request, response);
      when(request.getParameter("csrf_token")).thenReturn(csrfTokenOf(responseBody.toString()));
      servlet.doPost(request, response);
    }

    ArgumentCaptor<String> redirect = ArgumentCaptor.forClass(String.class);
    verify(response).sendRedirect(redirect.capture());
    assertThat(redirect.getValue())
        .startsWith("https://client.example.com/callback?")
        .contains("code=code-for-user", "state=state-123");
    assertThat(attributes).doesNotContainKey(SESSION_LOGIN_FORM);
  }

  @Test
  void doPost_withoutTokenAfterARefusedSubmit_isRejectedBeforeAuthentication() throws Exception {
    // A refused submit consumes the form, so a following submit with no token at all has nothing
    // to match and no auth request left to complete.
    sessionAttributes();
    when(request.getParameter("csrf_token")).thenReturn("not-the-token");
    servlet.doPost(request, response);
    when(request.getParameter("csrf_token")).thenReturn(null);

    servlet.doPost(request, response);

    verify(response).sendError(eq(HttpServletResponse.SC_FORBIDDEN), anyString());
    verify(response).sendError(eq(HttpServletResponse.SC_BAD_REQUEST), anyString());
    verify(authenticator, never()).lookUserInProvider(anyString(), anyString());
  }

  /** Backs the session mock with a map holding the form the user was shown. */
  private Map<String, Object> sessionAttributes() {
    Map<String, Object> attributes = new HashMap<>();
    attributes.put(
        SESSION_LOGIN_FORM, new BasicAuthLoginServlet.LoginForm(CSRF_TOKEN, AUTH_REQUEST_ID));
    when(session.getAttribute(anyString()))
        .thenAnswer(call -> attributes.get(call.<String>getArgument(0)));
    doAnswer(call -> attributes.put(call.getArgument(0), call.getArgument(1)))
        .when(session)
        .setAttribute(anyString(), any());
    doAnswer(call -> attributes.remove(call.<String>getArgument(0)))
        .when(session)
        .removeAttribute(anyString());
    return attributes;
  }

  private HttpServletRequest loginPageRequest(String authRequestId, String clientId) {
    when(pendingRepo.findByAuthRequestId(authRequestId))
        .thenReturn(
            new McpPendingAuthRequest(
                authRequestId,
                clientId,
                "other-code-challenge",
                "S256",
                "https://other.example.com/callback",
                null,
                List.of("openid"),
                null,
                null,
                null,
                System.currentTimeMillis() + 600_000L));
    HttpServletRequest pageRequest = mock(HttpServletRequest.class);
    when(pageRequest.getParameter("auth_request_id")).thenReturn(authRequestId);
    when(pageRequest.getSession(true)).thenReturn(session);
    return pageRequest;
  }

  private static String csrfTokenOf(String html) {
    Matcher token = Pattern.compile("name=\"csrf_token\" value=\"([^\"]+)\"").matcher(html);
    assertThat(token.find()).as("csrf_token field in %s", html).isTrue();
    return token.group(1);
  }

  // ── type-specificity guard for the import fix ────────────────────────────

  @Test
  void doPost_exceptionPackageAuthenticationException_isNotCaughtAsInlineLoginError()
      throws Exception {
    // The servlet must catch ONLY the security-package AuthenticationException (the type the
    // wired authenticators throw). The unrelated JAX-RS exception-package AuthenticationException
    // (org.openmetadata.service.exception.AuthenticationException) must fall through to the
    // generic 500 handler. This pins the import to the security package: with the wrong import
    // (the exception-package type), this branch would wrongly render "Login blocked" and the test
    // would fail.
    org.openmetadata.service.exception.AuthenticationException wrongType =
        new org.openmetadata.service.exception.AuthenticationException("wrong type");
    doThrow(wrongType).when(authenticator).checkIfLoginBlocked(EMAIL);

    servlet.doPost(request, response);

    verify(response)
        .sendError(HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Login processing failed");
    verify(response, never()).setStatus(HttpServletResponse.SC_OK);
    assertThat(responseBody.toString()).doesNotContain("Login blocked");
  }

  // ── unknown account (CustomExceptionMessage) ─────────────────────────────

  @Test
  void doPost_unknownAccount_rendersLoginFormWithInvalidCredentialsMessage() throws Exception {
    // Neither authenticator throws AuthenticationException for an account that does not exist:
    // both report it as CustomExceptionMessage(INVALID_USER_OR_PASSWORD). That is a rejected
    // credential, so it must re-render the form rather than reach the generic 500 handler (which
    // would log the whole thing as an ERROR with a stack trace).
    doThrow(
            new CustomExceptionMessage(
                Response.Status.BAD_REQUEST,
                "INVALID_USER_OR_PASSWORD",
                "You have entered an invalid username or password."))
        .when(authenticator)
        .lookUserInProvider(EMAIL, PASSWORD);

    servlet.doPost(request, response);

    verify(response).setStatus(HttpServletResponse.SC_OK);
    verify(response, never()).sendError(anyInt(), anyString());
    assertThat(responseBody.toString()).contains("Invalid username or password");
  }

  @Test
  void doPost_ldapDirectoryUnavailable_fallsThroughToGenericFailure() throws Exception {
    // LDAP reuses CustomExceptionMessage for an unreachable directory. That is a real fault, not a
    // rejected credential: it must keep reaching the generic handler so it is still logged.
    doThrow(
            new CustomExceptionMessage(
                Response.Status.SERVICE_UNAVAILABLE,
                "LDAP_CONNECTION_ERROR",
                "Unable to connect to authentication server after 3 attempts."))
        .when(authenticator)
        .lookUserInProvider(EMAIL, PASSWORD);

    servlet.doPost(request, response);

    verify(response)
        .sendError(HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Login processing failed");
    verify(response, never()).setStatus(HttpServletResponse.SC_OK);
    assertThat(responseBody.toString()).doesNotContain("Invalid username or password");
  }
}
