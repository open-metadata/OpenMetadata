package org.openmetadata.mcp.server.auth.handlers;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
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
import java.io.PrintWriter;
import java.io.StringWriter;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
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
import org.openmetadata.service.jdbi3.oauth.OAuthRecords.McpPendingAuthRequest;
import org.openmetadata.service.security.AuthenticationException;
import org.openmetadata.service.security.auth.AuthenticatorHandler;
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

  // Mirrors of the private session-attribute keys used by the servlet.
  private static final String SESSION_CSRF_TOKEN = "mcp.login.csrf";
  private static final String SESSION_AUTH_REQUEST_ID = "mcp.login.auth_request_id";

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
    when(session.getAttribute(SESSION_CSRF_TOKEN)).thenReturn(CSRF_TOKEN);
    when(session.getAttribute(SESSION_AUTH_REQUEST_ID)).thenReturn(AUTH_REQUEST_ID);
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
    // The catch block records the failed attempt exactly once.
    verify(authenticator).recordFailedLoginAttempt(EMAIL, EMAIL);
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
}
