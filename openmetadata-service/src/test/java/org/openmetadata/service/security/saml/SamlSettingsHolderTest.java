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

package org.openmetadata.service.security.saml;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import com.onelogin.saml2.settings.Saml2Settings;
import com.onelogin.saml2.settings.SettingsBuilder;
import java.io.OutputStream;
import java.lang.reflect.Field;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyStore;
import java.util.Map;
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

  private static final char[] KEYSTORE_PASSWORD = "changeit".toCharArray();

  @Test
  void initDefaultSettingsLoadsKeyStoreFromFile(@TempDir Path tempDir) throws Exception {
    Path keyStorePath = tempDir.resolve("test-keystore.jks");
    writeEmptyKeyStore(keyStorePath);

    SettingsBuilder builder = mock(SettingsBuilder.class);
    when(builder.fromValues(any())).thenReturn(builder);
    when(builder.build()).thenReturn(mock(Saml2Settings.class));

    SamlSettingsHolder holder = SamlSettingsHolder.getInstance();
    setField(holder, "builder", builder);

    try (MockedStatic<SecurityConfigurationManager> securityConfig =
        mockStatic(SecurityConfigurationManager.class)) {
      securityConfig
          .when(SecurityConfigurationManager::getCurrentAuthConfig)
          .thenReturn(authenticationConfiguration(keyStorePath.toString()));

      assertDoesNotThrow(() -> holder.initDefaultSettings(null));

      Map<String, Object> samlData = readField(holder, "samlData");
      Object loadedKeyStore = samlData.get(SettingsBuilder.KEYSTORE_KEY);
      assertNotNull(loadedKeyStore, "KeyStore should be loaded into samlData");
      assertInstanceOf(KeyStore.class, loadedKeyStore);
    }
  }

  private AuthenticationConfiguration authenticationConfiguration(String keyStoreFilePath) {
    AuthenticationConfiguration configuration = new AuthenticationConfiguration();
    configuration.setSamlConfiguration(
        new SamlSSOClientConfig()
            .withSp(
                new ServiceProviderConfig()
                    .withEntityId("https://sp.example.com/entity")
                    .withAcs("https://sp.example.com/api/v1/saml/acs")
                    .withCallback("https://sp.example.com/callback"))
            .withIdp(
                new IdentityProviderConfig()
                    .withEntityId("https://idp.example.com/entity")
                    .withSsoLoginUrl("https://idp.example.com/sso")
                    .withNameId("urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress")
                    .withIdpX509Certificate("dummy-cert"))
            .withSecurity(securityConfig(keyStoreFilePath)));
    return configuration;
  }

  private SamlSecurityConfig securityConfig(String keyStoreFilePath) {
    SamlSecurityConfig securityConfig = new SamlSecurityConfig();
    securityConfig.setSendSignedAuthRequest(true);
    securityConfig.setStrictMode(true);
    securityConfig.setWantMessagesSigned(true);
    securityConfig.setWantAssertionsSigned(true);
    securityConfig.setSignSpMetadata(true);
    securityConfig.setWantAssertionEncrypted(false);
    securityConfig.setSendEncryptedNameId(false);
    securityConfig.setKeyStoreFilePath(keyStoreFilePath);
    securityConfig.setKeyStoreAlias("openmetadata");
    securityConfig.setKeyStorePassword(new String(KEYSTORE_PASSWORD));
    return securityConfig;
  }

  private static void writeEmptyKeyStore(Path path) throws Exception {
    KeyStore keyStore = KeyStore.getInstance("JKS");
    keyStore.load(null, KEYSTORE_PASSWORD);
    try (OutputStream out = Files.newOutputStream(path)) {
      keyStore.store(out, KEYSTORE_PASSWORD);
    }
  }

  private static void setField(Object target, String fieldName, Object value) throws Exception {
    Field field = SamlSettingsHolder.class.getDeclaredField(fieldName);
    field.setAccessible(true);
    field.set(target, value);
  }

  @SuppressWarnings("unchecked")
  private static <T> T readField(Object target, String fieldName) throws Exception {
    Field field = SamlSettingsHolder.class.getDeclaredField(fieldName);
    field.setAccessible(true);
    return (T) field.get(target);
  }
}
