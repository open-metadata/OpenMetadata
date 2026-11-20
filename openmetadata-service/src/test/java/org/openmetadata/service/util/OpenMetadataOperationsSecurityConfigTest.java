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
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.openmetadata.schema.settings.SettingsType.AUTHENTICATION_CONFIGURATION;
import static org.openmetadata.schema.settings.SettingsType.AUTHORIZER_CONFIGURATION;

import jakarta.ws.rs.BadRequestException;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.openmetadata.catalog.security.client.SamlSSOClientConfig;
import org.openmetadata.catalog.type.IdentityProviderConfig;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.schema.configuration.SecurityConfiguration;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.service.jdbi3.SystemRepository;

/** The {@code update-security-config} command stores a SAML IdP certificate only once it passed. */
class OpenMetadataOperationsSecurityConfigTest {
  private static final String VALID = resource("/saml/mock-idp.crt");
  private static final String OTHER_VALID = resource("/saml/other-idp.crt");
  private static final String EXPIRED = resource("/saml/expired-idp.crt");
  private static final String NOT_A_CERTIFICATE =
      "-----BEGIN CERTIFICATE-----\nnot-a-certificate\n-----END CERTIFICATE-----";

  private SystemRepository repository;

  @BeforeEach
  void storeAValidConfiguration() {
    repository = mock(SystemRepository.class);
    storedCertificate(VALID);
  }

  @Test
  void refusesAnUnusableCertificateAndWritesNothing() {
    for (String unusable : List.of(NOT_A_CERTIFICATE, EXPIRED)) {
      BadRequestException refused =
          assertThrows(
              BadRequestException.class,
              () ->
                  OpenMetadataOperations.storeSecurityConfiguration(
                      repository, securityFile(unusable)));

      assertTrue(refused.getMessage().contains("samlConfiguration.idp.idpX509Certificate"));
    }
    verify(repository, never()).createOrUpdate(any());
  }

  @Test
  void storesAUsableCertificateAndTheAuthorizer() {
    OpenMetadataOperations.storeSecurityConfiguration(repository, securityFile(OTHER_VALID));

    assertEquals(
        OTHER_VALID,
        storedAuthentication().getSamlConfiguration().getIdp().getIdpX509Certificate());
  }

  @Test
  void storesTheStoredExpiredCertificateSentBackUnchanged() {
    storedCertificate(EXPIRED);

    OpenMetadataOperations.storeSecurityConfiguration(repository, securityFile(EXPIRED));

    assertEquals(
        EXPIRED, storedAuthentication().getSamlConfiguration().getIdp().getIdpX509Certificate());
  }

  private AuthenticationConfiguration storedAuthentication() {
    ArgumentCaptor<Settings> written = ArgumentCaptor.forClass(Settings.class);
    verify(repository, times(2)).createOrUpdate(written.capture());
    assertEquals(
        Set.of(AUTHENTICATION_CONFIGURATION, AUTHORIZER_CONFIGURATION),
        Set.of(
            written.getAllValues().get(0).getConfigType(),
            written.getAllValues().get(1).getConfigType()));
    return (AuthenticationConfiguration) written.getAllValues().get(0).getConfigValue();
  }

  private void storedCertificate(String idpCertificate) {
    when(repository.getConfigWithKey(AUTHENTICATION_CONFIGURATION.value()))
        .thenReturn(
            new Settings()
                .withConfigType(AUTHENTICATION_CONFIGURATION)
                .withConfigValue(saml(idpCertificate)));
  }

  private static SecurityConfiguration securityFile(String idpCertificate) {
    return new SecurityConfiguration()
        .withAuthenticationConfiguration(saml(idpCertificate))
        .withAuthorizerConfiguration(
            new AuthorizerConfiguration().withAdminPrincipals(Set.of("admin")));
  }

  private static AuthenticationConfiguration saml(String idpCertificate) {
    return new AuthenticationConfiguration()
        .withProvider(AuthProvider.SAML)
        .withSamlConfiguration(
            new SamlSSOClientConfig()
                .withIdp(
                    new IdentityProviderConfig()
                        .withEntityId("https://idp.example.com/metadata")
                        .withIdpX509Certificate(idpCertificate)));
  }

  private static String resource(String path) {
    try (InputStream stream =
        OpenMetadataOperationsSecurityConfigTest.class.getResourceAsStream(path)) {
      return new String(stream.readAllBytes(), StandardCharsets.US_ASCII);
    } catch (IOException e) {
      throw new UncheckedIOException(e);
    }
  }
}
