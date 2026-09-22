package org.openmetadata.it.auth;

import com.microsoft.playwright.BrowserContext;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import org.openmetadata.it.server.ServerHandle;
import org.openmetadata.it.server.sso.MockOidcServer;
import org.openmetadata.it.server.sso.SsoProfile;

/**
 * Default backend — OM runs with its built-in JWT auth and tests use admin tokens minted
 * by {@link JwtAuthProvider} (the same provider {@code SdkClients} uses elsewhere).
 *
 * <p>"Refresh" is just minting a new token from the same key; no IdP required, no real
 * OAuth2 flow. The OM UI accepts these tokens because the test harness shares the
 * provider's signing keys with the server (mounted as {@code public_key.der} /
 * {@code private_key.der} in {@code ContainerizedServer}).
 */
public final class BasicJwtBackend implements AuthBackend {

  static final String NAME = "basic";
  private static final String ADMIN_PRINCIPAL = "admin@open-metadata.org";
  private static final String[] ADMIN_ROLES = {"admin"};
  private static final long TOKEN_TTL_SECONDS = 24L * 60 * 60;

  @Override
  public String name() {
    return NAME;
  }

  @Override
  public boolean requiresIdp() {
    return false;
  }

  @Override
  public SsoProfile ssoProfile() {
    return null;
  }

  @Override
  public Map<String, String> serverEnv(final MockOidcServer idp, final int omHostPort) {
    return Map.of();
  }

  @Override
  public TokenSet acquireToken(final ServerHandle server, final MockOidcServer idp) {
    return mint();
  }

  @Override
  public TokenSet refresh(
      final TokenSet current, final ServerHandle server, final MockOidcServer idp) {
    return mint();
  }

  @Override
  public void injectIntoBrowser(final BrowserContext context, final TokenSet tokens) {
    AppStateInjection.seed(context, tokens.accessToken());
  }

  private static TokenSet mint() {
    final String jwt =
        JwtAuthProvider.tokenFor(ADMIN_PRINCIPAL, ADMIN_PRINCIPAL, ADMIN_ROLES, TOKEN_TTL_SECONDS);
    final Instant expiresAt = Instant.now().plus(Duration.ofSeconds(TOKEN_TTL_SECONDS));
    return new TokenSet(jwt, null, jwt, expiresAt);
  }
}
