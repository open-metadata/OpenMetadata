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
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeFalse;

import com.onelogin.saml2.util.Util;
import java.net.URI;
import java.net.http.HttpResponse;
import java.util.Map;
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
