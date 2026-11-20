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

package org.openmetadata.service.resources.settings;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.RETURNS_DEEP_STUBS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.openmetadata.schema.settings.SettingsType.AUTHENTICATION_CONFIGURATION;

import jakarta.ws.rs.BadRequestException;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.lang.reflect.Field;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.catalog.security.client.SamlSSOClientConfig;
import org.openmetadata.catalog.type.IdentityProviderConfig;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.jdbi3.SystemRepository;

/**
 * The first start stores the authentication configuration of openmetadata.yaml through the settings
 * write step, and the stored copy wins from then on. A certificate that step refuses stops the
 * start ({@code SystemRepositoryIdpCertificateTest} covers the refusal itself).
 */
class SettingsCacheAuthenticationSeedTest {
  private static final String SINGLE_LINE_PEM = singleLine(resource("/saml/mock-idp.crt"));
  private static final String VALID_PEM = resource("/saml/mock-idp.crt");

  private boolean initializedBefore;

  @BeforeEach
  void allowAFirstStart() throws ReflectiveOperationException {
    initializedBefore = initializedFlag().getBoolean(null);
    initializedFlag().setBoolean(null, false);
  }

  @AfterEach
  void restoreTheFlag() throws ReflectiveOperationException {
    initializedFlag().setBoolean(null, initializedBefore);
  }

  @Test
  void aRefusedIdpCertificateStopsTheFirstStartWithTheRefusal() {
    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      final SystemRepository repository = emptyDatabase(entity);
      final BadRequestException refusal =
          new BadRequestException("samlConfiguration.idp.idpX509Certificate was refused");
      when(repository.createNewSetting(
              argThat(SettingsCacheAuthenticationSeedTest::isAuthentication)))
          .thenThrow(refusal);

      final BadRequestException stopped =
          assertThrows(
              BadRequestException.class,
              () -> SettingsCache.initialize(deployment(SINGLE_LINE_PEM)));

      assertSame(refusal, stopped);
    }
  }

  @Test
  void aFirstStartStoresAUsableIdpCertificate() {
    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      final SystemRepository repository = emptyDatabase(entity);

      SettingsCache.initialize(deployment(VALID_PEM));

      verify(repository)
          .createNewSetting(argThat(SettingsCacheAuthenticationSeedTest::isAuthentication));
    }
  }

  @Test
  void aStoredConfigurationWinsOverTheDeploymentAndIsNotCheckedAgain() {
    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      final SystemRepository repository = emptyDatabase(entity);
      when(repository.getConfigWithKey(AUTHENTICATION_CONFIGURATION.toString()))
          .thenReturn(
              new Settings()
                  .withConfigType(AUTHENTICATION_CONFIGURATION)
                  .withConfigValue(saml(VALID_PEM)));

      assertDoesNotThrow(() -> SettingsCache.initialize(deployment(SINGLE_LINE_PEM)));

      verify(repository, never())
          .createNewSetting(argThat(SettingsCacheAuthenticationSeedTest::isAuthentication));
    }
  }

  private static SystemRepository emptyDatabase(final MockedStatic<Entity> entity) {
    final SystemRepository repository = mock(SystemRepository.class);
    when(repository.getConfigWithKey(anyString())).thenReturn(null);
    entity.when(Entity::getSystemRepository).thenReturn(repository);
    return repository;
  }

  private static OpenMetadataApplicationConfig deployment(final String idpCertificate) {
    final OpenMetadataApplicationConfig config =
        mock(OpenMetadataApplicationConfig.class, RETURNS_DEEP_STUBS);
    when(config.getAuthenticationConfiguration()).thenReturn(saml(idpCertificate));
    when(config.getAuthorizerConfiguration()).thenReturn(null);
    when(config.getMcpConfiguration()).thenReturn(null);
    when(config.getScimConfiguration()).thenReturn(null);
    return config;
  }

  private static boolean isAuthentication(final Settings settings) {
    return settings != null && settings.getConfigType() == AUTHENTICATION_CONFIGURATION;
  }

  private static AuthenticationConfiguration saml(final String idpCertificate) {
    return new AuthenticationConfiguration()
        .withProvider(AuthProvider.SAML)
        .withSamlConfiguration(
            new SamlSSOClientConfig()
                .withIdp(
                    new IdentityProviderConfig()
                        .withEntityId("https://idp.example.com/metadata")
                        .withIdpX509Certificate(idpCertificate)));
  }

  private static Field initializedFlag() throws ReflectiveOperationException {
    final Field field = SettingsCache.class.getDeclaredField("initialized");
    field.setAccessible(true);
    return field;
  }

  private static String singleLine(final String pem) {
    final String begin = "-----BEGIN CERTIFICATE-----";
    final String end = "-----END CERTIFICATE-----";
    return begin + pem.replace(begin, "").replace(end, "").replaceAll("\\s+", "") + end;
  }

  private static String resource(final String path) {
    try (InputStream stream = SettingsCacheAuthenticationSeedTest.class.getResourceAsStream(path)) {
      return new String(stream.readAllBytes(), StandardCharsets.US_ASCII);
    } catch (IOException e) {
      throw new UncheckedIOException(e);
    }
  }
}
