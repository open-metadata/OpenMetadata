package org.openmetadata.it.auth;

import java.time.Duration;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import org.openmetadata.it.server.ServerHandle;
import org.openmetadata.it.server.sso.MockOidcServer;
import org.openmetadata.it.util.SdkClients;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Background daemon that keeps {@link AuthSession#current()} valid for the lifetime of a
 * test JVM. Wakes every {@link #TICK_INTERVAL} and refreshes if the token is within
 * {@link #REFRESH_THRESHOLD} of its expiry, then publishes the new token to
 * {@link AuthSession} and re-points {@link SdkClients} so factories pick it up.
 *
 * <p>UI tests pull the latest token at {@code beforeEach} via {@link AuthSession#current()},
 * so a refresh between tests is transparent. Tests that hold a long-lived browser context
 * across many minutes are the only case where refresh wouldn't take effect mid-flight —
 * acceptable as long as the per-test token is fresh on entry.
 */
public final class TokenRefresher implements AutoCloseable {

  private static final Logger LOG = LoggerFactory.getLogger(TokenRefresher.class);
  private static final Duration TICK_INTERVAL = Duration.ofSeconds(30);
  private static final Duration REFRESH_THRESHOLD = Duration.ofMinutes(2);

  private final ScheduledExecutorService scheduler;
  private final AuthBackend backend;
  private final ServerHandle server;
  private final MockOidcServer idp;

  private TokenRefresher(
      final ScheduledExecutorService scheduler,
      final AuthBackend backend,
      final ServerHandle server,
      final MockOidcServer idp) {
    this.scheduler = scheduler;
    this.backend = backend;
    this.server = server;
    this.idp = idp;
  }

  public static TokenRefresher start(
      final AuthBackend backend, final ServerHandle server, final MockOidcServer idp) {
    final ScheduledExecutorService scheduler =
        Executors.newSingleThreadScheduledExecutor(
            r -> {
              Thread t = new Thread(r, "jpw-token-refresher");
              t.setDaemon(true);
              return t;
            });
    final TokenRefresher refresher = new TokenRefresher(scheduler, backend, server, idp);
    scheduler.scheduleAtFixedRate(
        refresher::tick, TICK_INTERVAL.toSeconds(), TICK_INTERVAL.toSeconds(), TimeUnit.SECONDS);
    return refresher;
  }

  @Override
  public void close() {
    scheduler.shutdownNow();
  }

  private void tick() {
    try {
      final TokenSet current = AuthSession.current();
      if (!current.expiresWithin(REFRESH_THRESHOLD)) {
        return;
      }
      LOG.info(
          "Refreshing {} token (expires in {}s)",
          backend.name(),
          current.timeUntilExpiry().toSeconds());
      final TokenSet refreshed = backend.refresh(current, server, idp);
      AuthSession.update(refreshed);
      SdkClients.overrideAdminToken(refreshed.accessToken());
    } catch (RuntimeException e) {
      LOG.warn("Token refresh failed; will retry on next tick", e);
    }
  }
}
