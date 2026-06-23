package org.openmetadata.mcp.server.transport;

import static org.assertj.core.api.Assertions.assertThat;

import java.lang.reflect.Method;
import org.junit.jupiter.api.Test;

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
