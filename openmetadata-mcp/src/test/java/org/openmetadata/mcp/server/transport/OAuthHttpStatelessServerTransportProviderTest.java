package org.openmetadata.mcp.server.transport;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.lang.reflect.Method;
import java.net.URI;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.openmetadata.mcp.server.transport.OAuthHttpStatelessServerTransportProvider.AuthFailure;

class OAuthHttpStatelessServerTransportProviderTest {

  private static final URI RESOURCE_METADATA =
      URI.create("https://example.com/mcp/.well-known/oauth-protected-resource");

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
        .contains("Mcp-Client-Name");
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
