package org.openmetadata.jpw.auth;

import com.microsoft.playwright.BrowserContext;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpRequest.BodyPublishers;
import java.net.http.HttpResponse;
import java.net.http.HttpResponse.BodyHandlers;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.openmetadata.jpw.server.ServerHandle;
import org.openmetadata.jpw.server.sso.ClientType;
import org.openmetadata.jpw.server.sso.GoogleProfile;
import org.openmetadata.jpw.server.sso.MockOidcServer;
import org.openmetadata.jpw.server.sso.SsoProfile;

/**
 * Boots OM in Google confidential-client SSO mode against the mock IdP, and acquires
 * tokens silently via direct REST calls to the IdP's token endpoint
 * (grant_type=password). No browser involved — the goal here is to hand a session token
 * to the rest of the suite, not to test the login UI itself.
 */
public final class GoogleConfidentialBackend implements AuthBackend {

  static final String NAME = "sso-google-confidential";
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

  private final SsoProfile profile = new GoogleProfile(ClientType.CONFIDENTIAL);
  private final HttpClient http = HttpClient.newBuilder().connectTimeout(HTTP_TIMEOUT).build();

  @Override
  public String name() {
    return NAME;
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
    return requestTokens(idp, "grant_type=password&username=%s&password=%s&scope=%s"
        .formatted(DEFAULT_USER, DEFAULT_PASSWORD, urlEncode(SCOPE)));
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
    final String body = formBody + "&client_id=" + urlEncode(CLIENT_ID)
        + "&client_secret=" + urlEncode(CLIENT_SECRET);
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
    return new TokenSet(
        accessToken, refreshToken, idToken, Instant.now().plusSeconds(expiresIn));
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
    return java.net.URLEncoder.encode(s, StandardCharsets.UTF_8);
  }
}
