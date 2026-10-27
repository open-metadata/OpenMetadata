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

/**
 * Unit tests for {@link UserSSOOAuthProvider#handleSSOErrorCallback}, which relays an upstream
 * IdP OAuth error callback back to the MCP client's redirect_uri, and for the consent step between
 * {@link UserSSOOAuthProvider#handleSSOCallbackWithDbState} and the authorization code.
 *
 * <p>The provider's public constructor builds its repositories via {@code Entity.getCollectionDAO()}
 * (requires a live DB), so tests allocate the instance with {@code sun.misc.Unsafe} (bypassing the
 * constructor) and inject mock repositories via reflection — the same pattern used by {@code
 * AuthenticationCodeFlowHandlerTest}.
 */
class UserSSOOAuthProviderTest {

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

  @Test
  void handleSSOErrorCallback_buildsErrorRedirectWithAllParams() throws Exception {
    McpPendingAuthRequestRepository pendingRepo = mock(McpPendingAuthRequestRepository.class);
    OAuthClientRepository clientRepo = mock(OAuthClientRepository.class);
    when(pendingRepo.findByAuthRequestId(AUTH_REQUEST_ID)).thenReturn(samplePendingRequest());
    stubRegisteredClient(clientRepo);

    UserSSOOAuthProvider provider = newProvider(pendingRepo, clientRepo, ISSUER);
    HttpServletResponse response = mock(HttpServletResponse.class);
    StringWriter body = captureHtmlResponse(response);

    provider.handleSSOErrorCallback(
        response, AUTH_REQUEST_ID, "login_required", "User not logged in");

    String html = body.toString();
    // The MCP client's redirect_uri is the target of the auto-redirect.
    assertThat(html).contains(MCP_REDIRECT_URI);
    // OAuth error response parameters per RFC 6749 §4.1.2.1. The free-text description is
    // deliberately not relayed; only the canonical error code is.
    assertThat(html).contains("error=login_required");
    assertThat(html).doesNotContain("error_description");
    // The MCP client's original state is echoed back.
    assertThat(html).contains("state=" + MCP_STATE);
    // RFC 9207 issuer parameter.
    assertThat(html)
        .contains(
            "iss=" + java.net.URLEncoder.encode(ISSUER, java.nio.charset.StandardCharsets.UTF_8));
    // User-facing error messaging is generic: the page must not render the IdP-supplied strings
    // as markup, only carry them in the redirect query.
    assertThat(html).contains("Authentication Failed");
    assertThat(html).contains("The identity provider could not complete authentication.");
    // Status + content type for an HTML page.
    verify(response).setStatus(HttpServletResponse.SC_OK);
    verify(response).setContentType("text/html; charset=UTF-8");
  }

  @Test
  void handleSSOErrorCallback_deletesPendingRequestAfterRelay() throws Exception {
    McpPendingAuthRequestRepository pendingRepo = mock(McpPendingAuthRequestRepository.class);
    OAuthClientRepository clientRepo = mock(OAuthClientRepository.class);
    when(pendingRepo.findByAuthRequestId(AUTH_REQUEST_ID)).thenReturn(samplePendingRequest());
    stubRegisteredClient(clientRepo);

    UserSSOOAuthProvider provider = newProvider(pendingRepo, clientRepo, ISSUER);
    HttpServletResponse response = mock(HttpServletResponse.class);
    captureHtmlResponse(response);

    provider.handleSSOErrorCallback(
        response, AUTH_REQUEST_ID, "access_denied", "User denied consent");

    // The pending MCP auth request is cleaned up so it can't be replayed.
    verify(pendingRepo).delete(AUTH_REQUEST_ID);
  }

  @Test
  void handleSSOErrorCallback_rejectsUnregisteredRedirectUri() throws Exception {
    McpPendingAuthRequestRepository pendingRepo = mock(McpPendingAuthRequestRepository.class);
    OAuthClientRepository clientRepo = mock(OAuthClientRepository.class);
    when(pendingRepo.findByAuthRequestId(AUTH_REQUEST_ID)).thenReturn(samplePendingRequest());
    OAuthClientInformation client = mock(OAuthClientInformation.class);
    when(client.getClientId()).thenReturn(CLIENT_ID);
    // The client no longer has this redirect URI registered (changed between authorize and
    // callback).
    when(client.validateRedirectUri(URI.create(MCP_REDIRECT_URI)))
        .thenThrow(new org.openmetadata.mcp.auth.InvalidRedirectUriException("not registered"));
    when(clientRepo.findByClientId(CLIENT_ID)).thenReturn(client);

    UserSSOOAuthProvider provider = newProvider(pendingRepo, clientRepo, ISSUER);
    HttpServletResponse response = mock(HttpServletResponse.class);

    assertThrows(
        IllegalStateException.class,
        () -> provider.handleSSOErrorCallback(response, AUTH_REQUEST_ID, "login_required", null));

    // Nothing is written to the response and the pending request is not cleaned up on failure.
    verify(response, org.mockito.Mockito.never()).getWriter();
    verify(pendingRepo, org.mockito.Mockito.never()).delete(AUTH_REQUEST_ID);
  }

  @Test
  void handleSSOErrorCallback_pendingRequestNotFound_throws() throws Exception {
    McpPendingAuthRequestRepository pendingRepo = mock(McpPendingAuthRequestRepository.class);
    OAuthClientRepository clientRepo = mock(OAuthClientRepository.class);
    when(pendingRepo.findByAuthRequestId("missing")).thenReturn(null);

    UserSSOOAuthProvider provider = newProvider(pendingRepo, clientRepo, ISSUER);
    HttpServletResponse response = mock(HttpServletResponse.class);

    assertThrows(
        IllegalStateException.class,
        () -> provider.handleSSOErrorCallback(response, "missing", "login_required", null));
  }

  @Test
  void handleSSOErrorCallback_clientNotFound_throws() throws Exception {
    McpPendingAuthRequestRepository pendingRepo = mock(McpPendingAuthRequestRepository.class);
    OAuthClientRepository clientRepo = mock(OAuthClientRepository.class);
    when(pendingRepo.findByAuthRequestId(AUTH_REQUEST_ID)).thenReturn(samplePendingRequest());
    when(clientRepo.findByClientId(CLIENT_ID)).thenReturn(null);

    UserSSOOAuthProvider provider = newProvider(pendingRepo, clientRepo, ISSUER);
    HttpServletResponse response = mock(HttpServletResponse.class);

    assertThrows(
        IllegalStateException.class,
        () -> provider.handleSSOErrorCallback(response, AUTH_REQUEST_ID, "login_required", null));
  }

  @Test
  void handleSSOErrorCallback_nullErrorCode_throws() throws Exception {
    UserSSOOAuthProvider provider =
        newProvider(
            mock(McpPendingAuthRequestRepository.class), mock(OAuthClientRepository.class), ISSUER);
    HttpServletResponse response = mock(HttpServletResponse.class);

    assertThrows(
        IllegalStateException.class,
        () -> provider.handleSSOErrorCallback(response, AUTH_REQUEST_ID, null, null));
  }

  @Test
  void handleSSOErrorCallback_emptyErrorCode_throws() throws Exception {
    UserSSOOAuthProvider provider =
        newProvider(
            mock(McpPendingAuthRequestRepository.class), mock(OAuthClientRepository.class), ISSUER);
    HttpServletResponse response = mock(HttpServletResponse.class);

    assertThrows(
        IllegalStateException.class,
        () -> provider.handleSSOErrorCallback(response, AUTH_REQUEST_ID, "  ", null));
  }

  @Test
  void handleSSOErrorCallback_doesNotRenderIdpSuppliedText() throws Exception {
    // error_description is attacker-influenceable free text from an external IdP. It is never
    // written into OpenMetadata's markup, not even HTML-escaped, and never relayed to the client.
    McpPendingAuthRequestRepository pendingRepo = mock(McpPendingAuthRequestRepository.class);
    OAuthClientRepository clientRepo = mock(OAuthClientRepository.class);
    when(pendingRepo.findByAuthRequestId(AUTH_REQUEST_ID)).thenReturn(samplePendingRequest());
    stubRegisteredClient(clientRepo);

    UserSSOOAuthProvider provider = newProvider(pendingRepo, clientRepo, ISSUER);
    HttpServletResponse response = mock(HttpServletResponse.class);
    StringWriter body = captureHtmlResponse(response);

    String malicious = "\"><script>alert(1)</script>";
    provider.handleSSOErrorCallback(response, AUTH_REQUEST_ID, "server_error", malicious);

    String html = body.toString();
    // The payload appears nowhere: not rendered, not escaped, and not percent-encoded inside the
    // redirect URL either, because the description is never relayed.
    assertThat(html).doesNotContain("<script>alert(1)</script>");
    assertThat(html).doesNotContain("lt;script");
    assertThat(html).doesNotContain("alert(1)");
    assertThat(html).doesNotContain("%3Cscript%3E");
    assertThat(html).doesNotContain("error_description");
  }

  @Test
  void handleSSOErrorCallback_unknownIdpErrorCode_relayedAsServerError() throws Exception {
    // An IdP is free to invent error codes. Relaying one verbatim would put an arbitrary upstream
    // string into a redirect this server issues, so unknown codes collapse to the spec's
    // server_error bucket.
    McpPendingAuthRequestRepository pendingRepo = mock(McpPendingAuthRequestRepository.class);
    OAuthClientRepository clientRepo = mock(OAuthClientRepository.class);
    when(pendingRepo.findByAuthRequestId(AUTH_REQUEST_ID)).thenReturn(samplePendingRequest());
    stubRegisteredClient(clientRepo);

    UserSSOOAuthProvider provider = newProvider(pendingRepo, clientRepo, ISSUER);
    HttpServletResponse response = mock(HttpServletResponse.class);
    StringWriter body = captureHtmlResponse(response);

    provider.handleSSOErrorCallback(response, AUTH_REQUEST_ID, "vendor_weird_code", null);

    String html = body.toString();
    assertThat(html).contains("error=server_error");
    assertThat(html).doesNotContain("vendor_weird_code");
  }

  @Test
  void handleSSOErrorCallback_knownIdpErrorCode_relayedVerbatim() throws Exception {
    // Codes in the RFC 6749 / OIDC Core set must survive intact, otherwise the client cannot tell
    // a denied consent from an upstream outage.
    McpPendingAuthRequestRepository pendingRepo = mock(McpPendingAuthRequestRepository.class);
    OAuthClientRepository clientRepo = mock(OAuthClientRepository.class);
    when(pendingRepo.findByAuthRequestId(AUTH_REQUEST_ID)).thenReturn(samplePendingRequest());
    stubRegisteredClient(clientRepo);

    UserSSOOAuthProvider provider = newProvider(pendingRepo, clientRepo, ISSUER);
    HttpServletResponse response = mock(HttpServletResponse.class);
    StringWriter body = captureHtmlResponse(response);

    provider.handleSSOErrorCallback(response, AUTH_REQUEST_ID, "access_denied", null);

    assertThat(body.toString()).contains("error=access_denied");
  }

  @Test
  void handleSSOErrorCallback_nullMcpState_omitsStateParam() throws Exception {
    // Some MCP clients do not send a state parameter; the relay must not add state= to the
    // error response in that case (it would otherwise send "state=null").
    McpPendingAuthRequest pending =
        new McpPendingAuthRequest(
            AUTH_REQUEST_ID,
            CLIENT_ID,
            "codeChallenge-123456789012345678901234567890123456789012",
            "S256",
            MCP_REDIRECT_URI,
            null,
            List.of("openid"),
            "pac4j-state-abc",
            null,
            null,
            System.currentTimeMillis() + 600_000L);
    McpPendingAuthRequestRepository pendingRepo = mock(McpPendingAuthRequestRepository.class);
    OAuthClientRepository clientRepo = mock(OAuthClientRepository.class);
    when(pendingRepo.findByAuthRequestId(AUTH_REQUEST_ID)).thenReturn(pending);
    stubRegisteredClient(clientRepo);

    UserSSOOAuthProvider provider = newProvider(pendingRepo, clientRepo, ISSUER);
    HttpServletResponse response = mock(HttpServletResponse.class);
    StringWriter body = captureHtmlResponse(response);

    provider.handleSSOErrorCallback(response, AUTH_REQUEST_ID, "login_required", null);

    String html = body.toString();
    assertThat(html).contains("error=login_required");
    assertThat(html).doesNotContain("state=null");
    assertThat(html).doesNotContain("&state=");
  }

  @Test
  void handleSSOErrorCallback_nullIssuer_omitsIssParam() throws Exception {
    // If the issuer was never resolved (transport didn't set it), iss must be omitted rather
    // than sending "iss=null".
    McpPendingAuthRequestRepository pendingRepo = mock(McpPendingAuthRequestRepository.class);
    OAuthClientRepository clientRepo = mock(OAuthClientRepository.class);
    when(pendingRepo.findByAuthRequestId(AUTH_REQUEST_ID)).thenReturn(samplePendingRequest());
    stubRegisteredClient(clientRepo);

    UserSSOOAuthProvider provider = newProvider(pendingRepo, clientRepo, null);
    HttpServletResponse response = mock(HttpServletResponse.class);
    StringWriter body = captureHtmlResponse(response);

    provider.handleSSOErrorCallback(response, AUTH_REQUEST_ID, "login_required", null);

    String html = body.toString();
    assertThat(html).contains("error=login_required");
    assertThat(html).doesNotContain("iss=null");
    assertThat(html).doesNotContain("&iss=");
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
