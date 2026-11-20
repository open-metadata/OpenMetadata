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

package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.openmetadata.schema.settings.SettingsType.AUTHENTICATION_CONFIGURATION;
import static org.openmetadata.schema.settings.SettingsType.AUTHORIZER_CONFIGURATION;

import jakarta.ws.rs.BadRequestException;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.schema.configuration.SecurityConfiguration;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.service.jdbi3.SystemRepository;

/**
 * The {@code update-security-config} command writes through the settings repository, whose write
 * step checks the SAML IdP certificate ({@code SystemRepositorySecuritySettingsTest} covers that).
 * The command writes the authentication configuration first, so a refusal leaves both settings as
 * they were.
 */
class OpenMetadataOperationsSecurityConfigTest {
  private final SystemRepository repository = mock(SystemRepository.class);

  @Test
  void aRefusedAuthenticationConfigurationStopsBeforeTheAuthorizerIsWritten() {
    BadRequestException refusal =
        new BadRequestException("samlConfiguration.idp.idpX509Certificate was refused");
    when(repository.createOrUpdate(
            argThat(OpenMetadataOperationsSecurityConfigTest::isAuthentication)))
        .thenThrow(refusal);

    BadRequestException thrown =
        assertThrows(
            BadRequestException.class,
            () -> OpenMetadataOperations.storeSecurityConfiguration(repository, securityFile()));

    assertSame(refusal, thrown);
    verify(repository, never())
        .createOrUpdate(argThat(settings -> settings.getConfigType() == AUTHORIZER_CONFIGURATION));
  }

  @Test
  void storesTheAuthenticationThenTheAuthorizer() {
    OpenMetadataOperations.storeSecurityConfiguration(repository, securityFile());

    ArgumentCaptor<Settings> written = ArgumentCaptor.forClass(Settings.class);
    verify(repository, times(2)).createOrUpdate(written.capture());
    assertEquals(
        List.of(AUTHENTICATION_CONFIGURATION, AUTHORIZER_CONFIGURATION),
        written.getAllValues().stream().map(Settings::getConfigType).toList());
  }

  @Test
  void writesNothingWhenTheFileHasNoSecuritySettings() {
    OpenMetadataOperations.storeSecurityConfiguration(repository, new SecurityConfiguration());

    verify(repository, never()).createOrUpdate(any());
  }

  private static boolean isAuthentication(Settings settings) {
    return settings != null && settings.getConfigType() == AUTHENTICATION_CONFIGURATION;
  }

  private static SecurityConfiguration securityFile() {
    return new SecurityConfiguration()
        .withAuthenticationConfiguration(
            new AuthenticationConfiguration().withProvider(AuthProvider.SAML))
        .withAuthorizerConfiguration(
            new AuthorizerConfiguration().withAdminPrincipals(Set.of("admin")));
  }
}
