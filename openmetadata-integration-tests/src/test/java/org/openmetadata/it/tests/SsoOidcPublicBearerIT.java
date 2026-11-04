package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeFalse;
import static org.openmetadata.it.sso.SsoFlows.loggedInUser;
import static org.openmetadata.service.exception.CatalogExceptionMessage.SELF_SIGNUP_DISABLED_MESSAGE;

import java.net.http.HttpResponse;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.sso.MockHttp;
import org.openmetadata.it.sso.MockResponseGate;
import org.openmetadata.it.sso.browser.SsoBrowser;
import org.openmetadata.it.sso.config.SecurityConfigSwap;
import org.openmetadata.it.sso.config.SsoConfigs;
import org.openmetadata.it.sso.config.SsoServer;
import org.openmetadata.it.sso.oidc.IdTokenDefect;
import org.openmetadata.it.sso.oidc.MockOidcIdentity;
import org.openmetadata.it.sso.oidc.MockOidcProvider;
import org.openmetadata.it.sso.oidc.TokenForgery;
import org.openmetadata.it.util.OssTestServer;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * Public-client OIDC: the single-page app signs in at the provider on its own and sends the
 * provider's ID token with every request, which the server verifies against the provider's JWKS.
 */
@Isolated
@Execution(ExecutionMode.SAME_THREAD)
@ExtendWith(TestNamespaceExtension.class)
class SsoOidcPublicBearerIT {
  private static final String EMAIL_DOMAIN = "@open-metadata.org";
  private static final String USERS_PATH = "/api/v1/users";
  private static final String EXPIRED_TOKEN = "Expired token!";
  private static final String SIGNING_KEY_NOT_FOUND = "Token signing key not found";
  private static final String INVALID_SESSION = "Invalid session.";

  private static MockOidcProvider provider;
  private static SecurityConfigSwap securityConfig;

  @BeforeAll
  static void pointTheServerAtTheMockProvider() {
    assumeFalse(OssTestServer.isExternalMode(), "Reconfigures the embedded server's SSO");
    provider = MockOidcProvider.start();
    securityConfig = SecurityConfigSwap.snapshotLiveConfig();
    securityConfig.applyBaseline(SsoConfigs.publicOidc(securityConfig.originalCopy(), provider));
  }

  @AfterAll
  static void restoreTheLiveConfiguration() {
    if (securityConfig != null) {
      securityConfig.close();
    }
    if (provider != null) {
      provider.close();
    }
  }

  @Test
  @DisplayName("OP-01 the provider's ID token authenticates an existing user")
  void providerTokenAuthenticatesAnExistingUser(TestNamespace ns) {
    MockOidcIdentity grace = existingUser(ns, "grace");

    HttpResponse<String> response = loggedInUser(new SsoBrowser(), provider.issueIdToken(grace));

    assertEquals(200, response.statusCode(), response.body());
    assertEquals(grace.email(), JsonUtils.readTree(response.body()).get("email").asText());
  }

  @Test
  @DisplayName("OP-02 a new user signs themselves up with their own token when self-signup is on")
  void newUserSignsUpWithTheirOwnToken(TestNamespace ns) throws Throwable {
    MockOidcIdentity heidi = newIdentity(ns, "heidi");
    String token = provider.issueIdToken(heidi);
    SsoBrowser browser = new SsoBrowser();

    HttpResponse<String> signup = signUp(browser, heidi, token);

    assertEquals(201, signup.statusCode(), signup.body());
    assertEquals(200, loggedInUser(browser, token).statusCode());

    MockOidcIdentity ivan = newIdentity(ns, "ivan");
    securityConfig.withVariant(
        config -> {
          config.getAuthenticationConfiguration().withEnableSelfSignup(false);
          return config;
        },
        () -> {
          HttpResponse<String> refused = signUp(browser, ivan, provider.issueIdToken(ivan));
          assertEquals(403, refused.statusCode(), refused.body());
          assertTrue(refused.body().contains(SELF_SIGNUP_DISABLED_MESSAGE), refused.body());
        });
  }

  @Test
  @DisplayName("OP-03 an expired token gets the 401 the app answers by renewing")
  void expiredTokenIsRefusedWithTheRenewalMessage(TestNamespace ns) {
    MockOidcIdentity judy = existingUser(ns, "judy");
    provider.defectNextIdToken(IdTokenDefect.EXPIRED);

    assertUnauthorized(provider.issueIdToken(judy), EXPIRED_TOKEN);
  }

  @Test
  @DisplayName("OP-04 a token from an unknown key is refused, and a rotated key works at once")
  void unknownKeyIsRefusedAndARotatedKeyIsFetched(TestNamespace ns) {
    MockOidcIdentity ken = existingUser(ns, "ken");
    provider.defectNextIdToken(IdTokenDefect.UNPUBLISHED_KEY);
    assertUnauthorized(provider.issueIdToken(ken), SIGNING_KEY_NOT_FOUND);

    provider.rotateSigningKey();
    HttpResponse<String> response = loggedInUser(new SsoBrowser(), provider.issueIdToken(ken));

    assertEquals(200, response.statusCode(), "a new kid is fetched on demand: " + response.body());
  }

  @Test
  @DisplayName("OP-06 a token for another client is refused")
  void tokenForAnotherAudienceIsRefused(TestNamespace ns) {
    MockOidcIdentity leo = existingUser(ns, "leo");
    provider.defectNextIdToken(IdTokenDefect.WRONG_AUDIENCE);

    assertUnauthorized(provider.issueIdToken(leo), null);
  }

  @Test
  @DisplayName("OP-08 unsigned, algorithm-confused and wrong-algorithm tokens are refused")
  void forgedTokensAreRefused(TestNamespace ns) {
    MockOidcIdentity mallory = existingUser(ns, "mallory");
    for (TokenForgery forgery : TokenForgery.values()) {
      assertUnauthorized(provider.issueForgedIdToken(mallory, forgery), null);
    }
  }

  @Test
  @DisplayName(
      "OP-09 a token whose claims were edited after signing, or that is cut short, is refused")
  void tamperedAndTruncatedTokensAreRefused(TestNamespace ns) {
    MockOidcIdentity nina = existingUser(ns, "nina");
    MockOidcIdentity oscar = existingUser(ns, "oscar");
    String token = provider.issueIdToken(nina);

    assertUnauthorized(withClaimsOf(token, provider.issueIdToken(oscar)), null);
    assertUnauthorized(token.substring(0, token.lastIndexOf('.')), null);
  }

  @Test
  @DisplayName("OP-10 a key is still found when an earlier key URL is unreachable")
  void keyIsFoundPastAnUnreachableKeyUrl(TestNamespace ns) throws Throwable {
    MockOidcIdentity peggy = existingUser(ns, "peggy");
    String unreachable = "http://localhost:1/jwks";
    securityConfig.withVariant(
        config -> {
          config
              .getAuthenticationConfiguration()
              .withPublicKeyUrls(List.of(unreachable, provider.jwksUri()));
          return config;
        },
        () -> {
          provider.rotateSigningKey();
          HttpResponse<String> response =
              loggedInUser(new SsoBrowser(), provider.issueIdToken(peggy));
          assertEquals(200, response.statusCode(), response.body());
        });
  }

  @Test
  @DisplayName("OP-11 a key set that never answers fails the request within seconds")
  void hangingKeySetFailsTheRequestWithinSeconds(TestNamespace ns) throws Throwable {
    MockOidcIdentity sam = existingUser(ns, "sam");
    securityConfig.withVariant(
        config -> config,
        () -> {
          provider.rotateSigningKey();
          MockResponseGate gate = provider.holdNextJwksResponse();
          try {
            long started = System.nanoTime();
            HttpResponse<String> response =
                loggedInUser(new SsoBrowser(), provider.issueIdToken(sam));
            long elapsedSeconds = TimeUnit.NANOSECONDS.toSeconds(System.nanoTime() - started);

            assertEquals(401, response.statusCode(), response.body());
            assertTrue(elapsedSeconds < 15, "the request waited " + elapsedSeconds + " s");
          } finally {
            gate.release();
          }
        });
  }

  @Test
  @DisplayName("OP-15 tokens with made-up key ids cannot make every request refetch the key set")
  void madeUpKeyIdsCannotMakeEveryRequestRefetchTheKeySet(TestNamespace ns) throws Throwable {
    MockOidcIdentity tina = existingUser(ns, "tina");
    securityConfig.withVariant(
        config -> config,
        () -> {
          provider.clearJournal();
          long started = System.nanoTime();
          for (int attempt = 0; attempt < 25; attempt++) {
            provider.defectNextIdToken(IdTokenDefect.UNPUBLISHED_KEY);
            assertUnauthorized(provider.issueIdToken(tina), SIGNING_KEY_NOT_FOUND);
          }
          // A burst of 10, then one fetch for every 6 seconds the loop took.
          long elapsedSeconds = TimeUnit.NANOSECONDS.toSeconds(System.nanoTime() - started);
          long allowed = 10 + elapsedSeconds / 6 + 1;
          int fetches = provider.jwksRequests().size();
          assertTrue(fetches <= allowed, fetches + " key-set fetches for 25 made-up key ids");
        });
  }

  @Test
  @DisplayName("OP-12 an address the provider marks unverified is refused")
  void unverifiedEmailIsRefused(TestNamespace ns) {
    MockOidcIdentity quinn = existingUser(ns, "quinn");

    assertUnauthorized(provider.issueIdToken(quinn.withClaim("email_verified", false)), null);
    HttpResponse<String> verified =
        loggedInUser(
            new SsoBrowser(), provider.issueIdToken(quinn.withClaim("email_verified", true)));
    assertEquals(200, verified.statusCode(), verified.body());
  }

  @Test
  @DisplayName("OP-14 a public client has no server-side login")
  void publicClientHasNoServerSideLogin() {
    HttpResponse<String> response = new SsoBrowser().get(SsoServer.loginUrl());

    assertEquals(404, response.statusCode(), response.body());
  }

  @Test
  @DisplayName("OP-16 a provider token cannot pose as a bot, a personal access token or a session")
  void providerTokenCannotPoseAsAnOpenMetadataToken(TestNamespace ns) {
    MockOidcIdentity rita = existingUser(ns, "rita");
    assertUnauthorized(provider.issueIdToken(rita.withClaim("isBot", true)), null);
    assertUnauthorized(provider.issueIdToken(rita.withClaim("tokenType", "PERSONAL_ACCESS")), null);
    assertUnauthorized(
        provider.issueIdToken(rita.withClaim("sessionId", "not-a-session")), INVALID_SESSION);

    HttpResponse<String> impersonating =
        new SsoBrowser()
            .getWithHeaders(
                SsoServer.url(SsoServer.LOGGED_IN_USER_PATH),
                Map.of(
                    MockHttp.AUTHORIZATION,
                    "Bearer " + provider.issueIdToken(rita),
                    "X-Impersonate-User",
                    "admin"));
    assertEquals(403, impersonating.statusCode(), impersonating.body());
  }

  private static void assertUnauthorized(String token, String expectedMessage) {
    HttpResponse<String> response = loggedInUser(new SsoBrowser(), token);
    assertEquals(401, response.statusCode(), response.body());
    if (expectedMessage != null) {
      assertTrue(response.body().contains(expectedMessage), response.body());
    }
  }

  private static HttpResponse<String> signUp(
      SsoBrowser browser, MockOidcIdentity identity, String token) {
    String body =
        JsonUtils.pojoToJson(
            new CreateUser().withName(nameOf(identity)).withEmail(identity.email()));
    return browser.postJsonWithBearer(SsoServer.url(USERS_PATH), body, token);
  }

  private static MockOidcIdentity existingUser(TestNamespace ns, String name) {
    MockOidcIdentity identity = newIdentity(ns, name);
    SdkClients.adminClient()
        .users()
        .create(new CreateUser().withName(nameOf(identity)).withEmail(identity.email()));
    return identity;
  }

  private static MockOidcIdentity newIdentity(TestNamespace ns, String name) {
    return MockOidcIdentity.forEmail(ns.shortPrefix(name) + EMAIL_DOMAIN);
  }

  private static String nameOf(MockOidcIdentity identity) {
    return identity.email().substring(0, identity.email().indexOf('@'));
  }

  /** The header and signature of {@code signed}, carrying the claims of {@code other}. */
  private static String withClaimsOf(String signed, String other) {
    String[] signedParts = signed.split("\\.");
    String[] otherParts = other.split("\\.");
    return signedParts[0] + "." + otherParts[1] + "." + signedParts[2];
  }
}
