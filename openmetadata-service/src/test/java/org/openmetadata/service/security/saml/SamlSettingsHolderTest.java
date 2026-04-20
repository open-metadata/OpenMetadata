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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockConstruction;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.onelogin.saml2.settings.Saml2Settings;
import com.onelogin.saml2.settings.SettingsBuilder;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.FileInputStream;
import java.io.IOException;
import java.lang.reflect.Field;
import java.security.KeyStore;
import org.junit.jupiter.api.Test;
import org.mockito.MockedConstruction;
import org.mockito.MockedStatic;
import org.openmetadata.catalog.security.client.SamlSSOClientConfig;
import org.openmetadata.catalog.type.IdentityProviderConfig;
import org.openmetadata.catalog.type.SamlSecurityConfig;
import org.openmetadata.catalog.type.ServiceProviderConfig;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.service.security.auth.SecurityConfigurationManager;

class SamlSettingsHolderTest {

  @Test
  void initDefaultSettingsClosesKeyStoreStream() throws Exception {
    byte[] keyStoreBytes = createKeyStoreBytes("changeit".toCharArray());
    SettingsBuilder builder = mock(SettingsBuilder.class);
    when(builder.fromValues(any())).thenReturn(builder);
    when(builder.build()).thenReturn(mock(Saml2Settings.class));

    SamlSettingsHolder holder = SamlSettingsHolder.getInstance();
    setField(holder, "builder", builder);

    try (MockedStatic<SecurityConfigurationManager> securityConfig =
            mockStatic(SecurityConfigurationManager.class);
        MockedConstruction<FileInputStream> fileStreams =
            mockConstruction(
                FileInputStream.class,
                (mock, context) -> delegateToKeyStoreBytes(mock, keyStoreBytes))) {
      securityConfig
          .when(SecurityConfigurationManager::getCurrentAuthConfig)
          .thenReturn(authenticationConfiguration());

      holder.initDefaultSettings(null);

      assertEquals(1, fileStreams.constructed().size());
      verify(fileStreams.constructed().get(0)).close();
    }
  }

  private AuthenticationConfiguration authenticationConfiguration() {
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
            .withSecurity(securityConfig()));
    return configuration;
  }

  private SamlSecurityConfig securityConfig() {
    SamlSecurityConfig securityConfig = new SamlSecurityConfig();
    securityConfig.setSendSignedAuthRequest(true);
    securityConfig.setStrictMode(true);
    securityConfig.setWantMessagesSigned(true);
    securityConfig.setWantAssertionsSigned(true);
    securityConfig.setSignSpMetadata(true);
    securityConfig.setWantAssertionEncrypted(false);
    securityConfig.setSendEncryptedNameId(false);
    securityConfig.setKeyStoreFilePath("/tmp/test-keystore.jks");
    securityConfig.setKeyStoreAlias("openmetadata");
    securityConfig.setKeyStorePassword("changeit");
    return securityConfig;
  }

  private byte[] createKeyStoreBytes(char[] password) throws Exception {
    KeyStore keyStore = KeyStore.getInstance("JKS");
    keyStore.load(null, password);
    ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
    keyStore.store(outputStream, password);
    return outputStream.toByteArray();
  }

  private void delegateToKeyStoreBytes(FileInputStream stream, byte[] keyStoreBytes)
      throws IOException {
    ByteArrayInputStream delegate = new ByteArrayInputStream(keyStoreBytes);
    when(stream.read()).thenAnswer(invocation -> delegate.read());
    when(stream.read(any(byte[].class)))
        .thenAnswer(invocation -> delegate.read(invocation.getArgument(0)));
    when(stream.read(any(byte[].class), anyInt(), anyInt()))
        .thenAnswer(
            invocation ->
                delegate.read(
                    invocation.getArgument(0),
                    invocation.getArgument(1),
                    invocation.getArgument(2)));
    when(stream.skip(anyLong())).thenAnswer(invocation -> delegate.skip(invocation.getArgument(0)));
    when(stream.available()).thenAnswer(invocation -> delegate.available());
    doAnswer(
            invocation -> {
              delegate.close();
              return null;
            })
        .when(stream)
        .close();
  }

  private void setField(Object target, String fieldName, Object value) throws Exception {
    Field field = SamlSettingsHolder.class.getDeclaredField(fieldName);
    field.setAccessible(true);
    field.set(target, value);
  }
}
