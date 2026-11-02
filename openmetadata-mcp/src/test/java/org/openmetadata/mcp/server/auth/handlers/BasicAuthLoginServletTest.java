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
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.service.exception.CustomExceptionMessage;
import org.openmetadata.service.jdbi3.oauth.OAuthRecords.McpPendingAuthRequest;
import org.openmetadata.service.security.AuthenticationException;
import org.openmetadata.service.security.auth.AuthenticatorHandler;
import org.openmetadata.service.security.auth.LdapAuthenticator;
import org.openmetadata.service.security.auth.LoginAttemptCache;
import org.openmetadata.service.security.auth.NoopAuthenticator;
import org.openmetadata.service.security.auth.SecurityConfigurationManager;

/** {@link BasicAuthLoginServlet} checks passwords with the authenticator registered right now. */
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

  private MockedConstruction<McpPendingAuthRequestRepository> pendingRepoConstruction;
  private MockedConstruction<OAuthClientRepository> clientRepoConstruction;
  private StringWriter responseBody;
  private BasicAuthLoginServlet servlet;
  private AuthenticatorHandler registeredBefore;

  @BeforeEach
  void setUp() throws Exception {
    // Repositories are constructed inside the servlet constructor; mock those constructions so
    // their real constructors (which call Entity.getCollectionDAO()) never run.
    pendingRepoConstruction = mockConstruction(McpPendingAuthRequestRepository.class);
    clientRepoConstruction = mockConstruction(OAuthClientRepository.class);
    servlet = new BasicAuthLoginServlet(authProvider);
    registeredBefore = SecurityConfigurationManager.getInstance().getAuthenticatorHandler();
    SecurityConfigurationManager.getInstance().setAuthenticatorHandler(authenticator);
    McpPendingAuthRequestRepository pendingRepo = pendingRepoConstruction.constructed().get(0);
    OAuthClientRepository clientRepo = clientRepoConstruction.constructed().get(0);

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
  }

  @AfterEach
  void tearDown() {
    SecurityConfigurationManager.getInstance().setAuthenticatorHandler(registeredBefore);
    clientRepoConstruction.close();
    pendingRepoConstruction.close();
  }

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

    servlet.doPost(request, response);

    verify(response).setStatus(HttpServletResponse.SC_OK);
    verify(response, never()).sendError(anyInt(), anyString());
    assertThat(responseBody.toString()).contains("Invalid username or password");
    // Relative, so the form posts back to <BASE_PATH>mcp/login under a non-root BASE_PATH
    assertThat(responseBody.toString()).contains("action=\"login\"");
    // validatePassword counts the failed attempt; counting it again would halve the lockout limit.
    verify(authenticator, never()).recordFailedLoginAttempt(anyString(), anyString());
  }

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
  void doPost_afterSwitchToLdap_passwordIsCheckedByTheDirectory() throws Exception {
    // A login before a runtime switch to LDAP uses the authenticator registered then; the next
    // login must be decided by the directory bind, not by the earlier authenticator.
    sessionAttributes();
    User user = mock(User.class);
    when(user.getName()).thenReturn("user");
    when(authenticator.lookUserInProvider(EMAIL, PASSWORD)).thenReturn(user);
    doThrow(new AuthenticationException("invalid username or password"))
        .when(authenticator)
        .validatePassword(any(String.class), any(String.class), any(User.class));
    servlet.doPost(request, response);

    LdapAuthenticator ldap = mock(LdapAuthenticator.class);
    doThrow(
            new CustomExceptionMessage(
                Response.Status.UNAUTHORIZED,
                "INVALID_USER_OR_PASSWORD",
                "You have entered an invalid username or password."))
        .when(ldap)
        .lookUserInProvider(EMAIL, PASSWORD);
    SecurityConfigurationManager.getInstance().setAuthenticatorHandler(ldap);
    when(request.getParameter("csrf_token")).thenReturn(csrfTokenOf(responseBody.toString()));
    servlet.doPost(request, response);

    verify(ldap).lookUserInProvider(EMAIL, PASSWORD);
    verify(authenticator).lookUserInProvider(EMAIL, PASSWORD);
    verify(authProvider, never()).createAuthorizationCode(any(), any(), any(), any(), any());
  }

  @Test
  void doPost_ldapLogin_isDecidedByTheDirectoryBindAlone() throws Exception {
    // LDAP checks the password in its bind; a second check would treat the email as a DN.
    LdapAuthenticator ldap = mock(LdapAuthenticator.class);
    User user = mock(User.class);
    when(user.getName()).thenReturn("user");
    when(ldap.lookUserInProvider(EMAIL, PASSWORD)).thenReturn(user);
    when(authProvider.createAuthorizationCode(eq("user"), any(), any(), any(), any()))
        .thenReturn("code-for-user");
    SecurityConfigurationManager.getInstance().setAuthenticatorHandler(ldap);

    try (MockedStatic<LoginAttemptCache> attempts = mockStatic(LoginAttemptCache.class)) {
      attempts.when(LoginAttemptCache::getInstance).thenReturn(mock(LoginAttemptCache.class));
      servlet.doPost(request, response);
    }

    ArgumentCaptor<String> redirect = ArgumentCaptor.forClass(String.class);
    verify(response).sendRedirect(redirect.capture());
    assertThat(redirect.getValue()).contains("code=code-for-user");
    verify(ldap, never()).validatePassword(anyString(), anyString(), any(User.class));
  }

  @Test
  void doPost_providerWithoutPasswords_refusesLogin() throws Exception {
    // SAML and OIDC register a NoopAuthenticator: a password kept from before the move to SSO
    // must not sign anyone in.
    SecurityConfigurationManager.getInstance().setAuthenticatorHandler(new NoopAuthenticator());

    servlet.doPost(request, response);

    verify(response).sendError(HttpServletResponse.SC_FORBIDDEN, "Password login is not enabled");
    verify(authProvider, never()).createAuthorizationCode(any(), any(), any(), any(), any());
  }

  /** Backs the session with a map so the token a re-rendered form issues is the one checked. */
  private void sessionAttributes() {
    Map<String, Object> attributes = new HashMap<>();
    attributes.put(SESSION_CSRF_TOKEN, CSRF_TOKEN);
    attributes.put(SESSION_AUTH_REQUEST_ID, AUTH_REQUEST_ID);
    when(session.getAttribute(anyString()))
        .thenAnswer(call -> attributes.get(call.<String>getArgument(0)));
    doAnswer(call -> attributes.put(call.getArgument(0), call.getArgument(1)))
        .when(session)
        .setAttribute(anyString(), any());
    doAnswer(call -> attributes.remove(call.<String>getArgument(0)))
        .when(session)
        .removeAttribute(anyString());
  }

  private static String csrfTokenOf(String html) {
    Matcher token = Pattern.compile("name=\"csrf_token\" value=\"([^\"]+)\"").matcher(html);
    assertThat(token.find()).as("csrf_token field in %s", html).isTrue();
    return token.group(1);
  }
}
