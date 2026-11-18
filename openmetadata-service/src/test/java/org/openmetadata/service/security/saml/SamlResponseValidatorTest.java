/*
 *  Copyright 2026 Collate.
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

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.onelogin.saml2.authn.SamlResponse;
import com.onelogin.saml2.http.HttpRequest;
import com.onelogin.saml2.settings.Saml2Settings;
import com.onelogin.saml2.settings.SettingsBuilder;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.exception.AuthenticationException;

/**
 * java-saml checks expiry, audience and destination only when strict mode is on, and the shipped
 * configuration turns it off. Each case first shows non-strict validation accepting the response,
 * then the validator the ACS handler adds rejecting it.
 */
class SamlResponseValidatorTest {
  private static final String IDP_ENTITY_ID = "https://mock-idp.openmetadata.test/metadata";
  private static final String SP_ENTITY_ID = "http://localhost:8585/api/v1/saml/metadata";
  private static final String ACS_URL = "http://localhost:8585/api/v1/saml/acs";
  private static final String OTHER_SP_ENTITY_ID = "https://other-sp.example.test/metadata";
  private static final String OTHER_ACS_URL = "https://other-sp.example.test/acs";
  private static final String SUBJECT = "saml.user@openmetadata.test";

  private final MockSamlIdp idp = new MockSamlIdp(IDP_ENTITY_ID);
  private final Saml2Settings settings = nonStrictSettings();

  @Test
  void aCurrentResponseForThisServiceProviderIsAccepted() {
    String response = idp.signedResponse(SUBJECT, ACS_URL, SP_ENTITY_ID);

    assertDoesNotThrow(() -> SamlResponseValidator.validate(settings, request(response)));
  }

  @Test
  void anExpiredResponseIsRejected() throws Exception {
    String response =
        idp.signedResponse(
            SUBJECT, ACS_URL, SP_ENTITY_ID, Instant.now().minus(30, ChronoUnit.DAYS));
    assertTrue(parse(response).isValid(null), "non-strict validation accepts it");

    assertThrows(
        AuthenticationException.class,
        () -> SamlResponseValidator.validate(settings, request(response)));
  }

  @Test
  void aResponseIssuedForAnotherServiceProviderIsRejected() throws Exception {
    String response = idp.signedResponse(SUBJECT, ACS_URL, OTHER_SP_ENTITY_ID);
    assertTrue(parse(response).isValid(null), "non-strict validation accepts it");

    assertThrows(
        AuthenticationException.class,
        () -> SamlResponseValidator.validate(settings, request(response)));
  }

  @Test
  void aResponseSentToAnotherAssertionConsumerServiceIsRejected() throws Exception {
    String response = idp.signedResponse(SUBJECT, OTHER_ACS_URL, SP_ENTITY_ID);
    assertTrue(parse(response).isValid(null), "non-strict validation accepts it");

    assertThrows(
        AuthenticationException.class,
        () -> SamlResponseValidator.validate(settings, request(response)));
  }

  /** Behind a TLS-terminating proxy the server sees http while the IdP posts to the https URL. */
  @Test
  void theDestinationIsComparedWithTheConfiguredUrlNotTheRequestUrl() {
    String response = idp.signedResponse(SUBJECT, ACS_URL, SP_ENTITY_ID);
    HttpRequest proxied =
        new HttpRequest(
            "http://openmetadata.internal:8585/api/v1/saml/acs",
            Map.of("SAMLResponse", List.of(response)));

    assertDoesNotThrow(() -> SamlResponseValidator.validate(settings, proxied));
  }

  private SamlResponse parse(String base64Response) throws Exception {
    return new SamlResponse(settings, request(base64Response));
  }

  private static HttpRequest request(String base64Response) {
    return new HttpRequest(ACS_URL, Map.of("SAMLResponse", List.of(base64Response)));
  }

  private Saml2Settings nonStrictSettings() {
    Map<String, Object> values = new HashMap<>();
    values.put(SettingsBuilder.STRICT_PROPERTY_KEY, false);
    values.put(SettingsBuilder.SP_ENTITYID_PROPERTY_KEY, SP_ENTITY_ID);
    values.put(SettingsBuilder.SP_ASSERTION_CONSUMER_SERVICE_URL_PROPERTY_KEY, ACS_URL);
    values.put(SettingsBuilder.IDP_ENTITYID_PROPERTY_KEY, IDP_ENTITY_ID);
    values.put(
        SettingsBuilder.IDP_SINGLE_SIGN_ON_SERVICE_URL_PROPERTY_KEY,
        "https://mock-idp.openmetadata.test/sso");
    values.put(SettingsBuilder.IDP_X509CERT_PROPERTY_KEY, idp.idpCertificatePem());
    values.put(SettingsBuilder.SECURITY_WANT_ASSERTIONS_SIGNED, false);
    values.put(SettingsBuilder.SECURITY_WANT_MESSAGES_SIGNED, false);
    return new SettingsBuilder().fromValues(values).build();
  }
}
