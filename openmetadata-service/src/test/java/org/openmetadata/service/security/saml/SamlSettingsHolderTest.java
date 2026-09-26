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
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.onelogin.saml2.settings.Saml2Settings;
import com.onelogin.saml2.util.Util;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.lang.reflect.Field;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyStore;
import java.security.cert.Certificate;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.openmetadata.catalog.security.client.SamlSSOClientConfig;
import org.openmetadata.catalog.type.IdentityProviderConfig;
import org.openmetadata.catalog.type.SamlSecurityConfig;
import org.openmetadata.catalog.type.ServiceProviderConfig;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.service.security.auth.SecurityConfigurationManager;

class SamlSettingsHolderTest {

  private static final String IDP_ENTITY_ID = "https://idp.example.com/metadata";
  private static final String SP_ENTITY_ID = "https://om.example.com/api/v1/saml/metadata";
  private static final String PRIMARY_ACS = "https://om.example.com/api/v1/saml/acs";
  private static final String DR_ACS = "https://dr.example.com/api/v1/saml/acs";
  private static final String CERTIFICATE = "/saml/mock-idp.crt";
  private static final String KEY = "/saml/mock-idp-pkcs8.key";
  private static final String KEYSTORE_PASSWORD = "changeit";

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

  @Test
  void initDefaultSettingsBuildsFromTheCurrentAuthConfiguration() throws Exception {
    SecurityConfigurationManager.getInstance()
        .setCurrentAuthConfig(
            new AuthenticationConfiguration().withSamlConfiguration(samlConfig(List.of(DR_ACS))));
    try {
      SamlSettingsHolder.getInstance().initDefaultSettings(null);
    } finally {
      SecurityConfigurationManager.getInstance().setCurrentAuthConfig(null);
    }

    assertEquals(List.of(DR_ACS), SamlSettingsHolder.getAdditionalAcsUrls());
  }

  @Test
  void refusesToServeSettingsBeforeInitialization() throws Exception {
    Field snapshot = SamlSettingsHolder.class.getDeclaredField("snapshot");
    snapshot.setAccessible(true);
    snapshot.set(null, null);

    assertThrows(IllegalStateException.class, SamlSettingsHolder::getSaml2Settings);
  }

  @Test
  void loadsTheSpKeyForEveryAcsWhenAuthnRequestsAreSigned() throws Exception {
    SamlSSOClientConfig config = samlConfig(List.of(DR_ACS));
    config.getSp().withSpX509Certificate(resource(CERTIFICATE)).withSpPrivateKey(resource(KEY));
    config.getSecurity().withSendSignedAuthRequest(true);

    SamlSettingsHolder.initSettings(config);

    assertNotNull(SamlSettingsHolder.getSaml2Settings().getSPkey());
    assertNotNull(SamlSettingsHolder.getSaml2SettingsForAcsUrl(DR_ACS).getSPkey());
  }

  @Test
  void loadsTheSpKeyFromAKeyStore(@TempDir Path tempDir) throws Exception {
    Path keyStorePath = tempDir.resolve("sp.jks");
    KeyStore keyStore = KeyStore.getInstance("JKS");
    keyStore.load(null, null);
    keyStore.setKeyEntry(
        "sp",
        Util.loadPrivateKey(resource(KEY)),
        KEYSTORE_PASSWORD.toCharArray(),
        new Certificate[] {Util.loadCert(resource(CERTIFICATE))});
    try (OutputStream out = Files.newOutputStream(keyStorePath)) {
      keyStore.store(out, KEYSTORE_PASSWORD.toCharArray());
    }
    SamlSSOClientConfig config = samlConfig(List.of());
    config
        .getSecurity()
        .withSendSignedAuthRequest(true)
        .withKeyStoreFilePath(keyStorePath.toString())
        .withKeyStoreAlias("sp")
        .withKeyStorePassword(KEYSTORE_PASSWORD);

    SamlSettingsHolder.initSettings(config);

    assertNotNull(SamlSettingsHolder.getSaml2Settings().getSPkey());
  }

  @Test
  void rejectsSignedAuthnRequestsWithoutAnySpKeyMaterial() {
    SamlSSOClientConfig config = samlConfig(List.of());
    config.getSecurity().withSendSignedAuthRequest(true);

    assertThrows(IllegalArgumentException.class, () -> SamlSettingsHolder.initSettings(config));
  }

  private String resource(String path) throws IOException {
    try (InputStream stream = getClass().getResourceAsStream(path)) {
      return new String(stream.readAllBytes(), StandardCharsets.UTF_8);
    }
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
