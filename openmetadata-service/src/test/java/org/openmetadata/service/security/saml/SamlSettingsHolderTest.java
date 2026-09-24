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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import com.onelogin.saml2.settings.Saml2Settings;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.catalog.security.client.SamlSSOClientConfig;
import org.openmetadata.catalog.type.IdentityProviderConfig;
import org.openmetadata.catalog.type.SamlSecurityConfig;
import org.openmetadata.catalog.type.ServiceProviderConfig;

class SamlSettingsHolderTest {

  private static final String IDP_ENTITY_ID = "https://idp.example.com/metadata";
  private static final String SP_ENTITY_ID = "https://om.example.com/api/v1/saml/metadata";
  private static final String PRIMARY_ACS = "https://om.example.com/api/v1/saml/acs";
  private static final String DR_ACS = "https://dr.example.com/api/v1/saml/acs";

  private final String idpCertificate = new MockSamlIdp(IDP_ENTITY_ID).idpCertificatePem();

  @Test
  void selectsTheAdditionalAcsRegisteredForTheRequestHost() throws Exception {
    SamlSettingsHolder.initSettings(samlConfig(List.of(DR_ACS)));

    assertEquals(DR_ACS, SamlSettingsHolder.getAdditionalAcsUrlFor("https://dr.example.com"));
    assertEquals(DR_ACS, acsOf(SamlSettingsHolder.getSaml2SettingsForAcsUrl(DR_ACS)));
  }

  @Test
  void keepsThePrimaryForAnUnregisteredHost() throws Exception {
    SamlSettingsHolder.initSettings(samlConfig(List.of(DR_ACS)));

    assertNull(SamlSettingsHolder.getAdditionalAcsUrlFor("https://evil.example.com"));
    assertEquals(PRIMARY_ACS, acsOf(SamlSettingsHolder.getSaml2SettingsForAcsUrl(null)));
  }

  /** One Service Provider identity with several endpoints: every ACS keeps the same entity ID. */
  @Test
  void keepsOneEntityIdAcrossEveryAcs() throws Exception {
    SamlSettingsHolder.initSettings(samlConfig(List.of(DR_ACS)));

    assertEquals(SP_ENTITY_ID, SamlSettingsHolder.getSaml2Settings().getSpEntityId());
    assertEquals(
        SP_ENTITY_ID, SamlSettingsHolder.getSaml2SettingsForAcsUrl(DR_ACS).getSpEntityId());
  }

  /** A login started before a reload may have recorded an ACS the new configuration dropped. */
  @Test
  void fallsBackToThePrimaryForAnAcsNoLongerConfigured() throws Exception {
    SamlSettingsHolder.initSettings(samlConfig(List.of(DR_ACS)));
    SamlSettingsHolder.initSettings(samlConfig(List.of()));

    assertEquals(PRIMARY_ACS, acsOf(SamlSettingsHolder.getSaml2SettingsForAcsUrl(DR_ACS)));
    assertEquals(List.of(), SamlSettingsHolder.getAdditionalAcsUrls());
  }

  @Test
  void trimsConfiguredEntriesAndSkipsBlankOnes() throws Exception {
    SamlSettingsHolder.initSettings(samlConfig(List.of("  " + DR_ACS + " ", " ")));

    assertEquals(List.of(DR_ACS), SamlSettingsHolder.getAdditionalAcsUrls());
  }

  private static String acsOf(Saml2Settings settings) {
    return settings.getSpAssertionConsumerServiceUrl().toString();
  }

  private SamlSSOClientConfig samlConfig(List<String> additionalAcsUrls) {
    return new SamlSSOClientConfig()
        .withIdp(
            new IdentityProviderConfig()
                .withEntityId(IDP_ENTITY_ID)
                .withSsoLoginUrl("https://idp.example.com/sso")
                .withIdpX509Certificate(idpCertificate))
        .withSp(
            new ServiceProviderConfig()
                .withEntityId(SP_ENTITY_ID)
                .withAcs(PRIMARY_ACS)
                .withCallback("https://om.example.com/saml/callback")
                .withAdditionalAcsUrls(additionalAcsUrls))
        .withSecurity(new SamlSecurityConfig());
  }
}
