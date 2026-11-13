/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeFalse;
import static org.openmetadata.it.sso.SsoFlows.requireActiveSession;

import com.onelogin.saml2.util.Util;
import java.io.File;
import java.net.URI;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.security.cert.Certificate;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
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
import org.openmetadata.it.sso.browser.SsoBrowser;
import org.openmetadata.it.sso.config.SecurityConfigSwap;
import org.openmetadata.it.sso.config.SecurityConfigSwap.Answer;
import org.openmetadata.it.sso.config.SsoConfigs;
import org.openmetadata.it.sso.config.SsoServer;
import org.openmetadata.it.util.OssTestServer;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.configuration.SecurityConfiguration;
import org.openmetadata.schema.system.SecurityValidationResponse;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.security.saml.MockSamlIdp;

/**
 * A SAML login completes only in the browser that both started it and delivered the identity
 * provider's answer, and only with the answer to that login's own request
 * (ADR:2026-11-03-a-saml-login-completes-in-the-browser-that-started-it).
 */
@Isolated
@Execution(ExecutionMode.SAME_THREAD)
@ExtendWith(TestNamespaceExtension.class)
class SsoSamlLoginIT {
  private static final String IDP_ENTITY_ID = "https://idp.saml-it.invalid";
  private static final String SP_ENTITY_ID = "openmetadata-saml-it";
  private static final String SESSION_COOKIE = "OM_SESSION";
  private static final int CONCURRENT_FIRST_LOGIN_ATTEMPTS = 5;

  private static MockSamlIdp idp;
  private static SecurityConfigSwap securityConfig;

  /** A login started at the server: what the browser carries to the IdP and back. */
  private record PendingSamlLogin(String relayState, String requestId) {}

  @BeforeAll
  static void pointTheServerAtTheMockIdentityProvider() {
    assumeFalse(OssTestServer.isExternalMode(), "Reconfigures the embedded server's SSO");
    idp = new MockSamlIdp(IDP_ENTITY_ID);
    securityConfig = SecurityConfigSwap.snapshotLiveConfig();
    securityConfig.applyBaseline(
        SsoConfigs.saml(
            securityConfig.originalCopy(), IDP_ENTITY_ID, idp.idpCertificatePem(), SP_ENTITY_ID));
  }

  @AfterAll
  static void restoreTheLiveConfiguration() {
    if (securityConfig != null) {
      securityConfig.close();
    }
  }

  @Test
  void theBrowserThatStartedAndAnsweredALoginCompletesIt(TestNamespace ns) {
    SsoBrowser browser = new SsoBrowser();
    PendingSamlLogin login = startLogin(browser);
    String response =
        idp.signedResponse(email(ns, "self"), acsUrl(), SP_ENTITY_ID, login.requestId());

    HttpResponse<String> acs = postToAcs(browser, response, login.relayState());
    assertEquals(303, acs.statusCode(), acs.body());

    HttpResponse<String> completed = browser.get(location(acs));
    assertEquals(302, completed.statusCode(), completed.body());
    assertTrue(location(completed).contains("id_token="), location(completed));
  }

  @Test
  void aLoginAnsweredInAnotherBrowserSignsNobodyIn(TestNamespace ns) {
    SsoBrowser starter = new SsoBrowser();
    PendingSamlLogin login = startLogin(starter);
    String response =
        idp.signedResponse(email(ns, "starter"), acsUrl(), SP_ENTITY_ID, login.requestId());

    SsoBrowser other = new SsoBrowser();
    HttpResponse<String> acs = postToAcs(other, response, login.relayState());

    assertEquals(303, acs.statusCode(), acs.body());
    assertEquals(
        SsoServer.SAML_COMPLETE_PATH, URI.create(location(acs)).getPath(), "ACS hands off");
    assertTrue(other.cookies().value(SESSION_COOKIE).isEmpty(), "No session for the poster");
    assertEquals(401, other.get(location(acs)).statusCode(), "The poster lacks the cookie");
    assertEquals(
        401,
        starter.get(SsoServer.url(SsoServer.SAML_COMPLETE_PATH)).statusCode(),
        "The starter lacks the code");
  }

  @Test
  void aResponseToAnotherLoginsRequestIsRefused(TestNamespace ns) {
    SsoBrowser browser = new SsoBrowser();
    PendingSamlLogin login = startLogin(browser);
    PendingSamlLogin otherLogin = startLogin(new SsoBrowser());
    String response =
        idp.signedResponse(email(ns, "crossed"), acsUrl(), SP_ENTITY_ID, otherLogin.requestId());

    HttpResponse<String> acs = postToAcs(browser, response, login.relayState());

    assertEquals(401, acs.statusCode(), acs.body());
  }

  @Test
  void anUnsolicitedResponseIsRefused(TestNamespace ns) {
    SsoBrowser browser = new SsoBrowser();
    PendingSamlLogin login = startLogin(browser);
    String response = idp.signedResponse(email(ns, "unsolicited"), acsUrl(), SP_ENTITY_ID);

    HttpResponse<String> acs = postToAcs(browser, response, login.relayState());

    assertEquals(401, acs.statusCode(), acs.body());
  }

  @Test
  @DisplayName("SA-03 a response the identity provider did not sign as it stands is refused")
  void responsesWithABrokenSignatureAreRefused(TestNamespace ns) throws Throwable {
    SsoBrowser browser = new SsoBrowser();
    PendingSamlLogin edited = startLogin(browser);
    String signed =
        idp.signedResponse(email(ns, "edited"), acsUrl(), SP_ENTITY_ID, edited.requestId());
    assertRefusedWithoutAServerError(
        postToAcs(browser, editedAfterSigning(signed, email(ns, "edited")), edited.relayState()),
        401);

    PendingSamlLogin wrapped = startLogin(browser);
    String original =
        idp.signedResponse(email(ns, "wrapped"), acsUrl(), SP_ENTITY_ID, wrapped.requestId());
    assertRefusedWithoutAServerError(
        postToAcs(
            browser,
            withAnUnsignedAssertionAdded(original, email(ns, "wrapped")),
            wrapped.relayState()),
        401);

    String foreignCertificate = certificateTheIdentityProviderDoesNotHold();
    securityConfig.withVariant(
        config -> {
          config
              .getAuthenticationConfiguration()
              .getSamlConfiguration()
              .getIdp()
              .withIdpX509Certificate(foreignCertificate);
          return config;
        },
        () -> {
          PendingSamlLogin untrusted = startLogin(browser);
          String response =
              idp.signedResponse(
                  email(ns, "untrusted"), acsUrl(), SP_ENTITY_ID, untrusted.requestId());
          assertRefusedWithoutAServerError(
              postToAcs(browser, response, untrusted.relayState()), 401);
        });
  }

  @Test
  @DisplayName("SA-17 a response that is not a SAML response is refused as a bad request")
  void malformedResponsesAreRefusedAsBadRequests() {
    SsoBrowser browser = new SsoBrowser();
    for (String malformed :
        List.of(
            "not base64 at all",
            Base64.getEncoder().encodeToString("<not-xml".getBytes(StandardCharsets.UTF_8)),
            Base64.getEncoder()
                .encodeToString("<html><body>hi</body></html>".getBytes(StandardCharsets.UTF_8)))) {
      PendingSamlLogin login = startLogin(browser);
      assertRefusedWithoutAServerError(postToAcs(browser, malformed, login.relayState()), 400);
    }
  }

  @Test
  @DisplayName("SA-11 signing the service provider's metadata without its keys is refused at save")
  void signingTheMetadataWithoutKeysIsRefusedAtSave() {
    SecurityConfiguration candidate = securityConfig.baselineCopy();
    candidate
        .getAuthenticationConfiguration()
        .getSamlConfiguration()
        .getSecurity()
        .withSignSpMetadata(true);
    try {
      Answer put = SecurityConfigSwap.attemptPut(candidate);
      assertEquals(400, put.status(), "saved without keys: " + put.body());
      Answer patch =
          SecurityConfigSwap.attemptPatch(
              "[{\"op\":\"add\",\"path\":\"/authenticationConfiguration/samlConfiguration"
                  + "/security/signSpMetadata\",\"value\":true}]");
      assertEquals(400, patch.status(), "patched in without keys: " + patch.body());
      Answer validate = SecurityConfigSwap.attemptValidate(candidate);
      assertEquals(200, validate.status(), validate.body());
      assertEquals(
          SecurityValidationResponse.Status.FAILED,
          JsonUtils.readValue(validate.body(), SecurityValidationResponse.class).getStatus(),
          validate.body());
    } finally {
      securityConfig.restoreBaseline();
    }
  }

  @Test
  @DisplayName("the first SAML logins of a new user from two browsers create one account")
  void concurrentFirstLoginsCreateOneAccount(TestNamespace ns) {
    for (int attempt = 0; attempt < CONCURRENT_FIRST_LOGIN_ATTEMPTS; attempt++) {
      String email = email(ns, "twin" + attempt);
      SsoBrowser first = new SsoBrowser();
      SsoBrowser second = new SsoBrowser();
      PendingSamlLogin firstLogin = startLogin(first);
      PendingSamlLogin secondLogin = startLogin(second);
      String firstResponse =
          idp.signedResponse(email, acsUrl(), SP_ENTITY_ID, firstLogin.requestId());
      String secondResponse =
          idp.signedResponse(email, acsUrl(), SP_ENTITY_ID, secondLogin.requestId());

      // Both posts wait at one latch, so the two ACS requests look the new user up together.
      CountDownLatch go = new CountDownLatch(1);
      CompletableFuture<HttpResponse<String>> firstAcs =
          CompletableFuture.supplyAsync(
              () -> postWhenReleased(go, first, firstResponse, firstLogin.relayState()));
      CompletableFuture<HttpResponse<String>> secondAcs =
          CompletableFuture.supplyAsync(
              () -> postWhenReleased(go, second, secondResponse, secondLogin.relayState()));
      go.countDown();

      completeLogin(first, firstAcs.join());
      completeLogin(second, secondAcs.join());
      assertEquals(
          requireActiveSession(first).getUserId(),
          requireActiveSession(second).getUserId(),
          "both browsers must sign in to one account for " + email);
    }
  }

  private static HttpResponse<String> postWhenReleased(
      CountDownLatch go, SsoBrowser browser, String response, String relayState) {
    try {
      if (!go.await(30, TimeUnit.SECONDS)) {
        throw new IllegalStateException("the concurrent logins were never released");
      }
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new IllegalStateException(e);
    }
    return postToAcs(browser, response, relayState);
  }

  private static void completeLogin(SsoBrowser browser, HttpResponse<String> acs) {
    assertEquals(303, acs.statusCode(), acs.body());
    HttpResponse<String> completed = browser.get(location(acs));
    assertEquals(302, completed.statusCode(), completed.body());
    assertTrue(location(completed).contains("id_token="), location(completed));
  }

  private static void assertRefusedWithoutAServerError(
      HttpResponse<String> acs, int expectedStatus) {
    assertEquals(expectedStatus, acs.statusCode(), acs.body());
    assertTrue(location(acs).isEmpty(), "a refused response must not hand off a login");
    assertFalse(acs.body().contains("Exception"), "no server detail: " + acs.body());
  }

  /** The signed response with the subject's address changed, which breaks its signature. */
  private static String editedAfterSigning(String signedResponse, String signedEmail) {
    String xml = new String(Base64.getDecoder().decode(signedResponse), StandardCharsets.UTF_8);
    String edited = xml.replace(signedEmail, "admin@open-metadata.org");
    return Base64.getEncoder().encodeToString(edited.getBytes(StandardCharsets.UTF_8));
  }

  /**
   * The signed response with a second, unsigned assertion for another subject next to the signed
   * one, the shape of a signature-wrapping attempt.
   */
  private static String withAnUnsignedAssertionAdded(String signedResponse, String signedEmail) {
    String xml = new String(Base64.getDecoder().decode(signedResponse), StandardCharsets.UTF_8);
    int start = xml.indexOf("<saml:Assertion");
    int end = xml.indexOf("</saml:Assertion>") + "</saml:Assertion>".length();
    String unsignedCopy =
        xml.substring(start, end)
            .replace(signedEmail, "admin@open-metadata.org")
            .replaceFirst("ID=\"[^\"]+\"", "ID=\"_wrapped\"");
    String wrapped = xml.substring(0, start) + unsignedCopy + xml.substring(start);
    return Base64.getEncoder().encodeToString(wrapped.getBytes(StandardCharsets.UTF_8));
  }

  /** A real certificate that is not the mock identity provider's: the JDK's first trusted CA. */
  private static String certificateTheIdentityProviderDoesNotHold() throws Exception {
    File trustStore = new File(System.getProperty("java.home"), "lib/security/cacerts");
    KeyStore keyStore = KeyStore.getInstance(trustStore, (char[]) null);
    List<String> aliases = new ArrayList<>(Collections.list(keyStore.aliases()));
    Certificate certificate = keyStore.getCertificate(aliases.getFirst());
    return "-----BEGIN CERTIFICATE-----\n"
        + Base64.getMimeEncoder(64, "\n".getBytes(StandardCharsets.US_ASCII))
            .encodeToString(certificate.getEncoded())
        + "\n-----END CERTIFICATE-----";
  }

  private static PendingSamlLogin startLogin(SsoBrowser browser) {
    HttpResponse<String> login =
        browser.get(
            MockHttp.withQuery(
                SsoServer.url(SsoServer.SAML_LOGIN_PATH),
                Map.of("callback", SsoServer.url(SsoServer.SPA_CALLBACK_PATH))));
    assertEquals(302, login.statusCode(), login.body());
    Map<String, String> query = MockHttp.decode(URI.create(location(login)).getRawQuery());
    String authnRequest = Util.base64decodedInflated(query.get("SAMLRequest"));
    String requestId = Util.loadXML(authnRequest).getDocumentElement().getAttribute("ID");
    return new PendingSamlLogin(query.get("RelayState"), requestId);
  }

  private static HttpResponse<String> postToAcs(
      SsoBrowser browser, String samlResponse, String relayState) {
    return browser.postForm(
        acsUrl(), Map.of("SAMLResponse", samlResponse, "RelayState", relayState));
  }

  private static String acsUrl() {
    return SsoServer.url(SsoServer.SAML_ACS_PATH);
  }

  private static String email(TestNamespace ns, String base) {
    return ns.shortPrefix(base) + "@open-metadata.org";
  }

  private static String location(HttpResponse<String> response) {
    return response.headers().firstValue("Location").orElse("");
  }
}
