package org.openmetadata.it.auth;

import com.microsoft.playwright.BrowserContext;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpRequest.BodyPublishers;
import java.net.http.HttpResponse;
import java.net.http.HttpResponse.BodyHandlers;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.openmetadata.it.server.ServerHandle;
import org.openmetadata.it.server.sso.MockOidcServer;
import org.openmetadata.it.server.sso.SsoProfile;

/**
 * Single OIDC backend — works for any {@link SsoProfile} (Google, Okta, custom OIDC) and
 * either {@code ClientType}. Boots OM with the profile's env vars and acquires tokens
 * silently against the mock IdP using OAuth2 password / refresh-token grants.
 *
 * <p>Browser-based sign-in flows are tested by separate {@code *SignInUIIT} classes; this
 * backend is what every other test reads from when running under SSO.
 */
public final class OidcBackend implements AuthBackend {

  private static final String CLIENT_ID = "om-test-client";
  private static final String CLIENT_SECRET = "om-test-secret";
  private static final String SCOPE = "openid email profile";
  private static final String DEFAULT_USER = "admin@open-metadata.org";
  private static final String DEFAULT_PASSWORD = "test-password";
  private static final Duration HTTP_TIMEOUT = Duration.ofSeconds(15);
  private static final Pattern ACCESS_TOKEN_PATTERN =
      Pattern.compile("\"access_token\"\\s*:\\s*\"([^\"]+)\"");
  private static final Pattern REFRESH_TOKEN_PATTERN =
      Pattern.compile("\"refresh_token\"\\s*:\\s*\"([^\"]+)\"");
  private static final Pattern ID_TOKEN_PATTERN =
      Pattern.compile("\"id_token\"\\s*:\\s*\"([^\"]+)\"");
  private static final Pattern EXPIRES_IN_PATTERN =
      Pattern.compile("\"expires_in\"\\s*:\\s*(\\d+)");

  private final SsoProfile profile;
  private final HttpClient http = HttpClient.newBuilder().connectTimeout(HTTP_TIMEOUT).build();

  public OidcBackend(final SsoProfile profile) {
    this.profile = profile;
  }

  @Override
  public String name() {
    return String.format(
        Locale.ROOT,
        "sso-%s-%s",
        profile.providerSlug(),
        profile.clientType().name().toLowerCase(Locale.ROOT));
  }

  @Override
  public boolean requiresIdp() {
    return true;
  }

  @Override
  public SsoProfile ssoProfile() {
    return profile;
  }

  @Override
  public Map<String, String> serverEnv(final MockOidcServer idp, final int omHostPort) {
    return profile.serverEnv(idp, omHostPort);
  }

  @Override
  public TokenSet acquireToken(final ServerHandle server, final MockOidcServer idp) {
    return requestTokens(
        idp,
        "grant_type=password&username=%s&password=%s&scope=%s"
            .formatted(urlEncode(DEFAULT_USER), urlEncode(DEFAULT_PASSWORD), urlEncode(SCOPE)));
  }

  @Override
  public TokenSet refresh(
      final TokenSet current, final ServerHandle server, final MockOidcServer idp) {
    if (current.refreshToken() == null) {
      return acquireToken(server, idp);
    }
    return requestTokens(
        idp, "grant_type=refresh_token&refresh_token=" + urlEncode(current.refreshToken()));
  }

  @Override
  public void injectIntoBrowser(final BrowserContext context, final TokenSet tokens) {
    AppStateInjection.seed(context, tokens.idToken());
  }

  private TokenSet requestTokens(final MockOidcServer idp, final String formBody) {
    final URI tokenUri = URI.create(idp.issuerUrl(profile.issuerId()) + "/token");
    final String body =
        formBody
            + "&client_id="
            + urlEncode(CLIENT_ID)
            + "&client_secret="
            + urlEncode(CLIENT_SECRET);
    final HttpRequest request =
        HttpRequest.newBuilder(tokenUri)
            .header("Content-Type", "application/x-www-form-urlencoded")
            .header("Accept", "application/json")
            .timeout(HTTP_TIMEOUT)
            .POST(BodyPublishers.ofString(body, StandardCharsets.UTF_8))
            .build();
    final HttpResponse<String> response = send(request);
    if (response.statusCode() != 200) {
      throw new IllegalStateException(
          "Mock IdP rejected token request (" + response.statusCode() + "): " + response.body());
    }
    return parse(response.body());
  }

  private HttpResponse<String> send(final HttpRequest request) {
    try {
      return http.send(request, BodyHandlers.ofString());
    } catch (java.io.IOException e) {
      throw new IllegalStateException("Mock IdP token request failed", e);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new IllegalStateException("Mock IdP token request interrupted", e);
    }
  }

  private static TokenSet parse(final String body) {
    final String accessToken = requireMatch(ACCESS_TOKEN_PATTERN, body, "access_token");
    final String idToken = requireMatch(ID_TOKEN_PATTERN, body, "id_token");
    final String refreshToken = optionalMatch(REFRESH_TOKEN_PATTERN, body);
    final long expiresIn = Long.parseLong(requireMatch(EXPIRES_IN_PATTERN, body, "expires_in"));
    return new TokenSet(accessToken, refreshToken, idToken, Instant.now().plusSeconds(expiresIn));
  }

  private static String requireMatch(final Pattern pattern, final String body, final String field) {
    final Matcher matcher = pattern.matcher(body);
    if (!matcher.find()) {
      throw new IllegalStateException("Mock IdP response missing '" + field + "': " + body);
    }
    return matcher.group(1);
  }

  private static String optionalMatch(final Pattern pattern, final String body) {
    final Matcher matcher = pattern.matcher(body);
    return matcher.find() ? matcher.group(1) : null;
  }

  private static String urlEncode(final String s) {
    return URLEncoder.encode(s, StandardCharsets.UTF_8);
  }
}
