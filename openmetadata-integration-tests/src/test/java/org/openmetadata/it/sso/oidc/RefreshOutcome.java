package org.openmetadata.it.sso.oidc;

import java.time.Duration;

/** How the provider answers refresh-token grants until told otherwise. */
public sealed interface RefreshOutcome {
  String JSON = "application/json";

  /**
   * A successful renewal.
   *
   * @param idTokenLifetime {@code null} keeps the provider's configured lifetime.
   */
  record Renew(boolean rotatesRefreshToken, boolean includesIdToken, Duration idTokenLifetime)
      implements RefreshOutcome {}

  /** An OAuth error response, e.g. {@code invalid_grant} for a revoked refresh token. */
  record Reject(int status, String error) implements RefreshOutcome {}

  /** A response that is not an OAuth answer at all, such as a gateway error page. */
  record Fail(int status, String contentType, String body) implements RefreshOutcome {}

  static RefreshOutcome renew() {
    return new Renew(false, true, null);
  }

  static RefreshOutcome rotateRefreshToken() {
    return new Renew(true, true, null);
  }

  static RefreshOutcome renewWithoutIdToken() {
    return new Renew(false, false, null);
  }

  static RefreshOutcome renewWithIdTokenValidFor(Duration lifetime) {
    return new Renew(false, true, lifetime);
  }

  /** RFC 6749 sends every token-endpoint error as 400, except {@code invalid_client} (401). */
  static RefreshOutcome reject(String error) {
    return new Reject(MockOidcProtocol.INVALID_CLIENT.equals(error) ? 401 : 400, error);
  }

  static RefreshOutcome serverError() {
    return new Fail(500, JSON, "{\"error\":\"server_error\"}");
  }

  static RefreshOutcome gatewayErrorPage() {
    return new Fail(502, "text/html", "<html><body>502 Bad Gateway</body></html>");
  }
}
