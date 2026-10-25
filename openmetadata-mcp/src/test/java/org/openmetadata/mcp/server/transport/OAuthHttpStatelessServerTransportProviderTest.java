package org.openmetadata.mcp.server.transport;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.net.URI;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import org.openmetadata.mcp.auth.OAuthClientInformation;
import org.openmetadata.mcp.server.auth.provider.UserSSOOAuthProvider;
import org.openmetadata.mcp.server.auth.repository.McpPendingAuthRequestRepository;
import org.openmetadata.mcp.server.auth.repository.OAuthAuthorizationCodeRepository;
import org.openmetadata.mcp.server.auth.repository.OAuthClientRepository;
import org.openmetadata.mcp.server.transport.OAuthHttpStatelessServerTransportProvider.AuthFailure;
import org.openmetadata.schema.api.configuration.MCPConfiguration;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.oauth.OAuthRecords.McpPendingAuthRequest;
import org.openmetadata.service.security.auth.SecurityConfigurationManager;

class OAuthHttpStatelessServerTransportProviderTest {

  private static final URI RESOURCE_METADATA =
      URI.create("https://example.com/mcp/.well-known/oauth-protected-resource");

  // ── consent route ─────────────────────────────────────────────────────────

  private static final String BASE_PATH = "/data-catalog";
  private static final String AUTH_REQUEST_ID = "auth-req-1";
  private static final String CLIENT_ID = "client-1";
  private static final String USER_NAME = "alice";
  private static final String CLIENT_REDIRECT = "https://client.example/callback";
  private static final Pattern FORM_ACTION =
      Pattern.compile("<form method=\"POST\" action=\"([^\"]*)\"");
  private static final Pattern FORM_FIELD =
      Pattern.compile(
          "<(?:input type=\"hidden\"|button type=\"submit\") name=\"([^\"]*)\" value=\"([^\"]*)\"");

  @Test
  void consentFormPostedThroughDoPostUnderBasePath_approveIssuesTheCode() throws Exception {
    ConsentRoundTrip roundTrip = new ConsentRoundTrip();

    String page = roundTrip.submitRenderedForm("approve");

    ArgumentCaptor<String> code = ArgumentCaptor.forClass(String.class);
    verify(roundTrip.codeRepo)
        .store(
            code.capture(),
            eq(CLIENT_ID),
            eq(USER_NAME),
            anyString(),
            anyString(),
            eq(URI.create(CLIENT_REDIRECT)),
            any(),
            anyLong());
    assertThat(page).contains(CLIENT_REDIRECT + "?").contains("code=" + code.getValue());
  }

  @Test
  void consentFormPostedThroughDoPostUnderBasePath_denyRelaysAccessDenied() throws Exception {
    ConsentRoundTrip roundTrip = new ConsentRoundTrip();

    String page = roundTrip.submitRenderedForm("deny");

    verifyNoInteractions(roundTrip.codeRepo);
    assertThat(page).contains("error=access_denied").doesNotContain("code=");
  }

  /**
   * Renders the consent page from the SSO callback, then posts what that page's form would send
   * through {@code doPost} under {@link #BASE_PATH}. The pending-request repository only claims a
   * consent for the token storeConsent received, so the token has to travel through the page.
   */
  private static final class ConsentRoundTrip {
    private final McpPendingAuthRequestRepository pendingRepo =
        mock(McpPendingAuthRequestRepository.class);
    private final OAuthAuthorizationCodeRepository codeRepo =
        mock(OAuthAuthorizationCodeRepository.class);
    private final AtomicReference<String> storedToken = new AtomicReference<>();

    ConsentRoundTrip() {
      when(pendingRepo.findByAuthRequestId(AUTH_REQUEST_ID)).thenReturn(pendingRequest());
      when(pendingRepo.storeConsent(eq(AUTH_REQUEST_ID), anyString(), eq(USER_NAME)))
          .thenAnswer(
              invocation -> {
                storedToken.set(invocation.getArgument(1));
                return true;
              });
      when(pendingRepo.takeConsent(eq(AUTH_REQUEST_ID), any()))
          .thenAnswer(
              invocation -> storedToken.get().equals(invocation.getArgument(1)) ? USER_NAME : null);
    }

    String submitRenderedForm(String decision) throws Exception {
      UserSSOOAuthProvider provider = provider();
      try (MockedStatic<Entity> entity = mockStatic(Entity.class);
          MockedStatic<SecurityConfigurationManager> config =
              mockStatic(SecurityConfigurationManager.class)) {
        entity
            .when(() -> Entity.getEntityByName(Entity.USER, USER_NAME, "", Include.NON_DELETED))
            .thenReturn(new User().withName(USER_NAME));
        config
            .when(SecurityConfigurationManager::getCurrentMcpConfig)
            .thenReturn(new MCPConfiguration().withBaseUrl("https://om.example" + BASE_PATH));
        String consentPage = renderConsentPage(provider);
        HttpServletResponse response = mock(HttpServletResponse.class);
        StringWriter body = new StringWriter();
        when(response.getWriter()).thenReturn(new PrintWriter(body));
        transportWith(provider).doPost(formPost(consentPage, decision), response);
        return body.toString();
      }
    }

    private String renderConsentPage(UserSSOOAuthProvider provider) throws Exception {
      HttpServletResponse response = mock(HttpServletResponse.class);
      StringWriter page = new StringWriter();
      when(response.getWriter()).thenReturn(new PrintWriter(page));
      provider.handleSSOCallbackWithDbState(
          mock(HttpServletRequest.class),
          response,
          USER_NAME,
          "alice@example.com",
          "mcp:" + AUTH_REQUEST_ID);
      return page.toString();
    }

    private UserSSOOAuthProvider provider() throws Exception {
      OAuthClientRepository clientRepo = mock(OAuthClientRepository.class);
      OAuthClientInformation client = mock(OAuthClientInformation.class);
      when(client.getClientId()).thenReturn(CLIENT_ID);
      when(clientRepo.findByClientId(CLIENT_ID)).thenReturn(client);
      UserSSOOAuthProvider provider =
          (UserSSOOAuthProvider) unsafe().allocateInstance(UserSSOOAuthProvider.class);
      setField(provider, "pendingAuthRepository", pendingRepo);
      setField(provider, "clientRepository", clientRepo);
      setField(provider, "codeRepository", codeRepo);
      setField(provider, "issuer", "https://om.example" + BASE_PATH + "/mcp");
      return provider;
    }
  }

  /** The POST a browser sends for the page's form when the user clicks {@code decision}. */
  private static HttpServletRequest formPost(String consentPage, String decision) {
    Matcher action = FORM_ACTION.matcher(consentPage);
    assertThat(action.find()).as("consent page has a form").isTrue();
    URI target = URI.create(action.group(1).replace("&amp;", "&"));
    Map<String, String> params = new HashMap<>();
    for (String pair : target.getRawQuery().split("&")) {
      String[] nameAndValue = pair.split("=", 2);
      params.put(nameAndValue[0], nameAndValue[1]);
    }
    Matcher field = FORM_FIELD.matcher(consentPage);
    boolean offersDecision = false;
    while (field.find()) {
      boolean isButton = field.group(0).contains("button");
      offersDecision |= isButton && field.group(2).equals(decision);
      if (!isButton || field.group(2).equals(decision)) {
        params.put(field.group(1), field.group(2));
      }
    }
    assertThat(offersDecision).as("consent page offers %s", decision).isTrue();
    HttpServletRequest request = mock(HttpServletRequest.class);
    when(request.getContextPath()).thenReturn(BASE_PATH);
    when(request.getRequestURI()).thenReturn(target.getRawPath());
    when(request.getParameter(anyString()))
        .thenAnswer(inv -> params.get(inv.<String>getArgument(0)));
    return request;
  }

  private static McpPendingAuthRequest pendingRequest() {
    return new McpPendingAuthRequest(
        AUTH_REQUEST_ID,
        CLIENT_ID,
        "codeChallenge-123456789012345678901234567890123456789012",
        "S256",
        CLIENT_REDIRECT,
        "client-state",
        List.of("openid"),
        null,
        null,
        null,
        System.currentTimeMillis() + 600_000L);
  }

  @Test
  void doPost_consentForAClientRemovedMeanwhile_answersBadRequest() throws Exception {
    UserSSOOAuthProvider ssoProvider = mock(UserSSOOAuthProvider.class);
    HttpServletRequest request = consentPost("");
    HttpServletResponse response = mock(HttpServletResponse.class);
    doThrow(new IllegalStateException("Client not found"))
        .when(ssoProvider)
        .handleConsentDecision(request, response);

    transportWith(ssoProvider).doPost(request, response);

    verify(response).sendError(eq(HttpServletResponse.SC_BAD_REQUEST), anyString());
  }

  private static HttpServletRequest consentPost(String contextPath) {
    HttpServletRequest request = mock(HttpServletRequest.class);
    when(request.getContextPath()).thenReturn(contextPath);
    when(request.getRequestURI()).thenReturn(contextPath + UserSSOOAuthProvider.CONSENT_PATH);
    return request;
  }

  /**
   * The constructor needs a running auth stack, so the transport is allocated without it and
   * given only the provider that doPost routes the consent POST to.
   */
  private static OAuthHttpStatelessServerTransportProvider transportWith(
      UserSSOOAuthProvider ssoProvider) throws Exception {
    sun.misc.Unsafe unsafe = unsafe();
    OAuthHttpStatelessServerTransportProvider transport =
        (OAuthHttpStatelessServerTransportProvider)
            unsafe.allocateInstance(OAuthHttpStatelessServerTransportProvider.class);
    Field authProvider =
        OAuthHttpStatelessServerTransportProvider.class.getDeclaredField("authProvider");
    unsafe.putObject(transport, unsafe.objectFieldOffset(authProvider), ssoProvider);
    return transport;
  }

  private static sun.misc.Unsafe unsafe() throws Exception {
    Field unsafeField = sun.misc.Unsafe.class.getDeclaredField("theUnsafe");
    unsafeField.setAccessible(true);
    return (sun.misc.Unsafe) unsafeField.get(null);
  }

  private static void setField(Object target, String fieldName, Object value) throws Exception {
    Field field = target.getClass().getDeclaredField(fieldName);
    field.setAccessible(true);
    field.set(target, value);
  }

  // ── sanitizeRedirectUrlForLogging ─────────────────────────────────────────

  @Test
  void sanitizeRedirectUrl_stripsQueryParams() throws Exception {
    String result = sanitize("http://127.0.0.1:9999/callback?error=server_error&state=abc");
    assertThat(result).isEqualTo("http://127.0.0.1:9999/callback?[params_redacted]");
  }

  @Test
  void sanitizeRedirectUrl_noQueryParam_returnsAsIs() throws Exception {
    String result = sanitize("http://127.0.0.1:9999/callback");
    assertThat(result).isEqualTo("http://127.0.0.1:9999/callback");
  }

  @Test
  void sanitizeRedirectUrl_null_returnsNullString() throws Exception {
    assertThat(sanitize(null)).isEqualTo("null");
  }

  // ── CORS ──────────────────────────────────────────────────────────────────

  @Test
  void applyCorsHeaders_allowedOrigin_emitsHeadersMcpClientsNeed() {
    HttpServletRequest request = mock(HttpServletRequest.class);
    HttpServletResponse response = mock(HttpServletResponse.class);
    when(request.getHeader("Origin")).thenReturn("https://app.example.com");

    OAuthHttpStatelessServerTransportProvider.applyCorsHeaders(
        request, response, List.of("https://app.example.com"));

    verify(response).setHeader("Access-Control-Allow-Origin", "https://app.example.com");
    // A browser MCP client sends these on its POST. If one is missing from the allowlist the
    // preflight fails and the client sees a network error instead of a protocol error.
    ArgumentCaptor<String> allowedHeaders = ArgumentCaptor.forClass(String.class);
    verify(response).setHeader(eq("Access-Control-Allow-Headers"), allowedHeaders.capture());
    assertThat(allowedHeaders.getValue())
        .contains("Content-Type")
        .contains("Authorization")
        .contains("Accept")
        .contains("MCP-Protocol-Version")
        .contains("Mcp-Method")
        .contains("Mcp-Name")
        .contains("Mcp-Client-Name")
        .contains("X-OpenMetadata-Persona");
    // Without this the browser hides the 401's challenge and the client cannot start OAuth.
    verify(response).setHeader("Access-Control-Expose-Headers", "WWW-Authenticate");
    verify(response).setHeader("Vary", "Origin");
  }

  @Test
  void applyCorsHeaders_disallowedOrigin_emitsNothing() {
    HttpServletRequest request = mock(HttpServletRequest.class);
    HttpServletResponse response = mock(HttpServletResponse.class);
    when(request.getHeader("Origin")).thenReturn("https://evil.example.com");

    OAuthHttpStatelessServerTransportProvider.applyCorsHeaders(
        request, response, List.of("https://app.example.com"));

    verifyNoInteractions(response);
  }

  // Note: that doPost() actually calls applyCorsHeaders before delegating the MCP message endpoint
  // to the base transport cannot be asserted at unit level - the constructor requires a full
  // running auth stack. Covered by integration tests.

  // Note: the committed-response guard in handleAuthorizeRequest() cannot be meaningfully
  // exercised at unit level because handleAuthorizeRequest is private and the class constructor
  // requires a full running auth stack. The guard is covered by integration tests.

  // ── bearer credential classification ─────────────────────────────────────

  @ParameterizedTest
  @ValueSource(strings = {"Bearer abc.def.ghi", "bearer abc.def.ghi", "BEARER abc.def.ghi"})
  void presentsBearerCredentials_bearerHeader_isTrue(String header) {
    // RFC 7235: the auth-scheme is case-insensitive.
    assertThat(OAuthHttpStatelessServerTransportProvider.presentsBearerCredentials(header))
        .isTrue();
  }

  @ParameterizedTest
  @ValueSource(strings = {"", "   ", "Bearer", "Bearer ", "Bearer    ", "Basic dXNlcjpwYXNz"})
  void presentsBearerCredentials_noBearerCredential_isFalse(String header) {
    assertThat(OAuthHttpStatelessServerTransportProvider.presentsBearerCredentials(header))
        .isFalse();
  }

  @Test
  void presentsBearerCredentials_nullHeader_isFalse() {
    assertThat(OAuthHttpStatelessServerTransportProvider.presentsBearerCredentials(null)).isFalse();
  }

  // ── 401/403 error responses ──────────────────────────────────────────────

  /**
   * Regression guard for the unauthenticated /mcp stack-trace leak. The 401 body used to be a
   * serialized McpError - a RuntimeException - and shipped 60 stack frames, our class/file/line
   * layout, the Jetty internals and the exact JRE build to anonymous callers.
   */
  @Test
  void writeAuthError_missingCredentials_bodyIsExactlyTheJsonRpcEnvelope() throws Exception {
    HttpServletResponse response = mock(HttpServletResponse.class);
    StringWriter body = new StringWriter();
    when(response.getWriter()).thenReturn(new PrintWriter(body));

    OAuthHttpStatelessServerTransportProvider.writeAuthError(
        response,
        AuthFailure.MISSING_CREDENTIALS,
        RESOURCE_METADATA,
        List.of("openid", "profile", "email"));

    assertThat(body.toString())
        .isEqualTo(
            "{\"jsonrpc\":\"2.0\",\"id\":null,"
                + "\"error\":{\"code\":-32001,\"message\":\"Missing bearer token\"}}");
  }

  @ParameterizedTest
  @EnumSource(AuthFailure.class)
  void writeAuthError_neverLeaksThrowableState(AuthFailure failure) throws Exception {
    assertThat(bodyOf(failure))
        .doesNotContain("stackTrace")
        .doesNotContain("cause")
        .doesNotContain("suppressed")
        .doesNotContain("localizedMessage")
        .doesNotContain("org.openmetadata")
        .doesNotContain("java.lang");
  }

  /** A caller that sent no credentials has no token to fix; saying so sends them on a goose chase. */
  @Test
  void writeAuthError_missingCredentialsAndInvalidToken_differInMessage() throws Exception {
    assertThat(bodyOf(AuthFailure.MISSING_CREDENTIALS))
        .isNotEqualTo(bodyOf(AuthFailure.INVALID_TOKEN));
    assertThat(bodyOf(AuthFailure.INVALID_TOKEN)).contains("Invalid or expired bearer token");
  }

  /** -32603 INTERNAL_ERROR claimed something broke on our side; an auth failure is not that. */
  @Test
  void writeAuthError_usesAuthCodeNotInternalError() throws Exception {
    assertThat(bodyOf(AuthFailure.INVALID_TOKEN))
        .contains("\"code\":-32001")
        .doesNotContain("-32603");
  }

  /** RFC 6750 section 3.1: error="invalid_token" belongs on a rejected token, and only there. */
  @Test
  void writeAuthError_invalidToken_challengeCarriesInvalidTokenError() {
    assertThat(challengeOf(AuthFailure.INVALID_TOKEN)).contains("error=\"invalid_token\"");
  }

  @Test
  void writeAuthError_missingCredentials_challengeCarriesNoErrorParameter() {
    assertThat(challengeOf(AuthFailure.MISSING_CREDENTIALS)).doesNotContain("error=");
  }

  /** The MCP spec requires resource_metadata so a client can discover where to start OAuth. */
  @Test
  void writeAuthError_challengeKeepsResourceMetadataAndScope() {
    assertThat(challengeOf(AuthFailure.INVALID_TOKEN))
        .startsWith("Bearer ")
        .contains(
            "resource_metadata=\"https://example.com/mcp/.well-known/oauth-protected-resource\"")
        .contains("scope=\"openid profile email\"");
  }

  @Test
  void writeAuthError_emitsTheChallengeAsWwwAuthenticate() throws Exception {
    HttpServletResponse response = mock(HttpServletResponse.class);
    when(response.getWriter()).thenReturn(new PrintWriter(new StringWriter()));

    OAuthHttpStatelessServerTransportProvider.writeAuthError(
        response, AuthFailure.INVALID_TOKEN, RESOURCE_METADATA, List.of("openid"));

    ArgumentCaptor<String> challenge = ArgumentCaptor.forClass(String.class);
    verify(response).setHeader(eq("WWW-Authenticate"), challenge.capture());
    assertThat(challenge.getValue())
        .isEqualTo(
            OAuthHttpStatelessServerTransportProvider.buildAuthChallenge(
                AuthFailure.INVALID_TOKEN, RESOURCE_METADATA, List.of("openid")));
  }

  @Test
  void writeAuthError_setsStatusPerFailureKind() throws Exception {
    assertThat(statusOf(AuthFailure.MISSING_CREDENTIALS))
        .isEqualTo(HttpServletResponse.SC_UNAUTHORIZED);
    assertThat(statusOf(AuthFailure.INVALID_TOKEN)).isEqualTo(HttpServletResponse.SC_UNAUTHORIZED);
  }

  /**
   * Each kind carries its own JSON-RPC code, so a 403 kind added later cannot inherit the 401 one.
   */
  @Test
  void authFailure_jsonRpcCodeMatchesHttpStatus() {
    for (AuthFailure failure : AuthFailure.values()) {
      assertThat(failure.statusCode()).isEqualTo(HttpServletResponse.SC_UNAUTHORIZED);
      assertThat(failure.jsonRpcCode()).isEqualTo(JsonRpcErrorBody.UNAUTHORIZED);
    }
  }

  // ── helpers ──────────────────────────────────────────────────────────────

  private static String bodyOf(AuthFailure failure) throws Exception {
    HttpServletResponse response = mock(HttpServletResponse.class);
    StringWriter body = new StringWriter();
    when(response.getWriter()).thenReturn(new PrintWriter(body));
    OAuthHttpStatelessServerTransportProvider.writeAuthError(
        response, failure, RESOURCE_METADATA, List.of("openid", "profile", "email"));
    return body.toString();
  }

  private static String challengeOf(AuthFailure failure) {
    return OAuthHttpStatelessServerTransportProvider.buildAuthChallenge(
        failure, RESOURCE_METADATA, List.of("openid", "profile", "email"));
  }

  private static int statusOf(AuthFailure failure) throws Exception {
    HttpServletResponse response = mock(HttpServletResponse.class);
    when(response.getWriter()).thenReturn(new PrintWriter(new StringWriter()));
    OAuthHttpStatelessServerTransportProvider.writeAuthError(
        response, failure, RESOURCE_METADATA, List.of("openid"));
    ArgumentCaptor<Integer> status = ArgumentCaptor.forClass(Integer.class);
    verify(response).setStatus(status.capture());
    return status.getValue();
  }

  private static String sanitize(String url) throws Exception {
    Method m =
        OAuthHttpStatelessServerTransportProvider.class.getDeclaredMethod(
            "sanitizeRedirectUrlForLogging", String.class);
    m.setAccessible(true);
    return (String) m.invoke(null, url);
  }
}
