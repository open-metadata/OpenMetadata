package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeFalse;
import static org.openmetadata.it.sso.SsoFlows.ID_TOKEN;
import static org.openmetadata.it.sso.SsoFlows.assertCallbackRefused;
import static org.openmetadata.it.sso.SsoFlows.assertLoginRefused;
import static org.openmetadata.it.sso.SsoFlows.editQuery;
import static org.openmetadata.it.sso.SsoFlows.idTokenFrom;
import static org.openmetadata.it.sso.SsoFlows.login;
import static org.openmetadata.it.sso.SsoFlows.loginUpToCallback;

import java.net.URI;
import java.net.http.HttpResponse;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.sso.browser.SsoBrowser;
import org.openmetadata.it.sso.browser.SsoNavigation;
import org.openmetadata.it.sso.config.SecurityConfigSwap;
import org.openmetadata.it.sso.config.SsoConfigs;
import org.openmetadata.it.sso.config.SsoServer;
import org.openmetadata.it.sso.oidc.IdTokenDefect;
import org.openmetadata.it.sso.oidc.IssuerParameter;
import org.openmetadata.it.sso.oidc.MockOidcIdentity;
import org.openmetadata.it.sso.oidc.MockOidcProvider;
import org.openmetadata.it.util.OssTestServer;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;

/**
 * The confidential OIDC callback refuses everything that did not come from the login it started:
 * a missing session, a foreign state or nonce, a replay, a code-less front-channel token, and a
 * response from the wrong issuer.
 */
@Isolated
@Execution(ExecutionMode.SAME_THREAD)
@ExtendWith(TestNamespaceExtension.class)
class SsoOidcCallbackHardeningIT {
  private static final String EMAIL_DOMAIN = "@open-metadata.org";
  private static final String STATE_MISMATCH =
      "State parameter is different from the one sent in authentication request.";
  private static final String NONCE_MISMATCH = "Unexpected JWT nonce (nonce) claim";
  private static final String ISSUER_MISMATCH = "Issuer mismatch, possible mix-up attack.";

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
  @DisplayName("OC-08 a callback without the pending-session cookie lands on the sign-in page")
  void callbackWithoutThePendingSessionLandsOnSignIn(TestNamespace ns) {
    signInAs(ns, "nocookie");
    URI callback = loginUpToCallback(new SsoBrowser());
    SsoBrowser anotherBrowser = new SsoBrowser();

    SsoNavigation navigation = anotherBrowser.navigate(callback.toString());

    assertEquals(
        URI.create(SsoServer.url("/signin")), navigation.finalUrl(), navigation.describe());
    assertLoginRefused(anotherBrowser, navigation);
    assertTrue(provider.tokenRequests().isEmpty(), "the code must not be redeemed");
  }

  @Test
  @DisplayName("OC-09 a callback whose state differs from the login's is refused")
  void callbackWithAForeignStateIsRefused(TestNamespace ns) {
    signInAs(ns, "state");
    SsoBrowser browser = new SsoBrowser();
    URI callback = loginUpToCallback(browser);

    SsoNavigation navigation =
        browser.navigate(editQuery(callback, query -> query.put("state", "forged-state")));

    assertCallbackRefused(browser, navigation, STATE_MISMATCH);
    assertTrue(provider.tokenRequests().isEmpty(), "the code must not be redeemed");
  }

  @Test
  @DisplayName("OC-09 replaying a completed callback neither signs in again nor redeems the code")
  void replayedCallbackIsRefused(TestNamespace ns) {
    signInAs(ns, "replay");
    SsoBrowser browser = new SsoBrowser();
    URI callback = loginUpToCallback(browser);
    idTokenFrom(browser.navigate(callback.toString()));

    SsoNavigation replay = browser.navigate(callback.toString());

    assertEquals(URI.create(SsoServer.url("/signin")), replay.finalUrl(), replay.describe());
    assertTrue(replay.fragmentParameter(ID_TOKEN).isEmpty(), replay.describe());
    assertEquals(1, provider.tokenRequests().size(), "the code is redeemed exactly once");
  }

  @Test
  @DisplayName("OC-10 a callback that brings an ID token but no code is rejected")
  void callbackWithoutACodeIsRejected(TestNamespace ns) {
    MockOidcIdentity frank = signInAs(ns, "frank");
    SsoBrowser browser = new SsoBrowser();
    URI callback = loginUpToCallback(browser);
    String forgedToken = provider.issueIdToken(frank);

    HttpResponse<String> response =
        browser.get(
            editQuery(
                callback,
                query -> {
                  query.remove("code");
                  query.put(ID_TOKEN, forgedToken);
                }));

    assertEquals(400, response.statusCode(), response.body());
    assertTrue(provider.tokenRequests().isEmpty(), "nothing reached the token endpoint");
  }

  @Test
  @DisplayName("OC-11 an ID token whose nonce differs from the login's is refused")
  void idTokenWithAForeignNonceIsRefused(TestNamespace ns) {
    signInAs(ns, "nonce");
    provider.defectNextIdToken(IdTokenDefect.WRONG_NONCE);
    SsoBrowser browser = new SsoBrowser();

    SsoNavigation navigation = login(browser);

    assertCallbackRefused(browser, navigation, NONCE_MISMATCH);
  }

  @Test
  @DisplayName("OC-13 a provider that advertises the iss parameter must send its own issuer")
  void issuerParameterMustNameTheProvider(TestNamespace ns) throws Throwable {
    signInAs(ns, "issuer");
    assertIssuerParameter(IssuerParameter.CORRECT, true);
    assertIssuerParameter(IssuerParameter.WRONG, false);
    assertIssuerParameter(IssuerParameter.OMITTED, false);
  }

  private static void assertIssuerParameter(IssuerParameter mode, boolean isAccepted)
      throws Throwable {
    provider.useIssuerParameter(mode);
    // The handler reads the discovery document when it is built, so rebuild it under the mode, and
    // reset the mode before the baseline is re-applied so later tests see the plain document.
    securityConfig.withVariant(
        config -> config,
        () -> {
          try {
            SsoBrowser browser = new SsoBrowser();
            SsoNavigation navigation = login(browser);
            if (isAccepted) {
              idTokenFrom(navigation);
            } else {
              assertCallbackRefused(browser, navigation, ISSUER_MISMATCH);
            }
          } finally {
            provider.useIssuerParameter(IssuerParameter.NOT_ADVERTISED);
          }
        });
  }

  private static MockOidcIdentity signInAs(TestNamespace ns, String name) {
    MockOidcIdentity identity = MockOidcIdentity.forEmail(ns.shortPrefix(name) + EMAIL_DOMAIN);
    provider.signIn(identity);
    return identity;
  }
}
