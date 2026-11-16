package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeFalse;
import static org.openmetadata.it.sso.SsoFlows.SESSION_COOKIE;
import static org.openmetadata.it.sso.SsoFlows.idTokenFrom;
import static org.openmetadata.it.sso.SsoFlows.loggedInUser;
import static org.openmetadata.it.sso.SsoFlows.login;
import static org.openmetadata.it.sso.SsoFlows.requireActiveSession;

import com.fasterxml.jackson.databind.JsonNode;
import java.net.URI;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.sso.MockHttp;
import org.openmetadata.it.sso.MockRequestJournal.RecordedRequest;
import org.openmetadata.it.sso.MockResponseGate;
import org.openmetadata.it.sso.browser.SsoBrowser;
import org.openmetadata.it.sso.browser.SsoNavigation;
import org.openmetadata.it.sso.config.SecurityConfigSwap;
import org.openmetadata.it.sso.config.SsoConfigs;
import org.openmetadata.it.sso.config.SsoServer;
import org.openmetadata.it.sso.oidc.MockOidcIdentity;
import org.openmetadata.it.sso.oidc.MockOidcProvider;
import org.openmetadata.it.sso.state.StoredSessions;
import org.openmetadata.it.util.OssTestServer;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.configuration.SecurityConfiguration;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.security.client.OidcClientConfig;
import org.openmetadata.schema.security.client.OidcClientConfig.ClientAuthenticationMethod;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.security.session.SessionStatus;
import org.openmetadata.service.security.session.UserSession;

/**
 * Confidential-client OIDC logins against an in-JVM identity provider: the browser signs in through
 * the server's authorization-code flow and receives the provider's own ID token.
 */
@Isolated
@Execution(ExecutionMode.SAME_THREAD)
@ExtendWith(TestNamespaceExtension.class)
class SsoOidcConfidentialLoginIT {
  private static final String EMAIL_DOMAIN = "@open-metadata.org";
  private static final String REDIRECT_URI = "redirect_uri";
  private static final String CODE_CHALLENGE = "code_challenge";
  private static final String PROMPT = "prompt";
  private static final Duration TOKEN_EXCHANGE_ARRIVAL = Duration.ofSeconds(10);
  // The server gives up on a token request after 5 s, so a held exchange must be released sooner.
  private static final Duration SECOND_TOKEN_EXCHANGE_ARRIVAL = Duration.ofSeconds(4);

  private static MockOidcProvider provider;
  private static SecurityConfigSwap securityConfig;

  @BeforeAll
  static void pointTheServerAtTheMockProvider() {
    assumeFalse(OssTestServer.isExternalMode(), "Reconfigures the embedded server's SSO");
    provider = MockOidcProvider.start();
    securityConfig = SecurityConfigSwap.snapshotLiveConfig();
    securityConfig.applyBaseline(
        SsoConfigs.confidentialOidc(securityConfig.originalCopy(), provider));
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

  @BeforeEach
  void forgetEarlierRequests() {
    provider.clearJournal();
  }

  @Test
  @DisplayName("OC-01 a confidential login hands the browser the provider's own ID token")
  void loginRoundTripHandsTheBrowserTheProvidersIdToken(TestNamespace ns) {
    MockOidcIdentity alice = signInAs(ns, "alice");
    SsoBrowser browser = new SsoBrowser();

    SsoNavigation navigation = login(browser);

    assertEquals(SsoServer.url(SsoServer.SPA_CALLBACK_PATH), withoutFragment(navigation));
    String idToken = idTokenFrom(navigation);
    assertEquals(provider.lastIssuedIdToken(), idToken, "the server must not mint its own token");
    assertEquals(alice.email(), loggedInUserJson(browser, idToken).get("email").asText());
    UserSession session = requireActiveSession(browser);
    assertNotNull(session.getProviderRefreshToken(), "the provider refresh token is kept");
    List<RecordedRequest> tokenRequests = provider.tokenRequests();
    assertEquals(1, tokenRequests.size());
    assertEquals(
        SsoServer.url(SsoServer.CALLBACK_PATH), tokenRequests.getFirst().parameter(REDIRECT_URI));
  }

  @Test
  @DisplayName("OC-04 a login only returns to a trusted single-page-app callback")
  void loginOnlyReturnsToATrustedCallback() throws Throwable {
    SsoBrowser browser = new SsoBrowser();
    assertEquals(400, browser.get(SsoServer.url(SsoServer.LOGIN_PATH)).statusCode());
    assertEquals(
        400, browser.get(loginReturningTo("https://evil.example.com/auth/callback")).statusCode());

    String extraCallback = "https://app.example.com/auth/callback";
    securityConfig.withVariant(
        config -> {
          config
              .getAuthenticationConfiguration()
              .withAdditionalTrustedRedirectUris(List.of(extraCallback));
          return config;
        },
        () ->
            assertEquals(302, new SsoBrowser().get(loginReturningTo(extraCallback)).statusCode()));
  }

  @Test
  @DisplayName("OC-05 the authorization request carries the configured client, scope and nonce")
  void authorizationRequestCarriesTheConfiguredParameters(TestNamespace ns) {
    signInAs(ns, "request");

    login(new SsoBrowser());

    RecordedRequest authorize = provider.authorizeRequests().getFirst();
    assertEquals(MockOidcProvider.CLIENT_ID, authorize.parameter("client_id"));
    assertEquals("code", authorize.parameter("response_type"));
    assertEquals("query", authorize.parameter("response_mode"));
    assertEquals(SsoConfigs.SCOPE_WITH_REFRESH_TOKEN, authorize.parameter("scope"));
    assertEquals(SsoServer.url(SsoServer.CALLBACK_PATH), authorize.parameter(REDIRECT_URI));
    assertNotNull(authorize.parameter("state"));
    assertNotNull(authorize.parameter("nonce"), "nonces are on by default");
    assertNull(authorize.parameter(CODE_CHALLENGE), "PKCE is off by default");
  }

  @Test
  @DisplayName(
      "OC-05 PKCE, custom parameters, prompt and max_age reach the provider when configured")
  void configuredAuthorizationExtrasReachTheProvider(TestNamespace ns) throws Throwable {
    signInAs(ns, "extras");
    securityConfig.withVariant(
        config -> {
          oidcOf(config)
              .withDisablePkce(false)
              .withCustomParams(
                  Map.of("customParamKey1", "login_hint", "customParamValue1", "hint"))
              .withPrompt("login")
              .withMaxAge("3600");
          return config;
        },
        () -> {
          SsoNavigation navigation = login(new SsoBrowser());
          idTokenFrom(navigation);
          RecordedRequest authorize = provider.authorizeRequests().getFirst();
          assertEquals("S256", authorize.parameter("code_challenge_method"));
          assertNotNull(authorize.parameter(CODE_CHALLENGE));
          assertEquals("hint", authorize.parameter("login_hint"));
          assertEquals("login", authorize.parameter(PROMPT));
          assertEquals("3600", authorize.parameter("max_age"));
          assertNotNull(provider.tokenRequests().getFirst().parameter("code_verifier"));
        });
  }

  @Test
  @DisplayName("OC-06 a silent login the provider cannot satisfy lands on the sign-in page")
  void silentLoginWithoutAProviderSessionLandsOnSignIn() {
    provider.signOut();
    SsoBrowser browser = new SsoBrowser();

    SsoNavigation navigation = browser.navigate(SsoServer.loginUrl() + "&prompt=none");

    assertEquals("none", provider.authorizeRequests().getFirst().parameter(PROMPT));
    assertEquals(
        URI.create(SsoServer.url("/signin")), navigation.finalUrl(), navigation.describe());
  }

  @Test
  @DisplayName("OC-06 a configured prompt=login is not replaced by a silent request")
  void configuredLoginPromptWinsOverASilentRequest(TestNamespace ns) throws Throwable {
    signInAs(ns, "forced");
    securityConfig.withVariant(
        config -> {
          oidcOf(config).withPrompt("login");
          return config;
        },
        () -> {
          new SsoBrowser().navigate(SsoServer.loginUrl() + "&prompt=none");
          assertEquals("login", provider.authorizeRequests().getFirst().parameter(PROMPT));
        });
  }

  @Test
  @DisplayName("OC-14 client_secret_basic and client_secret_post authenticate as configured")
  void clientAuthenticationFollowsTheConfiguredMethod(TestNamespace ns) throws Throwable {
    signInAs(ns, "clientauth");
    loginWithClientAuthentication(ClientAuthenticationMethod.CLIENT_SECRET_BASIC);
    RecordedRequest basic = provider.tokenRequests().getLast();
    assertTrue(basic.authorization().startsWith("Basic "), "credentials go in the header");
    assertNull(basic.parameter("client_secret"));

    loginWithClientAuthentication(ClientAuthenticationMethod.CLIENT_SECRET_POST);
    RecordedRequest post = provider.tokenRequests().getLast();
    assertNull(post.authorization(), "credentials go in the body");
    assertEquals(MockOidcProvider.CLIENT_SECRET, post.parameter("client_secret"));
  }

  @Test
  @DisplayName("OC-20 signing in again on a browser revokes only the session it replaces")
  void signingInAgainRevokesOnlyTheReplacedSession(TestNamespace ns) {
    signInAs(ns, "again");
    SsoBrowser laptop = new SsoBrowser();
    SsoBrowser phone = new SsoBrowser();
    idTokenFrom(login(laptop));
    idTokenFrom(login(phone));
    String firstLaptopSession = laptop.cookies().value(SESSION_COOKIE).orElseThrow();

    idTokenFrom(login(laptop));

    assertEquals(SessionStatus.REVOKED, StoredSessions.require(firstLaptopSession).getStatus());
    requireActiveSession(laptop);
    requireActiveSession(phone);
  }

  @Test
  @DisplayName("OC-21 logout revokes the session locally and never calls the provider")
  void logoutRevokesTheSessionWithoutCallingTheProvider(TestNamespace ns) {
    signInAs(ns, "logout");
    SsoBrowser browser = new SsoBrowser();
    String idToken = idTokenFrom(login(browser));
    String sessionId = requireActiveSession(browser).getId();
    provider.clearJournal();

    assertEquals(405, browser.get(SsoServer.url(SsoServer.LOGOUT_PATH)).statusCode());
    HttpResponse<String> logout = browser.post(SsoServer.url(SsoServer.LOGOUT_PATH));

    assertEquals(302, logout.statusCode());
    assertEquals(
        SsoServer.url("/logout"), logout.headers().firstValue(MockHttp.LOCATION).orElseThrow());
    assertEquals(SessionStatus.REVOKED, StoredSessions.require(sessionId).getStatus());
    assertTrue(provider.requests().isEmpty(), "logout must not call the provider");
    assertEquals(
        200,
        loggedInUser(browser, idToken).statusCode(),
        "OC-27: the provider's ID token stays valid until it expires");
  }

  @Test
  @DisplayName(
      "OC-22 the session cookie is HttpOnly and Lax over http, None and Secure when forced")
  void sessionCookieAttributesFollowTheConfiguration(TestNamespace ns) throws Throwable {
    signInAs(ns, "cookie");
    String lax = sessionCookieSetBy(login(new SsoBrowser()));
    assertTrue(
        lax.contains("HttpOnly") && lax.contains("Path=/") && lax.contains("SameSite=Lax"), lax);
    assertFalse(lax.contains("Secure"), lax);

    securityConfig.withVariant(
        config -> {
          config.getAuthenticationConfiguration().withForceSecureSessionCookie(true);
          return config;
        },
        () -> {
          String forced = sessionCookieSetBy(login(new SsoBrowser()));
          assertTrue(forced.contains("SameSite=None") && forced.contains("Secure"), forced);
        });
  }

  @Test
  @DisplayName("OC-23 a first login takes the provider's display name and an http(s) picture")
  void firstLoginTakesTheProvidersDisplayNameAndPicture(TestNamespace ns) {
    String picture = "https://pictures.example.com/" + ns.uniqueShortId() + ".png";
    MockOidcIdentity carol =
        MockOidcIdentity.forEmail(ns.shortPrefix("carol") + EMAIL_DOMAIN)
            .withDisplayName("Carol Danvers")
            .withClaim("picture", picture);
    provider.signIn(carol);

    idTokenFrom(login(new SsoBrowser()));

    User user = userFor(carol);
    assertEquals("Carol Danvers", user.getDisplayName());
    assertEquals(URI.create(picture), user.getProfile().getImages().getImage());
  }

  @Test
  @DisplayName("OC-23 a picture claim that is not an http(s) address is ignored")
  void nonWebPictureClaimIsIgnored(TestNamespace ns) {
    MockOidcIdentity dave =
        MockOidcIdentity.forEmail(ns.shortPrefix("dave") + EMAIL_DOMAIN)
            .withClaim("picture", "javascript:alert(1)");
    provider.signIn(dave);

    idTokenFrom(login(new SsoBrowser()));

    User user = userFor(dave);
    assertTrue(
        user.getProfile() == null || user.getProfile().getImages() == null,
        "no picture may be stored from a non-web claim");
  }

  @Test
  @DisplayName("OC-24 the first logins of a new user from two browsers create one account")
  void concurrentFirstLoginsCreateOneAccount(TestNamespace ns) {
    MockOidcIdentity erin = signInAs(ns, "erin");
    SsoBrowser first = new SsoBrowser();
    SsoBrowser second = new SsoBrowser();
    // Both token exchanges are held until both logins reach them, so the two callbacks go on to
    // look the user up and create the account together. That makes the race likely rather than
    // certain; ConcurrentFirstOidcLoginTest covers the adoption itself.
    MockResponseGate firstExchange = provider.holdNextTokenResponse();
    MockResponseGate secondExchange = provider.holdNextTokenResponse();

    CompletableFuture<SsoNavigation> firstLogin = CompletableFuture.supplyAsync(() -> login(first));
    CompletableFuture<SsoNavigation> secondLogin =
        CompletableFuture.supplyAsync(() -> login(second));
    try {
      assertTrue(
          firstExchange.awaitArrival(TOKEN_EXCHANGE_ARRIVAL),
          "no login reached the token exchange");
      assertTrue(
          secondExchange.awaitArrival(SECOND_TOKEN_EXCHANGE_ARRIVAL),
          "the second login did not reach the token exchange before the first one's would time out");
    } finally {
      firstExchange.release();
      secondExchange.release();
    }

    idTokenFrom(firstLogin.join());
    idTokenFrom(secondLogin.join());
    assertEquals(requireActiveSession(first).getUserId(), requireActiveSession(second).getUserId());
    assertEquals(erin.email(), userFor(erin).getEmail());
  }

  @Test
  @DisplayName("OC-28 the server never calls the provider's userinfo endpoint")
  void serverNeverCallsUserinfo(TestNamespace ns) {
    signInAs(ns, "userinfo");

    idTokenFrom(login(new SsoBrowser()));

    assertTrue(provider.userinfoRequests().isEmpty(), "claims come only from the ID token");
  }

  private static void loginWithClientAuthentication(ClientAuthenticationMethod method)
      throws Throwable {
    securityConfig.withVariant(
        config -> {
          oidcOf(config).withClientAuthenticationMethod(method);
          return config;
        },
        () -> idTokenFrom(login(new SsoBrowser())));
  }

  private static MockOidcIdentity signInAs(TestNamespace ns, String name) {
    MockOidcIdentity identity = MockOidcIdentity.forEmail(ns.shortPrefix(name) + EMAIL_DOMAIN);
    provider.signIn(identity);
    return identity;
  }

  private static OidcClientConfig oidcOf(SecurityConfiguration config) {
    return config.getAuthenticationConfiguration().getOidcConfiguration();
  }

  private static User userFor(MockOidcIdentity identity) {
    String name = identity.email().substring(0, identity.email().indexOf('@'));
    return SdkClients.adminClient().users().getByName(name, "profile");
  }

  private static JsonNode loggedInUserJson(SsoBrowser browser, String idToken) {
    HttpResponse<String> response = loggedInUser(browser, idToken);
    assertEquals(200, response.statusCode(), response.body());
    return JsonUtils.readTree(response.body());
  }

  private static String sessionCookieSetBy(SsoNavigation navigation) {
    return navigation.hopTo(SsoServer.CALLBACK_PATH).orElseThrow().setCookies().stream()
        .filter(
            cookie ->
                cookie.startsWith(SESSION_COOKIE + "=")
                    && !cookie.startsWith(SESSION_COOKIE + "=;"))
        .findFirst()
        .orElseThrow(() -> new AssertionError("The callback set no session cookie"));
  }

  private static String loginReturningTo(String redirectUri) {
    return MockHttp.withQuery(
        SsoServer.url(SsoServer.LOGIN_PATH), Map.of("redirectUri", redirectUri));
  }

  private static String withoutFragment(SsoNavigation navigation) {
    String url = navigation.finalUrl().toString();
    return url.substring(0, url.indexOf('#'));
  }
}
