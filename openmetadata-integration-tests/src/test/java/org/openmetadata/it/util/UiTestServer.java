package org.openmetadata.it.util;

import java.time.Duration;
import java.time.Instant;
import org.openmetadata.it.auth.AuthBackend;
import org.openmetadata.it.auth.AuthBackends;
import org.openmetadata.it.auth.AuthSession;
import org.openmetadata.it.auth.TokenRefresher;
import org.openmetadata.it.auth.TokenSet;
import org.openmetadata.it.server.ContainerizedServer;
import org.openmetadata.it.server.ExternalServer;
import org.openmetadata.it.server.ServerHandle;
import org.openmetadata.it.server.sso.MockOidcServer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Boots and caches the JVM-wide {@link ServerHandle} for UI scenarios, plus the auth
 * machinery that drives token acquisition and refresh.
 *
 * <p>Mode selection (transparent to tests):
 * <ul>
 *   <li>{@code OM_URL} + {@code OM_ADMIN_TOKEN} set → {@link ExternalServer}, basic auth only
 *   <li>otherwise → {@link ContainerizedServer} bringing up MySQL + OpenSearch + the OM
 *       image; {@code jpw.auth} (system property or {@code JPW_AUTH} env) picks the
 *       backend (default {@code basic}; {@code sso-google-confidential} boots the mock IdP
 *       sidecar and acquires tokens via OAuth2 password grant).
 * </ul>
 *
 * <p>Once initialized, {@link AuthSession#current()} holds the active token, and a daemon
 * {@link TokenRefresher} keeps it valid for runs longer than a single token TTL.
 */
public final class UiTestServer {

  private static final Logger LOG = LoggerFactory.getLogger(UiTestServer.class);

  private static volatile ServerHandle cached;
  private static volatile ContainerizedServer ownedContainer;
  private static volatile TokenRefresher refresher;

  private UiTestServer() {}

  public static synchronized ServerHandle get() {
    if (cached != null) {
      return cached;
    }
    final AuthBackend backend = AuthBackends.resolve();
    LOG.info("UI test auth backend: {}", backend.name());
    if (hasExternalConfig()) {
      cached = bootExternal(backend);
      pointSdkClientsAt(cached);
      initializeExternalAuth(backend);
    } else {
      cached = bootContainerized(backend);
      pointSdkClientsAt(cached);
      initializeContainerizedAuth(backend);
    }
    Runtime.getRuntime()
        .addShutdownHook(new Thread(UiTestServer::tearDown, "UiTestServer-cleanup"));
    return cached;
  }

  /**
   * External mode: honour the operator-provided {@code OM_ADMIN_TOKEN} verbatim. Minting a
   * token here via {@code backend.acquireToken} would sign it with the test harness's key
   * (BasicJwtBackend), which the external server won't trust. No {@link TokenRefresher} —
   * the external token's lifecycle belongs to whoever issued it.
   */
  private static void initializeExternalAuth(final AuthBackend backend) {
    final String token = lookup("OM_ADMIN_TOKEN");
    SdkClients.overrideAdminToken(token);
    AuthSession.initialize(backend, externalTokenSet(token));
  }

  private static void initializeContainerizedAuth(final AuthBackend backend) {
    final TokenSet initial = backend.acquireToken(cached, idp());
    AuthSession.initialize(backend, initial);
    SdkClients.overrideAdminToken(initial.accessToken());
    // Rebuild the cached ServerHandle now that we have a real token. Without this,
    // server.sdk() returns the placeholder client built with the empty token, and any
    // caller that goes through it (e.g. ReindexHelpers.triggerApp) gets 401.
    if (ownedContainer != null) {
      cached = ownedContainer.handle(initial.accessToken());
    }
    refresher = TokenRefresher.start(backend, cached, idp());
  }

  private static TokenSet externalTokenSet(final String token) {
    // Static operator token: mark a far-future expiry so nothing treats it as refreshable.
    return new TokenSet(token, null, null, Instant.now().plus(Duration.ofDays(3650)));
  }

  private static ServerHandle bootExternal(final AuthBackend backend) {
    if (backend.requiresIdp()) {
      throw new IllegalStateException(
          "External mode does not support SSO backends — point OM_URL at a stack that's "
              + "already configured for the SSO provider you want to test");
    }
    LOG.info("UI test mode: external (OM_URL + OM_ADMIN_TOKEN detected)");
    return ExternalServer.fromEnv();
  }

  private static ServerHandle bootContainerized(final AuthBackend backend) {
    LOG.info("UI test mode: containerized");
    ownedContainer =
        backend.requiresIdp()
            ? ContainerizedServer.launch(backend.ssoProfile())
            : ContainerizedServer.launch();
    // The token at this point is a placeholder — UiTestServer.get() acquires the real one
    // from the backend right after this and propagates it via SdkClients.overrideAdminToken.
    return ownedContainer.handle("");
  }

  private static MockOidcServer idp() {
    return ownedContainer != null ? ownedContainer.ssoIdp() : null;
  }

  private static void pointSdkClientsAt(final ServerHandle server) {
    SdkClients.overrideBaseUrl(server.baseUrl().toString());
  }

  private static void tearDown() {
    if (refresher != null) {
      refresher.close();
    }
    if (ownedContainer != null) {
      ownedContainer.close();
    }
  }

  private static boolean hasExternalConfig() {
    return lookup("OM_URL") != null && lookup("OM_ADMIN_TOKEN") != null;
  }

  private static String lookup(final String name) {
    final String env = System.getenv(name);
    if (env != null && !env.isBlank()) {
      return env;
    }
    final String prop = System.getProperty(name);
    return (prop != null && !prop.isBlank()) ? prop : null;
  }
}
