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

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.onelogin.saml2.settings.Saml2Settings;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyStore;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.openmetadata.catalog.security.client.SamlSSOClientConfig;
import org.openmetadata.catalog.type.IdentityProviderConfig;
import org.openmetadata.catalog.type.SamlSecurityConfig;
import org.openmetadata.catalog.type.ServiceProviderConfig;

class SamlSettingsHolderTest {
  private static final char[] KEYSTORE_PASSWORD = "changeit".toCharArray();

  @Test
  void loadKeyStoreClosesInputStream() throws Exception {
    TrackingInputStream inputStream = new TrackingInputStream(createKeyStoreBytes());

    KeyStore keyStore = SamlSettingsHolder.loadKeyStore(inputStream, KEYSTORE_PASSWORD);

    assertNotNull(keyStore);
    assertTrue(inputStream.isClosed());
  }

  /**
   * Microsoft Entra encrypts assertions once token encryption is on, whatever the SP asks for, and
   * java-saml decrypts them with the SP key, so a configured key is used even when this SP signs
   * nothing.
   */
  @Test
  void buildSettingsGivesJavaSamlTheSpKeyWithoutRequestSigning() throws Exception {
    SamlSSOClientConfig samlConfig = samlConfig();
    samlConfig
        .getSp()
        .withSpX509Certificate(resource("/saml/mock-idp.crt"))
        .setSpPrivateKey(resource("/saml/mock-idp-pkcs8.key"));

    Saml2Settings settings = SamlSettingsHolder.buildSettings(samlConfig);

    assertNotNull(settings.getSPkey());
    assertNotNull(settings.getSPcert());
  }

  @Test
  void buildSettingsReadsTheKeyStoreWithItsPassword(@TempDir Path directory) throws Exception {
    Path keyStoreFile = directory.resolve("sp.jks");
    Files.write(keyStoreFile, createKeyStoreBytes());
    SamlSSOClientConfig samlConfig = samlConfig();
    samlConfig.setSecurity(
        new SamlSecurityConfig()
            .withSendSignedAuthRequest(true)
            .withKeyStoreFilePath(keyStoreFile.toString())
            .withKeyStoreAlias("sp")
            .withKeyStorePassword(new String(KEYSTORE_PASSWORD)));

    assertTrue(SamlSettingsHolder.buildSettings(samlConfig).getAuthnRequestsSigned());

    samlConfig.getSecurity().setKeyStorePassword("not-the-password");
    assertThrows(IOException.class, () -> SamlSettingsHolder.buildSettings(samlConfig));
  }

  private static SamlSSOClientConfig samlConfig() {
    return new SamlSSOClientConfig()
        .withSp(
            new ServiceProviderConfig()
                .withEntityId("https://sp.example.com/entity")
                .withAcs("https://sp.example.com/api/v1/saml/acs")
                .withCallback("https://sp.example.com/callback"))
        .withIdp(
            new IdentityProviderConfig()
                .withEntityId("https://idp.example.com/metadata")
                .withSsoLoginUrl("https://idp.example.com/sso"))
        .withSecurity(new SamlSecurityConfig());
  }

  private static String resource(String path) throws IOException {
    try (InputStream stream = SamlSettingsHolderTest.class.getResourceAsStream(path)) {
      return new String(stream.readAllBytes(), StandardCharsets.UTF_8);
    }
  }

  private byte[] createKeyStoreBytes() throws Exception {
    KeyStore keyStore = KeyStore.getInstance("JKS");
    keyStore.load(null, KEYSTORE_PASSWORD);
    ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
    keyStore.store(outputStream, KEYSTORE_PASSWORD);
    return outputStream.toByteArray();
  }

  private static final class TrackingInputStream extends ByteArrayInputStream {
    private boolean closed;

    private TrackingInputStream(byte[] data) {
      super(data);
    }

    @Override
    public void close() throws IOException {
      closed = true;
      super.close();
    }

    private boolean isClosed() {
      return closed;
    }
  }
}
