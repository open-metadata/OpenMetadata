package org.openmetadata.mcp.server.transport;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.lang.reflect.Method;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class OAuthHttpStatelessServerTransportProviderTest {

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

  // ── helpers ──────────────────────────────────────────────────────────────

  private static String sanitize(String url) throws Exception {
    Method m =
        OAuthHttpStatelessServerTransportProvider.class.getDeclaredMethod(
            "sanitizeRedirectUrlForLogging", String.class);
    m.setAccessible(true);
    return (String) m.invoke(null, url);
  }
}
