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
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mockStatic;

import com.onelogin.saml2.settings.Saml2Settings;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyStore;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.MockedStatic;
import org.openmetadata.catalog.security.client.SamlSSOClientConfig;
import org.openmetadata.catalog.type.IdentityProviderConfig;
import org.openmetadata.catalog.type.SamlSecurityConfig;
import org.openmetadata.catalog.type.ServiceProviderConfig;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.service.security.auth.SecurityConfigurationManager;

class SamlSettingsHolderTest {
  private static final String KEYSTORE_PASSWORD = "changeit";

  @AfterEach
  void forgetInstalledSettings() {
    SamlSettingsHolder.setSaml2Settings(null);
  }

  /**
   * Microsoft Entra encrypts assertions once token encryption is on, whatever the SP asks for, and
   * java-saml decrypts them with the SP key, so a configured key is used even when this SP signs
   * nothing.
   */
  @Test
  void buildSettingsGivesJavaSamlTheSpKeyWithoutRequestSigning() throws Exception {
    SamlSSOClientConfig samlConfig = samlConfig("https://idp.example.com/sso");
    samlConfig
        .getSp()
        .withSpX509Certificate(resource("/saml/mock-idp.crt"))
        .setSpPrivateKey(resource("/saml/mock-idp-pkcs8.key"));

    Saml2Settings settings = SamlSettingsHolder.buildSettings(samlConfig);

    assertNotNull(settings.getSPkey());
    assertNotNull(settings.getSPcert());
  }

  private static String resource(String path) throws IOException {
    try (InputStream stream = SamlSettingsHolderTest.class.getResourceAsStream(path)) {
      return new String(stream.readAllBytes(), StandardCharsets.UTF_8);
    }
  }

  @Test
  void initDefaultSettingsInstallsTheLiveConfiguration() throws Exception {
    SamlSSOClientConfig live = samlConfig("https://idp.example.com/live");
    SamlSettingsHolder holder = SamlSettingsHolder.getInstance();
    try (MockedStatic<SecurityConfigurationManager> manager =
        mockStatic(SecurityConfigurationManager.class)) {
      manager
          .when(SecurityConfigurationManager::getCurrentAuthConfig)
          .thenReturn(new AuthenticationConfiguration().withSamlConfiguration(live));

      holder.initDefaultSettings(null);
    }

    assertEquals(
        "https://idp.example.com/live",
        SamlSettingsHolder.getSaml2Settings().getIdpSingleSignOnServiceUrl().toString());
    assertEquals(live.getSp().getCallback(), holder.getRelayState());
  }

  @Test
  void buildSettingsLeavesTheLiveSettingsInPlace() throws Exception {
    Saml2Settings live =
        SamlSettingsHolder.buildSettings(samlConfig("https://idp.example.com/live"));
    SamlSettingsHolder.setSaml2Settings(live);

    Saml2Settings candidate =
        SamlSettingsHolder.buildSettings(samlConfig("https://idp.example.com/candidate"));

    assertEquals(
        "https://idp.example.com/candidate", candidate.getIdpSingleSignOnServiceUrl().toString());
    assertSame(live, SamlSettingsHolder.getSaml2Settings());
  }

  @Test
  void buildSettingsReadsTheKeyStoreWithItsPassword(@TempDir Path directory) throws Exception {
    SamlSSOClientConfig samlConfig = samlConfig("https://idp.example.com/sso");
    samlConfig.setSecurity(
        new SamlSecurityConfig()
            .withSendSignedAuthRequest(true)
            .withKeyStoreFilePath(emptyKeyStore(directory).toString())
            .withKeyStoreAlias("sp")
            .withKeyStorePassword(KEYSTORE_PASSWORD));

    assertTrue(SamlSettingsHolder.buildSettings(samlConfig).getAuthnRequestsSigned());

    samlConfig.getSecurity().setKeyStorePassword("not-the-password");
    assertThrows(IOException.class, () -> SamlSettingsHolder.buildSettings(samlConfig));
  }

  private static Path emptyKeyStore(Path directory) throws Exception {
    KeyStore keyStore = KeyStore.getInstance("JKS");
    keyStore.load(null, KEYSTORE_PASSWORD.toCharArray());
    Path file = directory.resolve("sp.jks");
    try (OutputStream outputStream = Files.newOutputStream(file)) {
      keyStore.store(outputStream, KEYSTORE_PASSWORD.toCharArray());
    }
    return file;
  }

  private static SamlSSOClientConfig samlConfig(String ssoLoginUrl) {
    return new SamlSSOClientConfig()
        .withSp(
            new ServiceProviderConfig()
                .withEntityId("https://sp.example.com/entity")
                .withAcs("https://sp.example.com/api/v1/saml/acs")
                .withCallback("https://sp.example.com/callback"))
        .withIdp(
            new IdentityProviderConfig()
                .withEntityId("https://idp.example.com/metadata")
                .withSsoLoginUrl(ssoLoginUrl))
        .withSecurity(new SamlSecurityConfig());
  }
}
