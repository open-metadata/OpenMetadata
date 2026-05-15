/*
 *  Copyright 2025 Collate
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

package org.openmetadata.service.security.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.onelogin.saml2.Auth;
import com.onelogin.saml2.settings.Saml2Settings;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.ws.rs.core.Response;
import java.util.Arrays;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * Unit tests for {@link TestSamlHandler}. Covers input validation, helper
 * methods (settings construction, attribute flattening, server URL derivation),
 * and error paths in the callback. SAML round-trip with a real IdP is covered
 * by integration tests.
 */
class TestSamlHandlerTest {

  private static final String IDP_ENTITY_ID = "https://idp.example.com/entity";
  private static final String IDP_SSO_URL = "https://idp.example.com/sso";
  // Minimal fake X.509 cert string (content not validated in settings construction)
  private static final String IDP_CERT =
      "-----BEGIN CERTIFICATE-----\nMIIFake==\n-----END CERTIFICATE-----";

  // ---------- handleInitiate: validation branches ----------

  @Test
  void handleInitiate_missingIdpEntityId_returnsHtmlError() {
    HttpServletRequest req = mock(HttpServletRequest.class);
    Response resp =
        TestSamlHandler.handleInitiate(req, null, null, IDP_SSO_URL, IDP_CERT, null, null, null);

    assertEquals(400, resp.getStatus());
    assertTrue(((String) resp.getEntity()).contains("IdP Entity ID is required"));
  }

  @Test
  void handleInitiate_missingIdpSsoLoginUrl_returnsHtmlError() {
    HttpServletRequest req = mock(HttpServletRequest.class);
    Response resp =
        TestSamlHandler.handleInitiate(req, null, IDP_ENTITY_ID, null, IDP_CERT, null, null, null);

    assertEquals(400, resp.getStatus());
    assertTrue(((String) resp.getEntity()).contains("IdP SSO Login URL is required"));
  }

  @Test
  void handleInitiate_missingIdpX509Certificate_returnsHtmlError() {
    HttpServletRequest req = mock(HttpServletRequest.class);
    Response resp =
        TestSamlHandler.handleInitiate(
            req, null, IDP_ENTITY_ID, IDP_SSO_URL, null, null, null, null);

    assertEquals(400, resp.getStatus());
    assertTrue(((String) resp.getEntity()).contains("IdP X.509 Certificate is required"));
  }

  // ---------- handleCallback: validation branches ----------

  @Test
  void handleCallback_missingRelayState_returnsPostMessageError() {
    HttpServletRequest req = mock(HttpServletRequest.class);
    when(req.getParameter("RelayState")).thenReturn(null);

    Response resp = TestSamlHandler.handleCallback(req);

    String body = (String) resp.getEntity();
    assertTrue(body.contains("Missing or invalid RelayState"));
  }

  @Test
  void handleCallback_wrongPrefix_returnsPostMessageError() {
    HttpServletRequest req = mock(HttpServletRequest.class);
    when(req.getParameter("RelayState")).thenReturn("some-other-prefix:uuid");

    Response resp = TestSamlHandler.handleCallback(req);

    String body = (String) resp.getEntity();
    assertTrue(body.contains("Missing or invalid RelayState"));
  }

  @Test
  void handleCallback_relayStateNotInMap_returnsPostMessageError() {
    HttpServletRequest req = mock(HttpServletRequest.class);
    when(req.getParameter("RelayState"))
        .thenReturn(TestSamlHandler.RELAY_STATE_PREFIX + "never-added");

    Response resp = TestSamlHandler.handleCallback(req);

    String body = (String) resp.getEntity();
    assertTrue(body.contains("expired or already consumed"));
  }

  // ---------- buildSamlSettings ----------

  @Test
  void buildSamlSettings_populatesIdpFields() {
    Saml2Settings settings =
        TestSamlHandler.buildSamlSettings(
            IDP_ENTITY_ID,
            IDP_SSO_URL,
            IDP_CERT,
            "http://localhost:8585",
            "http://localhost:8585/callback",
            "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress");

    assertEquals(IDP_ENTITY_ID, settings.getIdpEntityId());
    assertEquals(IDP_SSO_URL, settings.getIdpSingleSignOnServiceUrl().toString());
    assertEquals("http://localhost:8585", settings.getSpEntityId());
    assertEquals(
        "http://localhost:8585/callback", settings.getSpAssertionConsumerServiceUrl().toString());
  }

  @Test
  void buildSamlSettings_emailNameIdFormat() {
    Saml2Settings settings =
        TestSamlHandler.buildSamlSettings(
            IDP_ENTITY_ID,
            IDP_SSO_URL,
            IDP_CERT,
            "http://localhost:8585",
            "http://localhost:8585/callback",
            "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress");

    assertEquals(
        "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress", settings.getSpNameIDFormat());
  }

  @Test
  void buildSamlSettings_strictModeDisabledForTestLogin() {
    Saml2Settings settings =
        TestSamlHandler.buildSamlSettings(
            IDP_ENTITY_ID,
            IDP_SSO_URL,
            IDP_CERT,
            "http://localhost:8585",
            "http://localhost:8585/callback",
            "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress");

    // Test Login does not sign AuthnRequests — verify security flags are off.
    assertFalse(settings.getAuthnRequestsSigned());
    assertFalse(settings.getWantMessagesSigned());
    assertFalse(settings.getWantAssertionsSigned());
    assertFalse(settings.isStrict());
  }

  // ---------- buildClaimsFromAuth ----------

  @Test
  void buildClaimsFromAuth_flattensSingleValueAttributes() {
    Auth auth = mock(Auth.class);
    when(auth.getNameId()).thenReturn("alice@company.com");
    Map<String, List<String>> attrs = new LinkedHashMap<>();
    attrs.put("email", Collections.singletonList("alice@company.com"));
    attrs.put("displayName", Collections.singletonList("Alice"));
    when(auth.getAttributes()).thenReturn(attrs);

    Map<String, Object> claims = TestSamlHandler.buildClaimsFromAuth(auth);

    assertEquals("alice@company.com", claims.get("nameId"));
    assertEquals("alice@company.com", claims.get("email"));
    assertEquals("Alice", claims.get("displayName"));
  }

  @Test
  void buildClaimsFromAuth_keepsMultiValueAttributesAsList() {
    Auth auth = mock(Auth.class);
    when(auth.getNameId()).thenReturn("alice@company.com");
    Map<String, List<String>> attrs = new LinkedHashMap<>();
    attrs.put("groups", Arrays.asList("admins", "engineers", "users"));
    when(auth.getAttributes()).thenReturn(attrs);

    Map<String, Object> claims = TestSamlHandler.buildClaimsFromAuth(auth);

    Object groups = claims.get("groups");
    assertInstanceOf(List.class, groups);
    @SuppressWarnings("unchecked")
    List<String> groupList = (List<String>) groups;
    assertEquals(3, groupList.size());
    assertTrue(groupList.contains("admins"));
  }

  @Test
  void buildClaimsFromAuth_skipsEmptyAttributes() {
    Auth auth = mock(Auth.class);
    when(auth.getNameId()).thenReturn("alice@company.com");
    Map<String, List<String>> attrs = new LinkedHashMap<>();
    attrs.put("email", Collections.singletonList("alice@company.com"));
    attrs.put("phone", Collections.emptyList());
    attrs.put("bogus", null);
    when(auth.getAttributes()).thenReturn(attrs);

    Map<String, Object> claims = TestSamlHandler.buildClaimsFromAuth(auth);

    assertEquals("alice@company.com", claims.get("email"));
    assertFalse(claims.containsKey("phone"));
    assertFalse(claims.containsKey("bogus"));
  }

  @Test
  void buildClaimsFromAuth_noNameId_omitsNameIdKey() {
    Auth auth = mock(Auth.class);
    when(auth.getNameId()).thenReturn(null);
    Map<String, List<String>> attrs = new LinkedHashMap<>();
    attrs.put("email", Collections.singletonList("alice@company.com"));
    when(auth.getAttributes()).thenReturn(attrs);

    Map<String, Object> claims = TestSamlHandler.buildClaimsFromAuth(auth);

    assertNull(claims.get("nameId"));
    assertEquals("alice@company.com", claims.get("email"));
  }

  @Test
  void buildClaimsFromAuth_nullAttributes_returnsOnlyNameId() {
    Auth auth = mock(Auth.class);
    when(auth.getNameId()).thenReturn("alice@company.com");
    when(auth.getAttributes()).thenReturn(null);

    Map<String, Object> claims = TestSamlHandler.buildClaimsFromAuth(auth);

    assertEquals("alice@company.com", claims.get("nameId"));
    assertEquals(1, claims.size());
  }
}
