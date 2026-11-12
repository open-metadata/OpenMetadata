package org.openmetadata.mcp.server.auth.provider;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.lang.reflect.Field;
import java.net.URI;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import org.openmetadata.mcp.auth.OAuthClientInformation;
import org.openmetadata.mcp.server.auth.repository.McpPendingAuthRequestRepository;
import org.openmetadata.mcp.server.auth.repository.OAuthAuthorizationCodeRepository;
import org.openmetadata.mcp.server.auth.repository.OAuthClientRepository;
import org.openmetadata.schema.api.configuration.MCPConfiguration;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.oauth.OAuthRecords.McpPendingAuthRequest;
import org.openmetadata.service.security.auth.SecurityConfigurationManager;

/** SSO authentication must wait for client consent before issuing an authorization code. */
class UserSSOConsentTest {

  private static final String ISSUER = "https://om.test";
  private static final String MCP_REDIRECT_URI = "https://mcp-client.example.com/callback";
  private static final String MCP_STATE = "mcp-client-state-xyz";
  private static final String AUTH_REQUEST_ID = "auth-req-1";
  private static final String CLIENT_ID = "client-1";

  private static McpPendingAuthRequest samplePendingRequest() {
    return new McpPendingAuthRequest(
        AUTH_REQUEST_ID,
        CLIENT_ID,
        "codeChallenge-123456789012345678901234567890123456789012",
        "S256",
        MCP_REDIRECT_URI,
        MCP_STATE,
        List.of("openid", "profile"),
        "pac4j-state-abc",
        "pac4j-nonce",
        "pac4j-verifier",
        System.currentTimeMillis() + 600_000L);
  }

  private static OAuthClientInformation registeredClient() throws Exception {
    OAuthClientInformation client = mock(OAuthClientInformation.class);
    when(client.getClientId()).thenReturn(CLIENT_ID);
    // Accept the registered redirect URI.
    when(client.validateRedirectUri(URI.create(MCP_REDIRECT_URI)))
        .thenReturn(URI.create(MCP_REDIRECT_URI));
    return client;
  }

  /**
   * Creates a registered client mock and stubs the client repository to return it. Done in one
   * step to avoid nesting {@code when()} stubbing (the inner stubbing inside registeredClient()
   * would otherwise leave the outer {@code when(clientRepo.findByClientId(...))} unfinished).
   */
  private static void stubRegisteredClient(OAuthClientRepository clientRepo) throws Exception {
    OAuthClientInformation client = registeredClient();
    when(clientRepo.findByClientId(CLIENT_ID)).thenReturn(client);
  }

  /** Allocates a UserSSOOAuthProvider without running its constructor and injects mock repos. */
  private static UserSSOOAuthProvider newProvider(
      McpPendingAuthRequestRepository pendingRepo, OAuthClientRepository clientRepo, String issuer)
      throws Exception {
    sun.misc.Unsafe unsafe = getUnsafe();
    UserSSOOAuthProvider provider =
        (UserSSOOAuthProvider) unsafe.allocateInstance(UserSSOOAuthProvider.class);
    setField(provider, "pendingAuthRepository", pendingRepo);
    setField(provider, "clientRepository", clientRepo);
    setField(provider, "issuer", issuer);
    return provider;
  }

  private static StringWriter captureHtmlResponse(HttpServletResponse response) throws Exception {
    StringWriter captured = new StringWriter();
    when(response.getWriter()).thenReturn(new PrintWriter(captured));
    return captured;
  }

  // ── consent: an SSO sign-in alone must not hand a code to the MCP client ─────────

  private static final String USER_NAME = "alice";
  private static final String CONSENT_TOKEN = "consent-token";
  private static final String MCP_BASE_URL = "https://om.example/data-catalog/";

  /** Runs the SSO callback for {@link #USER_NAME} with the user lookup stubbed to succeed. */
  private static void runSsoCallback(
      UserSSOOAuthProvider provider, HttpServletRequest request, HttpServletResponse response)
      throws Exception {
    try (MockedStatic<Entity> entity = mockStatic(Entity.class);
        MockedStatic<SecurityConfigurationManager> config =
            mockStatic(SecurityConfigurationManager.class)) {
      entity
          .when(() -> Entity.getEntityByName(Entity.USER, USER_NAME, "", Include.NON_DELETED))
          .thenReturn(new User().withName(USER_NAME));
      config
          .when(SecurityConfigurationManager::getCurrentMcpConfig)
          .thenReturn(new MCPConfiguration().withBaseUrl(MCP_BASE_URL));
      provider.handleSSOCallbackWithDbState(
          request, response, USER_NAME, "alice@corp.example", "mcp:" + AUTH_REQUEST_ID);
    }
  }

  /** The POST of the consent page for {@link #AUTH_REQUEST_ID}. */
  private static HttpServletRequest consentRequest(String submittedToken, String decision) {
    HttpServletRequest request = mock(HttpServletRequest.class);
    when(request.getParameter(UserSSOOAuthProvider.AUTH_REQUEST_ID_PARAM))
        .thenReturn(AUTH_REQUEST_ID);
    when(request.getParameter(UserSSOOAuthProvider.CONSENT_TOKEN_PARAM)).thenReturn(submittedToken);
    when(request.getParameter(UserSSOOAuthProvider.CONSENT_DECISION_PARAM)).thenReturn(decision);
    return request;
  }

  /** A client repository where {@link #CLIENT_ID} is registered. */
  private static OAuthClientRepository clientRepositoryWithRegisteredClient() throws Exception {
    OAuthClientRepository clientRepo = mock(OAuthClientRepository.class);
    stubRegisteredClient(clientRepo);
    return clientRepo;
  }

  /** A pending-request repository holding {@link #CONSENT_TOKEN} for {@link #USER_NAME}. */
  private static McpPendingAuthRequestRepository repositoryAwaitingConsent() {
    McpPendingAuthRequestRepository pendingRepo = mock(McpPendingAuthRequestRepository.class);
    when(pendingRepo.findByAuthRequestId(AUTH_REQUEST_ID)).thenReturn(samplePendingRequest());
    when(pendingRepo.takeConsent(AUTH_REQUEST_ID, CONSENT_TOKEN)).thenReturn(USER_NAME);
    return pendingRepo;
  }

  @Test
  void handleSSOCallbackWithDbState_servesConsentPageInsteadOfIssuingCode() throws Exception {
    // Userinfo can make a URL look like another host, and java.net.URI has no host for a name
    // with an underscore that a browser still navigates to.
    String redirectUri = "https://om.test@client_site.example:8443/om.test";
    McpPendingAuthRequestRepository pendingRepo = mock(McpPendingAuthRequestRepository.class);
    OAuthClientRepository clientRepo = mock(OAuthClientRepository.class);
    OAuthAuthorizationCodeRepository codeRepo = mock(OAuthAuthorizationCodeRepository.class);
    when(pendingRepo.findByAuthRequestId(AUTH_REQUEST_ID))
        .thenReturn(
            new McpPendingAuthRequest(
                AUTH_REQUEST_ID,
                CLIENT_ID,
                "codeChallenge-123456789012345678901234567890123456789012",
                "S256",
                redirectUri,
                MCP_STATE,
                List.of("openid", "profile"),
                null,
                null,
                null,
                System.currentTimeMillis() + 600_000L));
    OAuthClientInformation client = mock(OAuthClientInformation.class);
    when(client.getClientName()).thenReturn("Some <b>client</b>");
    when(clientRepo.findByClientId(CLIENT_ID)).thenReturn(client);
    when(pendingRepo.storeConsent(eq(AUTH_REQUEST_ID), anyString(), eq(USER_NAME)))
        .thenReturn(true);

    UserSSOOAuthProvider provider = newProvider(pendingRepo, clientRepo, ISSUER);
    setField(provider, "codeRepository", codeRepo);
    HttpServletRequest request = mock(HttpServletRequest.class);
    HttpServletResponse response = mock(HttpServletResponse.class);
    StringWriter body = captureHtmlResponse(response);

    runSsoCallback(provider, request, response);

    // Nothing is issued and the request stays pending, with the consent on its row, until the
    // user decides.
    verifyNoInteractions(codeRepo);
    verify(pendingRepo, never()).delete(anyString());
    ArgumentCaptor<String> token = ArgumentCaptor.forClass(String.class);
    verify(pendingRepo).storeConsent(eq(AUTH_REQUEST_ID), token.capture(), eq(USER_NAME));

    // The page waits for a click: it names the client, the user and the real destination host,
    // and nothing on it moves the browser by itself.
    String html = body.toString();
    assertThat(html).doesNotContain("code=").doesNotContain("http-equiv").doesNotContain("<script");
    // Posts to the MCP base URL, which carries BASE_PATH, like the /mcp/login form.
    assertThat(html)
        .contains(
            "action=\"https://om.example/data-catalog/mcp/consent?auth_request_id="
                + AUTH_REQUEST_ID
                + "\"");
    assertThat(html).contains("value=\"" + token.getValue() + "\"");
    assertThat(html).contains("Some &lt;b&gt;client&lt;/b&gt;");
    assertThat(html).contains("<strong>" + USER_NAME + "</strong>");
    assertThat(html)
        .contains("<strong>https://client_site.example:8443</strong>")
        .doesNotContain("om.test");
    verify(response).setHeader("X-Frame-Options", "DENY");
  }

  @Test
  void handleConsentDecision_approve_issuesCodeForTheAuthenticatedUser() throws Exception {
    McpPendingAuthRequestRepository pendingRepo = repositoryAwaitingConsent();
    OAuthAuthorizationCodeRepository codeRepo = mock(OAuthAuthorizationCodeRepository.class);
    McpPendingAuthRequest pending = samplePendingRequest();

    UserSSOOAuthProvider provider =
        newProvider(pendingRepo, clientRepositoryWithRegisteredClient(), ISSUER);
    setField(provider, "codeRepository", codeRepo);
    HttpServletResponse response = mock(HttpServletResponse.class);
    StringWriter body = captureHtmlResponse(response);

    provider.handleConsentDecision(
        consentRequest(CONSENT_TOKEN, UserSSOOAuthProvider.CONSENT_APPROVE), response);

    ArgumentCaptor<String> code = ArgumentCaptor.forClass(String.class);
    verify(codeRepo)
        .store(
            code.capture(),
            eq(CLIENT_ID),
            eq(USER_NAME),
            eq(pending.codeChallenge()),
            eq("S256"),
            eq(URI.create(MCP_REDIRECT_URI)),
            eq(pending.scopes()),
            anyLong());
    assertThat(body.toString())
        .contains(MCP_REDIRECT_URI + "?")
        .contains("code=" + code.getValue())
        .contains("state=" + MCP_STATE);
    verify(pendingRepo).delete(AUTH_REQUEST_ID);
  }

  @Test
  void handleConsentDecision_deny_relaysAccessDenied() throws Exception {
    McpPendingAuthRequestRepository pendingRepo = repositoryAwaitingConsent();
    OAuthAuthorizationCodeRepository codeRepo = mock(OAuthAuthorizationCodeRepository.class);

    UserSSOOAuthProvider provider =
        newProvider(pendingRepo, clientRepositoryWithRegisteredClient(), ISSUER);
    setField(provider, "codeRepository", codeRepo);
    HttpServletResponse response = mock(HttpServletResponse.class);
    StringWriter body = captureHtmlResponse(response);

    provider.handleConsentDecision(consentRequest(CONSENT_TOKEN, "deny"), response);

    verifyNoInteractions(codeRepo);
    assertThat(body.toString())
        .contains("error=access_denied")
        .contains("state=" + MCP_STATE)
        .doesNotContain("code=");
    verify(pendingRepo).delete(AUTH_REQUEST_ID);
  }

  @Test
  void handleConsentDecision_withoutTheTokenOfTheRenderedPage_isRejected() throws Exception {
    OAuthAuthorizationCodeRepository codeRepo = mock(OAuthAuthorizationCodeRepository.class);
    McpPendingAuthRequestRepository pendingRepo = repositoryAwaitingConsent();
    UserSSOOAuthProvider provider =
        newProvider(pendingRepo, mock(OAuthClientRepository.class), ISSUER);
    setField(provider, "codeRepository", codeRepo);

    for (String submittedToken : new String[] {null, "", "guess"}) {
      HttpServletResponse response = mock(HttpServletResponse.class);

      provider.handleConsentDecision(
          consentRequest(submittedToken, UserSSOOAuthProvider.CONSENT_APPROVE), response);

      verify(response).sendError(eq(HttpServletResponse.SC_FORBIDDEN), anyString());
    }
    verifyNoInteractions(codeRepo);
    verify(pendingRepo, never()).delete(anyString());
  }

  @Test
  void handleSSOCallbackWithDbState_secondSignInForTheSameRequest_isRefused() throws Exception {
    McpPendingAuthRequestRepository pendingRepo = mock(McpPendingAuthRequestRepository.class);
    when(pendingRepo.findByAuthRequestId(AUTH_REQUEST_ID)).thenReturn(samplePendingRequest());
    when(pendingRepo.storeConsent(eq(AUTH_REQUEST_ID), anyString(), eq(USER_NAME)))
        .thenReturn(false);
    UserSSOOAuthProvider provider =
        newProvider(pendingRepo, clientRepositoryWithRegisteredClient(), ISSUER);
    HttpServletResponse response = mock(HttpServletResponse.class);
    StringWriter body = captureHtmlResponse(response);

    runSsoCallback(provider, mock(HttpServletRequest.class), response);

    verify(response).sendError(eq(HttpServletResponse.SC_BAD_REQUEST), anyString());
    assertThat(body.toString()).doesNotContain("<form");
  }

  @Test
  void handleConsentDecision_clientRemovedBeforeApproval_issuesNoCode() throws Exception {
    OAuthAuthorizationCodeRepository codeRepo = mock(OAuthAuthorizationCodeRepository.class);
    UserSSOOAuthProvider provider =
        newProvider(repositoryAwaitingConsent(), mock(OAuthClientRepository.class), ISSUER);
    setField(provider, "codeRepository", codeRepo);

    assertThrows(
        IllegalStateException.class,
        () ->
            provider.handleConsentDecision(
                consentRequest(CONSENT_TOKEN, UserSSOOAuthProvider.CONSENT_APPROVE),
                mock(HttpServletResponse.class)));
    verifyNoInteractions(codeRepo);
  }

  // ── reflection helpers (mirror AuthenticationCodeFlowHandlerTest) ─────────

  private static sun.misc.Unsafe getUnsafe() throws Exception {
    Field unsafeField = sun.misc.Unsafe.class.getDeclaredField("theUnsafe");
    unsafeField.setAccessible(true);
    return (sun.misc.Unsafe) unsafeField.get(null);
  }

  private static void setField(Object target, String fieldName, Object value) throws Exception {
    Field field = target.getClass().getDeclaredField(fieldName);
    field.setAccessible(true);
    field.set(target, value);
  }
}
