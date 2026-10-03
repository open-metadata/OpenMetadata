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

package org.openmetadata.service.security.saml;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.onelogin.saml2.authn.SamlResponse;
import com.onelogin.saml2.http.HttpRequest;
import com.onelogin.saml2.settings.Saml2Settings;
import com.onelogin.saml2.settings.SettingsBuilder;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * Strict mode checks {@code Destination} and {@code Recipient}. Behind a load balancer the request
 * reaches the server on an internal hop, while the identity provider posted to the public ACS.
 */
class AcsDestinationSamlMessageFactoryTest {

  private static final String IDP_ENTITY_ID = "https://idp.example.com/metadata";
  private static final String SP_ENTITY_ID = "https://om.example.com/api/v1/saml/metadata";
  private static final String DR_ACS = "https://dr.example.com/api/v1/saml/acs";
  private static final String INTERNAL_HOP = "http://10.0.0.7:8585/api/v1/saml/acs";

  private final MockSamlIdp idp = new MockSamlIdp(IDP_ENTITY_ID);

  @Test
  void strictModeRejectsTheResponseWhenCheckedAgainstTheInternalHop() throws Exception {
    SamlResponse response = new SamlResponse(strictSettings(), arrivingOnTheInternalHop());

    assertFalse(response.isValid(null));
    assertTrue(response.getError().contains(INTERNAL_HOP), response.getError());
  }

  @Test
  void strictModeAcceptsTheResponseWhenCheckedAgainstTheAcsTheLoginSent() throws Exception {
    SamlResponse response =
        new AcsDestinationSamlMessageFactory()
            .createSamlResponse(strictSettings(), arrivingOnTheInternalHop());

    assertTrue(response.isValid(null), response.getError());
  }

  private HttpRequest arrivingOnTheInternalHop() {
    String signedResponse = idp.signedResponse("saml.user@example.com", DR_ACS, SP_ENTITY_ID);
    return new HttpRequest(INTERNAL_HOP, Map.of("SAMLResponse", List.of(signedResponse)));
  }

  private Saml2Settings strictSettings() {
    Map<String, Object> values = new HashMap<>();
    values.put(SettingsBuilder.STRICT_PROPERTY_KEY, true);
    values.put(SettingsBuilder.SP_ENTITYID_PROPERTY_KEY, SP_ENTITY_ID);
    values.put(SettingsBuilder.SP_ASSERTION_CONSUMER_SERVICE_URL_PROPERTY_KEY, DR_ACS);
    values.put(SettingsBuilder.IDP_ENTITYID_PROPERTY_KEY, IDP_ENTITY_ID);
    values.put(
        SettingsBuilder.IDP_SINGLE_SIGN_ON_SERVICE_URL_PROPERTY_KEY, "https://idp.example.com/sso");
    values.put(SettingsBuilder.IDP_X509CERT_PROPERTY_KEY, idp.idpCertificatePem());
    // The mock signs the Response, not the Assertion; see MockSamlIdpTest.
    values.put(SettingsBuilder.SECURITY_WANT_ASSERTIONS_SIGNED, false);
    values.put(SettingsBuilder.SECURITY_WANT_MESSAGES_SIGNED, false);
    return new SettingsBuilder().fromValues(values).build();
  }
}
