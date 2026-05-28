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
}
