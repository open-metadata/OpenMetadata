/*
 *  Copyright 2021 Collate
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
package org.openmetadata.service.security.saml;

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.onelogin.saml2.authn.SamlResponse;
import com.onelogin.saml2.http.HttpRequest;
import com.onelogin.saml2.settings.Saml2Settings;
import com.onelogin.saml2.settings.SettingsBuilder;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * Verifies that {@link MockSamlIdp} produces SAML Responses that OpenMetadata's onelogin Service
 * Provider actually accepts — and rejects when unsigned or tampered. This runs the real
 * {@code SamlResponse.isValid} validation path that {@code SamlAuthServletHandler.handleCallback}
 * uses, so it de-risks the {@code SamlSsoIT} integration test without needing Docker.
 */
class MockSamlIdpTest {

  private static final String IDP_ENTITY_ID = "https://mock-idp.openmetadata.test/metadata";
  private static final String SP_ENTITY_ID = "http://localhost:8585/api/v1/saml/metadata";
  private static final String ACS_URL = "http://localhost:8585/api/v1/saml/acs";
  private static final String SUBJECT = "saml.user@openmetadata.test";

  private final MockSamlIdp idp = new MockSamlIdp(IDP_ENTITY_ID);

  @Test
  void signedResponse_isAcceptedBySpValidation() throws Exception {
    SamlResponse response = parse(idp.signedResponse(SUBJECT, ACS_URL, SP_ENTITY_ID));

    assertTrue(response.isValid(null), "signed mock SAML response must pass SP validation");
    assertEquals(SUBJECT, response.getNameId());
  }

  @Test
  void unsignedResponse_isRejected() throws Exception {
    SamlResponse response = parse(idp.unsignedResponse(SUBJECT, ACS_URL, SP_ENTITY_ID));

    assertFalse(response.isValid(null), "unsigned response must be rejected (no signature)");
  }

  @Test
  void tamperedSignedResponse_isRejected() throws Exception {
    String signed = idp.signedResponse(SUBJECT, ACS_URL, SP_ENTITY_ID);
    String xml = new String(Base64.getMimeDecoder().decode(signed), UTF_8);
    String tamperedXml = xml.replace(SUBJECT, "attacker@evil.test");
    String tampered = Base64.getEncoder().encodeToString(tamperedXml.getBytes(UTF_8));

    SamlResponse response = parse(tampered);

    assertFalse(response.isValid(null), "tampering the signed assertion must break the signature");
  }

  private SamlResponse parse(String base64Response) throws Exception {
    HttpRequest request = new HttpRequest(ACS_URL, Map.of("SAMLResponse", List.of(base64Response)));
    return new SamlResponse(spSettings(), request);
  }

  private Saml2Settings spSettings() {
    Map<String, Object> values = new HashMap<>();
    values.put(SettingsBuilder.STRICT_PROPERTY_KEY, false);
    values.put(SettingsBuilder.SP_ENTITYID_PROPERTY_KEY, SP_ENTITY_ID);
    values.put(SettingsBuilder.SP_ASSERTION_CONSUMER_SERVICE_URL_PROPERTY_KEY, ACS_URL);
    values.put(SettingsBuilder.IDP_ENTITYID_PROPERTY_KEY, IDP_ENTITY_ID);
    values.put(
        SettingsBuilder.IDP_SINGLE_SIGN_ON_SERVICE_URL_PROPERTY_KEY,
        "https://mock-idp.openmetadata.test/sso");
    values.put(SettingsBuilder.IDP_X509CERT_PROPERTY_KEY, idp.idpCertificatePem());
    // The mock signs the Response, not the Assertion, so the SP must not require an
    // assertion-level signature; onelogin still unconditionally validates the Response signature.
    values.put(SettingsBuilder.SECURITY_WANT_ASSERTIONS_SIGNED, false);
    values.put(SettingsBuilder.SECURITY_WANT_MESSAGES_SIGNED, false);
    return new SettingsBuilder().fromValues(values).build();
  }
}
