package org.openmetadata.it.util;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import org.openmetadata.it.auth.AuthSession;
import org.openmetadata.it.auth.TokenSet;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Keeps the external-mode admin token fresh for long runs (scale/search suites can exceed a login
 * token's ~1h TTL). The harness can't re-mint a server-trusted token (its signing key isn't trusted
 * by the external cluster), so it re-logs-in with the same basic-auth credentials the workflow used
 * and pushes the new token into {@link SdkClients} and {@link AuthSession}.
 *
 * <p>Enabled only when {@code OM_EXTERNAL_USERNAME} + {@code OM_EXTERNAL_PASSWORD} are available;
 * otherwise the static token is used as-is (and will expire on a long run).
 */
public final class ExternalTokenRefresher implements AutoCloseable {

  private static final Logger LOG = LoggerFactory.getLogger(ExternalTokenRefresher.class);
  private static final Duration EXPIRY_BUFFER = Duration.ofMinutes(2);
  private static final long FALLBACK_REFRESH_SECONDS = Duration.ofMinutes(30).toSeconds();

  private final ScheduledExecutorService scheduler =
      Executors.newSingleThreadScheduledExecutor(
          r -> {
            final Thread t = new Thread(r, "external-token-refresher");
            t.setDaemon(true);
            return t;
          });
  private final HttpClient http = HttpClient.newBuilder().connectTimeout(EXPIRY_BUFFER).build();
  private final ObjectMapper mapper = new ObjectMapper();
  private final String loginUrl;
  private final String email;
  private final String passwordB64;

  private ExternalTokenRefresher(final String omUrl, final String email, final String password) {
    this.loginUrl = stripTrailingSlash(omUrl) + "/api/v1/users/login";
    this.email = email;
    this.passwordB64 =
        Base64.getEncoder().encodeToString(password.getBytes(StandardCharsets.UTF_8));
  }

  /**
   * Starts a daemon refresher if credentials are present, scheduling the first refresh just before
   * {@code currentToken} expires. Returns {@code null} (no refresh) when credentials are absent.
   */
  public static ExternalTokenRefresher startIfConfigured(
      final String omUrl, final String currentToken) {
    final String email = lookup("OM_EXTERNAL_USERNAME");
    final String password = lookup("OM_EXTERNAL_PASSWORD");
    if (email == null || password == null || omUrl == null) {
      LOG.warn(
          "External token auto-renewal disabled (OM_EXTERNAL_USERNAME/PASSWORD not set); the "
              + "operator token will expire on runs longer than its TTL");
      return null;
    }
    final ExternalTokenRefresher refresher = new ExternalTokenRefresher(omUrl, email, password);
    refresher.scheduleNext(currentToken);
    return refresher;
  }

  private void scheduleNext(final String token) {
    final long delaySeconds = refreshDelaySeconds(token);
    scheduler.schedule(this::refresh, delaySeconds, TimeUnit.SECONDS);
    LOG.info("Next external admin-token refresh scheduled in {}s", delaySeconds);
  }

  private void refresh() {
    try {
      final String token = login();
      SdkClients.overrideAdminToken(token);
      AuthSession.update(
          new TokenSet(token, null, null, Instant.now().plus(Duration.ofDays(3650))));
      LOG.info("Refreshed external admin token (re-login)");
      scheduleNext(token);
    } catch (final RuntimeException e) {
      LOG.warn("External token refresh failed: {} — retrying in 60s", e.getMessage());
      scheduler.schedule(this::refresh, 60, TimeUnit.SECONDS);
    }
  }

  private String login() {
    final String body =
        mapper.createObjectNode().put("email", email).put("password", passwordB64).toString();
    try {
      final HttpResponse<String> response =
          http.send(
              HttpRequest.newBuilder(URI.create(loginUrl))
                  .header("Content-Type", "application/json")
                  .POST(HttpRequest.BodyPublishers.ofString(body))
                  .build(),
              HttpResponse.BodyHandlers.ofString());
      if (response.statusCode() != 200) {
        throw new IllegalStateException("login returned HTTP " + response.statusCode());
      }
      final String token = mapper.readTree(response.body()).path("accessToken").asText("");
      if (token.isEmpty()) {
        throw new IllegalStateException("login response had no accessToken");
      }
      return token;
    } catch (final InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new IllegalStateException("login interrupted", e);
    } catch (final java.io.IOException e) {
      throw new IllegalStateException("login request failed", e);
    }
  }

  private long refreshDelaySeconds(final String token) {
    long delaySeconds = FALLBACK_REFRESH_SECONDS;
    final Long exp = expiryEpochSeconds(token);
    if (exp != null) {
      final long now = System.currentTimeMillis() / 1000;
      delaySeconds = Math.max(60, exp - now - EXPIRY_BUFFER.toSeconds());
    }
    return delaySeconds;
  }

  private Long expiryEpochSeconds(final String token) {
    Long exp = null;
    try {
      final String[] parts = token.split("\\.");
      if (parts.length >= 2) {
        final String payload =
            new String(Base64.getUrlDecoder().decode(parts[1]), StandardCharsets.UTF_8);
        final long claimed = mapper.readTree(payload).path("exp").asLong(0);
        if (claimed > 0) {
          exp = claimed;
        }
      }
    } catch (final RuntimeException | java.io.IOException ignored) {
      // Non-JWT or unparseable token — fall back to the fixed interval.
    }
    return exp;
  }

  @Override
  public void close() {
    scheduler.shutdownNow();
  }

  private static String stripTrailingSlash(final String url) {
    return url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
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
