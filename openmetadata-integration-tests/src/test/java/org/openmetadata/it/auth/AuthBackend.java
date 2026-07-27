package org.openmetadata.it.auth;

import com.microsoft.playwright.BrowserContext;
import java.util.Map;
import org.openmetadata.it.server.ServerHandle;
import org.openmetadata.it.server.sso.MockOidcServer;
import org.openmetadata.it.server.sso.SsoProfile;

/**
 * One auth backend = one way OM is configured to authenticate, plus how tokens are
 * acquired/refreshed/used by tests.
 *
 * <p>Implementations are stateless and thread-safe; one instance per JVM.
 *
 * <p>Lifecycle inside {@code UiTestServer.get()}:
 * <ol>
 *   <li>{@link #serverEnv} — env vars OM needs to boot under this backend
 *   <li>OM starts; if {@link #requiresIdp} is true, a {@link MockOidcServer} is also booted
 *   <li>{@link #acquireToken} — get the initial {@link TokenSet} for the suite
 *   <li>{@link TokenRefresher} ticks; calls {@link #refresh} as expiry approaches
 *   <li>Each {@code @Test} starts: {@link #injectIntoBrowser} writes the current token
 *       into a fresh {@link BrowserContext}
 * </ol>
 */
public sealed interface AuthBackend permits BasicJwtBackend, OidcBackend {

  String name();

  boolean requiresIdp();

  /** SSO profile used to boot the OM container; {@code null} for non-IdP backends. */
  SsoProfile ssoProfile();

  Map<String, String> serverEnv(MockOidcServer idp, int omHostPort);

  TokenSet acquireToken(ServerHandle server, MockOidcServer idp);

  TokenSet refresh(TokenSet current, ServerHandle server, MockOidcServer idp);

  void injectIntoBrowser(BrowserContext context, TokenSet tokens);
}
