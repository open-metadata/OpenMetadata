package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeFalse;
import static org.openmetadata.it.sso.SsoFlows.idTokenFrom;
import static org.openmetadata.it.sso.SsoFlows.loggedInUser;
import static org.openmetadata.it.sso.SsoFlows.login;
import static org.openmetadata.it.sso.SsoFlows.loginUpToCallback;
import static org.openmetadata.it.sso.SsoFlows.requireActiveSession;
import static org.openmetadata.it.sso.SsoFlows.sessionId;

import com.fasterxml.jackson.databind.JsonNode;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
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
import org.openmetadata.it.sso.MockRequestJournal.RecordedRequest;
import org.openmetadata.it.sso.MockResponseGate;
import org.openmetadata.it.sso.browser.SsoBrowser;
import org.openmetadata.it.sso.config.SecurityConfigSwap;
import org.openmetadata.it.sso.config.SsoConfigs;
import org.openmetadata.it.sso.config.SsoServer;
import org.openmetadata.it.sso.oidc.MockOidcIdentity;
import org.openmetadata.it.sso.oidc.MockOidcProvider;
import org.openmetadata.it.sso.oidc.RefreshOutcome;
import org.openmetadata.it.sso.state.SessionStateInjector;
import org.openmetadata.it.sso.state.StoredSessions;
import org.openmetadata.it.util.OssTestServer;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.security.session.SessionStatus;

/**
 * Renewing a confidential-client session: each {@code /auth/refresh} redeems the provider refresh
 * token the session keeps for the provider's next ID token. What the provider answers decides
 * whether the session lives on (renewed), ends (rejected) or waits (no verdict).
 */
@Isolated
@Execution(ExecutionMode.SAME_THREAD)
@ExtendWith(TestNamespaceExtension.class)
class SsoTokenRenewalIT {
  private static final String EMAIL_DOMAIN = "@open-metadata.org";
  private static final String REFRESH_TOKEN = "refresh_token";
  private static final String GRANT_TYPE = "grant_type";
  private static final String SESSION_REVOKED = "Session revoked";
  private static final String NO_ACTIVE_SESSION = "No active session";
  private static final Duration HELD_RESPONSE_ARRIVAL = Duration.ofSeconds(10);

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
  void renewNormally() {
    provider.answerRefreshesWith(RefreshOutcome.renew());
    provider.clearJournal();
  }

  @Test
  @DisplayName("RN-01 a refresh hands the browser the provider's next ID token")
  void refreshReturnsTheProvidersNextIdToken(TestNamespace ns) {
    SsoBrowser browser = loggedInBrowser(ns, "renew");

    HttpResponse<String> refresh = refresh(browser);

    assertEquals(200, refresh.statusCode(), refresh.body());
    JsonNode body = JsonUtils.readTree(refresh.body());
    assertEquals(provider.lastIssuedIdToken(), body.get("accessToken").asText());
    assertEquals("Bearer", body.get("tokenType").asText());
    assertTrue(body.get("expiryDuration").asLong() > System.currentTimeMillis());
    assertEquals(1, refreshGrants().size(), "one refresh_token grant per refresh");
    assertEquals(200, loggedInUser(browser, body.get("accessToken").asText()).statusCode());
    assertEquals(200, browser.post(SsoServer.url(SsoServer.REFRESH_PATH)).statusCode());
  }

  @Test
  @DisplayName("RN-02 a rotated refresh token is the one the next refresh redeems")
  void rotatedRefreshTokenIsRedeemedNext(TestNamespace ns) {
    SsoBrowser browser = loggedInBrowser(ns, "rotate");
    provider.answerRefreshesWith(RefreshOutcome.rotateRefreshToken());

    assertEquals(200, refresh(browser).statusCode());
    assertEquals(200, refresh(browser).statusCode());

    List<RecordedRequest> grants = refreshGrants();
    assertNotEquals(grants.get(0).parameter(REFRESH_TOKEN), grants.get(1).parameter(REFRESH_TOKEN));
  }

  @Test
  @DisplayName("RN-02 a refresh token the provider keeps is redeemed again")
  void keptRefreshTokenIsRedeemedAgain(TestNamespace ns) {
    SsoBrowser browser = loggedInBrowser(ns, "keep");

    assertEquals(200, refresh(browser).statusCode());
    assertEquals(200, refresh(browser).statusCode());

    List<RecordedRequest> grants = refreshGrants();
    assertEquals(grants.get(0).parameter(REFRESH_TOKEN), grants.get(1).parameter(REFRESH_TOKEN));
  }

  @Test
  @DisplayName("RN-03 a refresh token the provider rejects ends the session")
  void rejectedRefreshTokenEndsTheSession(TestNamespace ns) {
    for (String verdict : List.of("invalid_grant", "invalid_token")) {
      SsoBrowser browser = loggedInBrowser(ns, verdict.replace('_', '-'));
      String sessionId = sessionId(browser).orElseThrow();
      provider.answerRefreshesWith(RefreshOutcome.reject(verdict));

      assertEquals(401, refresh(browser).statusCode(), verdict);

      assertEquals(SessionStatus.REVOKED, StoredSessions.require(sessionId).getStatus(), verdict);
      HttpResponse<String> again = refresh(browser);
      assertEquals(401, again.statusCode());
      assertTrue(isSessionGoneMessage(again.body()), again.body());
      provider.answerRefreshesWith(RefreshOutcome.renew());
    }
  }

  @Test
  @DisplayName("RN-04 a provider that gives no verdict keeps the session for a later refresh")
  void providerWithoutAVerdictKeepsTheSession(TestNamespace ns) {
    List<RefreshOutcome> noVerdicts =
        List.of(
            RefreshOutcome.serverError(),
            RefreshOutcome.gatewayErrorPage(),
            RefreshOutcome.reject("unauthorized_client"));
    for (RefreshOutcome noVerdict : noVerdicts) {
      SsoBrowser browser = loggedInBrowser(ns, "no-verdict");
      provider.answerRefreshesWith(noVerdict);

      HttpResponse<String> refused = refresh(browser);

      assertEquals(503, refused.statusCode(), noVerdict + ": " + refused.body());
      requireActiveSession(browser);
      provider.answerRefreshesWith(RefreshOutcome.renew());
      assertEquals(200, refresh(browser).statusCode(), "renews once the provider answers");
    }
  }

  @Test
  @DisplayName("RN-04 a provider that does not answer in time keeps the session")
  void providerThatTimesOutKeepsTheSession(TestNamespace ns) {
    SsoBrowser browser = loggedInBrowser(ns, "timeout");
    MockResponseGate gate = provider.holdNextTokenResponse();
    try {
      HttpResponse<String> refused = refresh(browser);

      assertEquals(503, refused.statusCode(), refused.body());
      requireActiveSession(browser);
    } finally {
      gate.release();
    }
  }

  @Test
  @DisplayName("RN-05 an invalid_client answer is a 503 that keeps the session")
  void invalidClientKeepsTheSession(TestNamespace ns) {
    SsoBrowser browser = loggedInBrowser(ns, "invalid-client");
    provider.answerRefreshesWith(RefreshOutcome.reject("invalid_client"));

    assertEquals(503, refresh(browser).statusCode());
    requireActiveSession(browser);
  }

  @Test
  @DisplayName("RN-06 a renewal without a usable ID token ends the session")
  void renewalWithoutAUsableIdTokenEndsTheSession(TestNamespace ns) {
    List<RefreshOutcome> unusable =
        List.of(
            RefreshOutcome.renewWithoutIdToken(),
            RefreshOutcome.renewWithIdTokenValidFor(Duration.ofSeconds(30)));
    for (RefreshOutcome outcome : unusable) {
      SsoBrowser browser = loggedInBrowser(ns, "unusable");
      String sessionId = sessionId(browser).orElseThrow();
      provider.answerRefreshesWith(outcome);

      assertEquals(401, refresh(browser).statusCode(), outcome.toString());
      assertEquals(SessionStatus.REVOKED, StoredSessions.require(sessionId).getStatus());
      provider.answerRefreshesWith(RefreshOutcome.renew());
    }
  }

  @Test
  @DisplayName("RN-06 a provider that issued no refresh token leaves nothing to renew")
  void loginWithoutAProviderRefreshTokenCannotRenew(TestNamespace ns) throws Throwable {
    securityConfig.withVariant(
        config -> {
          config
              .getAuthenticationConfiguration()
              .getOidcConfiguration()
              .withScope("openid email profile");
          return config;
        },
        () -> {
          SsoBrowser browser = loggedInBrowser(ns, "no-refresh-token");

          assertEquals(401, refresh(browser).statusCode());
          assertTrue(refreshGrants().isEmpty(), "nothing was sent to the provider");
        });
  }

  @Test
  @DisplayName("RN-07 an expired OpenMetadata refresh token or session ends the session")
  void expiredRefreshTokenOrSessionEndsTheSession(TestNamespace ns) {
    SsoBrowser expiredToken = loggedInBrowser(ns, "expired-token");
    SessionStateInjector.expireOmRefreshToken(sessionId(expiredToken).orElseThrow());
    assertEquals(401, refresh(expiredToken).statusCode());

    SsoBrowser expiredSession = loggedInBrowser(ns, "expired-session");
    SessionStateInjector.expireAbsolutely(sessionId(expiredSession).orElseThrow());
    assertEquals(401, refresh(expiredSession).statusCode());

    SsoBrowser idleSession = loggedInBrowser(ns, "idle-session");
    SessionStateInjector.expireIdle(sessionId(idleSession).orElseThrow());
    assertEquals(401, refresh(idleSession).statusCode());
  }

  @Test
  @DisplayName("RN-07 a refresh never extends the session's absolute expiry")
  void refreshNeverExtendsTheAbsoluteExpiry(TestNamespace ns) {
    SsoBrowser browser = loggedInBrowser(ns, "absolute");
    Long expiresAt = requireActiveSession(browser).getExpiresAt();

    assertEquals(200, refresh(browser).statusCode());

    assertEquals(expiresAt, requireActiveSession(browser).getExpiresAt());
  }

  @Test
  @DisplayName("RN-08 two refreshes of one session at once redeem the provider token once")
  void concurrentRefreshesRedeemTheProviderTokenOnce(TestNamespace ns) {
    SsoBrowser browser = loggedInBrowser(ns, "concurrent");
    MockResponseGate gate = provider.holdNextTokenResponse();
    CompletableFuture<HttpResponse<String>> first =
        CompletableFuture.supplyAsync(() -> refresh(browser));
    try {
      assertTrue(
          gate.awaitArrival(HELD_RESPONSE_ARRIVAL), "the first refresh reached the provider");

      HttpResponse<String> second = refresh(browser);

      assertEquals(503, second.statusCode(), second.body());
      assertTrue(second.headers().firstValue("Retry-After").isPresent(), "tells the tab when");
    } finally {
      gate.release();
    }
    assertEquals(200, first.join().statusCode());
    assertEquals(1, refreshGrants().size(), "the provider refresh token is redeemed once");
  }

  @Test
  @DisplayName("RN-09 a refresh without a live session says so and keeps a pending login")
  void refreshWithoutALiveSession(TestNamespace ns) {
    HttpResponse<String> noCookie = refresh(new SsoBrowser());
    assertEquals(401, noCookie.statusCode());
    assertTrue(noCookie.body().contains(NO_ACTIVE_SESSION), noCookie.body());

    signInAs(ns, "pending");
    SsoBrowser midLogin = new SsoBrowser();
    loginUpToCallback(midLogin);
    String pendingSession = sessionId(midLogin).orElseThrow();

    assertEquals(401, refresh(midLogin).statusCode());
    assertEquals(pendingSession, sessionId(midLogin).orElseThrow(), "the pending login survives");
  }

  @Test
  @DisplayName("RN-12 a refresh lease left by a crashed refresh does not block the next one")
  void staleRefreshLeaseDoesNotBlock(TestNamespace ns) {
    SsoBrowser browser = loggedInBrowser(ns, "stale-lease");
    SessionStateInjector.leaveStaleRefreshLease(sessionId(browser).orElseThrow());

    assertEquals(200, refresh(browser).statusCode());
  }

  @Test
  @DisplayName("RN-16 a refresh after the provider changed ends the session instead of looping")
  void refreshAfterTheProviderChangedEndsTheSession(TestNamespace ns) throws Throwable {
    SsoBrowser browser = loggedInBrowser(ns, "switched");
    String sessionId = sessionId(browser).orElseThrow();

    securityConfig.withVariant(
        config -> securityConfig.originalCopy(),
        () -> {
          HttpResponse<String> response = refresh(browser);
          assertEquals(401, response.statusCode(), response.body());
          assertTrue(response.body().contains(SESSION_REVOKED), "the app signs out on this answer");
          assertEquals(SessionStatus.REVOKED, StoredSessions.require(sessionId).getStatus());
        });
  }

  private static SsoBrowser loggedInBrowser(TestNamespace ns, String name) {
    signInAs(ns, name);
    SsoBrowser browser = new SsoBrowser();
    idTokenFrom(login(browser));
    requireActiveSession(browser);
    provider.clearJournal();
    return browser;
  }

  private static void signInAs(TestNamespace ns, String name) {
    provider.signIn(MockOidcIdentity.forEmail(ns.shortPrefix(name) + EMAIL_DOMAIN));
  }

  private static HttpResponse<String> refresh(SsoBrowser browser) {
    return browser.get(SsoServer.url(SsoServer.REFRESH_PATH));
  }

  private static List<RecordedRequest> refreshGrants() {
    return provider.tokenRequests().stream()
        .filter(request -> REFRESH_TOKEN.equals(request.parameter(GRANT_TYPE)))
        .toList();
  }

  private static boolean isSessionGoneMessage(String body) {
    return body.contains(SESSION_REVOKED) || body.contains(NO_ACTIVE_SESSION);
  }
}
