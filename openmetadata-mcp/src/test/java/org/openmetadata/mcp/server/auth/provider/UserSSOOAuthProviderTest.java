package org.openmetadata.mcp.server.auth.provider;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.servlet.http.HttpServletResponse;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.lang.reflect.Field;
import java.net.URI;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.mcp.auth.OAuthClientInformation;
import org.openmetadata.mcp.server.auth.repository.McpPendingAuthRequestRepository;
import org.openmetadata.mcp.server.auth.repository.OAuthClientRepository;
import org.openmetadata.service.jdbi3.oauth.OAuthRecords.McpPendingAuthRequest;

/**
 * Unit tests for {@link UserSSOOAuthProvider#handleSSOErrorCallback}, which relays an upstream
 * IdP OAuth error callback back to the MCP client's redirect_uri.
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
    // OAuth error response parameters per RFC 6749 §4.1.2.1.
    assertThat(html).contains("error=login_required");
    assertThat(html).contains("error_description=User+not+logged+in");
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
    // The error/error_description come from an external IdP and are attacker-influenceable, so
    // they are never written into OpenMetadata's own markup - not even HTML-escaped. They still
    // reach the MCP client percent-encoded in the redirect query, which is where it reads them.
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
    // Neither the raw payload nor any escaped rendering of it appears in the page body.
    assertThat(html).doesNotContain("<script>alert(1)</script>");
    assertThat(html).doesNotContain("lt;script");
    assertThat(html).doesNotContain("alert(1)");
    // But it is relayed to the client, percent-encoded, so diagnosis is not lost.
    assertThat(html).contains("error_description=%22%3E%3Cscript%3Ealert%281%29%3C%2Fscript%3E");
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
