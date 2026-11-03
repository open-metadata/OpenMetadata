package org.openmetadata.it.auth;

import java.time.Duration;
import java.time.Instant;

/**
 * A snapshot of credentials issued by an {@link AuthBackend}.
 *
 * <p>Refresh-incapable backends (e.g. basic JWT) leave {@code refreshToken} {@code null}
 * and rely on {@link AuthBackend#refresh} to mint a fresh access token from scratch.
 * The {@code idToken} is populated for OIDC backends and used as the value the OM UI
 * expects in {@code localStorage.app_state.primary}.
 */
public record TokenSet(String accessToken, String refreshToken, String idToken, Instant expiresAt) {

  public Duration timeUntilExpiry() {
    return Duration.between(Instant.now(), expiresAt);
  }

  public boolean expiresWithin(final Duration window) {
    return timeUntilExpiry().compareTo(window) <= 0;
  }

  /**
   * The token a browser presents to the API: the ID token when the provider issued one. Access
   * tokens are issued for other audiences (the mock IdP's carry no {@code aud} at all), and the
   * server only accepts provider tokens issued to its own client.
   */
  public String bearerToken() {
    return idToken != null ? idToken : accessToken;
  }
}
