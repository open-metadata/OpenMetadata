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
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;
import static org.openmetadata.schema.settings.SettingsType.AUTHENTICATION_CONFIGURATION;
import static org.openmetadata.schema.settings.SettingsType.AUTHORIZER_CONFIGURATION;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.catalog.security.client.SamlSSOClientConfig;
import org.openmetadata.catalog.type.IdentityProviderConfig;
import org.openmetadata.catalog.type.ServiceProviderConfig;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.schema.configuration.SecurityConfiguration;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.SystemRepository;
import org.openmetadata.service.jdbi3.SystemTokenDAOs.SystemDAO;
import org.openmetadata.service.migration.MigrationValidationClient;
import org.openmetadata.service.resources.settings.SettingsCache;

/**
 * What the {@code update-security-config} command leaves stored and the exit code it answers. It
 * writes through the settings repository, whose write step checks the SAML IdP certificate, and
 * writes the authentication first, so a refused certificate leaves both settings as they were and a
 * failed authorizer write is reported, not logged as updated. The rows are a map behind the real
 * repository.
 */
class OpenMetadataOperationsSecurityConfigTest {
  private static final String AUTH = AUTHENTICATION_CONFIGURATION.value();
  private static final String AUTHZ = AUTHORIZER_CONFIGURATION.value();
  private static final String IDP_CERTIFICATE = resource("/saml/mock-idp.crt");
  private static final String OTHER_IDP_CERTIFICATE = resource("/saml/other-idp.crt");
  private static final String EXPIRED_IDP_CERTIFICATE = resource("/saml/expired-idp.crt");

  private final Map<String, String> rows = new ConcurrentHashMap<>();
  private MockedStatic<Entity> entityMock;
  private MockedStatic<MigrationValidationClient> migrationMock;
  private MockedStatic<SettingsCache> settingsCacheMock;
  private SystemRepository repository;

  @BeforeEach
  void setUp() {
    entityMock = mockStatic(Entity.class);
    migrationMock = mockStatic(MigrationValidationClient.class);
    settingsCacheMock = mockStatic(SettingsCache.class);
    final CollectionDAO collectionDAO = mock(CollectionDAO.class);
    final SystemDAO dao = inMemoryDao();
    when(collectionDAO.systemDAO()).thenReturn(dao);
    entityMock.when(Entity::getCollectionDAO).thenReturn(collectionDAO);
    migrationMock
        .when(MigrationValidationClient::getInstance)
        .thenReturn(mock(MigrationValidationClient.class));
    repository = new SystemRepository();
    rows.put(AUTH, JsonUtils.pojoToJson(saml(IDP_CERTIFICATE)));
    rows.put(AUTHZ, JsonUtils.pojoToJson(authorizer("admin")));
  }

  @AfterEach
  void tearDown() {
    settingsCacheMock.close();
    migrationMock.close();
    entityMock.close();
  }

  @Test
  void storesBothSettingsOfTheFileAndExitsZero() {
    final int exitCode =
        OpenMetadataOperations.updateSecurityConfiguration(
            repository, securityFile(OTHER_IDP_CERTIFICATE, authorizer("new-admin")));

    assertEquals(0, exitCode);
    final SecurityConfiguration stored =
        repository.getStoredSecurityConfiguration().configuration();
    assertEquals(
        OTHER_IDP_CERTIFICATE,
        stored
            .getAuthenticationConfiguration()
            .getSamlConfiguration()
            .getIdp()
            .getIdpX509Certificate());
    assertEquals(Set.of("new-admin"), stored.getAuthorizerConfiguration().getAdminPrincipals());
  }

  @Test
  void aRefusedIdpCertificateExitsNonZeroAndLeavesBothSettingsAsTheyWere() {
    final String authenticationBefore = rows.get(AUTH);
    final String authorizerBefore = rows.get(AUTHZ);

    final int exitCode =
        OpenMetadataOperations.updateSecurityConfiguration(
            repository, securityFile(EXPIRED_IDP_CERTIFICATE, authorizer("new-admin")));

    assertEquals(1, exitCode);
    assertEquals(authenticationBefore, rows.get(AUTH));
    assertEquals(authorizerBefore, rows.get(AUTHZ));
  }

  /**
   * {@code enableSecureSocketConnection} is required, so the authorizer cannot be stored. The
   * authentication, written first, stays stored; the command must not report the authorizer as
   * updated.
   */
  @Test
  void aFailedAuthorizerWriteExitsNonZeroAndKeepsTheStoredAuthorizer() {
    final String authorizerBefore = rows.get(AUTHZ);
    final AuthorizerConfiguration incomplete =
        authorizer("new-admin").withEnableSecureSocketConnection(null);

    final int exitCode =
        OpenMetadataOperations.updateSecurityConfiguration(
            repository, securityFile(OTHER_IDP_CERTIFICATE, incomplete));

    assertEquals(1, exitCode);
    assertEquals(authorizerBefore, rows.get(AUTHZ));
    assertEquals(
        OTHER_IDP_CERTIFICATE,
        repository
            .getStoredSecurityConfiguration()
            .configuration()
            .getAuthenticationConfiguration()
            .getSamlConfiguration()
            .getIdp()
            .getIdpX509Certificate());
  }

  @Test
  void writesNothingWhenTheFileHasNoSecuritySettings() {
    final Map<String, String> before = Map.copyOf(rows);

    final int exitCode =
        OpenMetadataOperations.updateSecurityConfiguration(repository, new SecurityConfiguration());

    assertEquals(0, exitCode);
    assertEquals(before, rows);
  }

  private static SecurityConfiguration securityFile(
      final String idpCertificate, final AuthorizerConfiguration authorizer) {
    return new SecurityConfiguration()
        .withAuthenticationConfiguration(saml(idpCertificate))
        .withAuthorizerConfiguration(authorizer);
  }

  private static AuthenticationConfiguration saml(final String idpCertificate) {
    return new AuthenticationConfiguration()
        .withProvider(AuthProvider.SAML)
        .withProviderName("SAML")
        .withSamlConfiguration(
            new SamlSSOClientConfig()
                .withIdp(
                    new IdentityProviderConfig()
                        .withEntityId("https://idp.example.com/metadata")
                        .withSsoLoginUrl("https://idp.example.com/sso")
                        .withIdpX509Certificate(idpCertificate))
                .withSp(
                    new ServiceProviderConfig()
                        .withEntityId("http://localhost:8585/api/v1/saml/metadata")
                        .withAcs("http://localhost:8585/api/v1/saml/acs")
                        .withCallback("http://localhost:8585/saml/callback")));
  }

  private static AuthorizerConfiguration authorizer(final String admin) {
    return new AuthorizerConfiguration()
        .withClassName("org.openmetadata.service.security.DefaultAuthorizer")
        .withContainerRequestFilter("org.openmetadata.service.security.JwtFilter")
        .withAdminPrincipals(Set.of(admin))
        .withPrincipalDomain("open-metadata.org")
        .withEnableSecureSocketConnection(false);
  }

  private static String resource(final String path) {
    try (InputStream stream =
        OpenMetadataOperationsSecurityConfigTest.class.getResourceAsStream(path)) {
      return new String(stream.readAllBytes(), StandardCharsets.US_ASCII);
    } catch (IOException e) {
      throw new UncheckedIOException(e);
    }
  }

  private SystemDAO inMemoryDao() {
    final SystemDAO dao = mock(SystemDAO.class);
    when(dao.getConfigJsonWithKey(anyString())).thenAnswer(i -> rows.get(i.<String>getArgument(0)));
    when(dao.getConfigWithKey(anyString()))
        .thenAnswer(
            i -> {
              final String json = rows.get(i.<String>getArgument(0));
              return json == null
                  ? null
                  : CollectionDAO.SettingsRowMapper.getSettings(
                      SettingsType.fromValue(i.getArgument(0)), json);
            });
    doAnswer(i -> rows.put(i.getArgument(0), i.getArgument(1)))
        .when(dao)
        .insertSettings(anyString(), anyString());
    return dao;
  }
}
