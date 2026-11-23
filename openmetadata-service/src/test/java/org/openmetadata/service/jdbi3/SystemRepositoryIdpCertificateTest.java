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

package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;
import static org.openmetadata.schema.settings.SettingsType.AUTHENTICATION_CONFIGURATION;

import jakarta.json.Json;
import jakarta.ws.rs.BadRequestException;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Function;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.catalog.security.client.SamlSSOClientConfig;
import org.openmetadata.catalog.type.IdentityProviderConfig;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO.SystemDAO;
import org.openmetadata.service.migration.MigrationValidationClient;
import org.openmetadata.service.resources.settings.SettingsCache;

/**
 * Every write of the authentication configuration passes the settings write step, which refuses a
 * new or changed SAML IdP certificate that a save would refuse and keeps an unchanged one.
 * ADR:2026-11-20-the-stored-saml-idp-certificate-is-standard-pem
 */
class SystemRepositoryIdpCertificateTest {
  private static final String AUTH = AUTHENTICATION_CONFIGURATION.value();
  private static final String VALID = resource("/saml/mock-idp.crt");
  private static final String OTHER_VALID = resource("/saml/other-idp.crt");
  private static final String EXPIRED = resource("/saml/expired-idp.crt");
  private static final String NOT_A_CERTIFICATE =
      "-----BEGIN CERTIFICATE-----\nnot-a-certificate\n-----END CERTIFICATE-----";
  private static final String CERTIFICATE_FIELD = "samlConfiguration.idp.idpX509Certificate";

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
  }

  @AfterEach
  void tearDown() {
    settingsCacheMock.close();
    migrationMock.close();
    entityMock.close();
  }

  /** Every way that writes the authentication configuration, and the JSON it leaves stored. */
  private Map<String, Function<AuthenticationConfiguration, String>> writePaths() {
    final Map<String, Function<AuthenticationConfiguration, String>> paths = new LinkedHashMap<>();
    paths.put("createOrUpdate (security PUT, update-security-config)", this::createOrUpdate);
    paths.put("updateSetting (seeding, migrations)", this::updateSetting);
    paths.put("patchSetting (settings PATCH)", this::patchSetting);
    return paths;
  }

  private String createOrUpdate(final AuthenticationConfiguration config) {
    return written(() -> repository.createOrUpdate(settings(config)));
  }

  private String updateSetting(final AuthenticationConfiguration config) {
    return written(() -> repository.updateSetting(settings(config)));
  }

  /** A settings PATCH that replaces the IdP certificate alone. */
  private String patchSetting(final AuthenticationConfiguration config) {
    final String certificate = config.getSamlConfiguration().getIdp().getIdpX509Certificate();
    return written(
        () ->
            repository.patchSetting(
                AUTH,
                Json.createPatchBuilder()
                    .replace("/samlConfiguration/idp/idpX509Certificate", certificate)
                    .build()));
  }

  @Test
  void everyWritePathRefusesANewUnusableCertificateAndKeepsTheStoredValue() {
    for (final Map.Entry<String, Function<AuthenticationConfiguration, String>> path :
        writePaths().entrySet()) {
      for (final String unusable : List.of(NOT_A_CERTIFICATE, EXPIRED)) {
        store(VALID);
        final String before = rows.get(AUTH);

        final BadRequestException refused =
            assertThrows(
                BadRequestException.class,
                () -> path.getValue().apply(saml(unusable)),
                path.getKey());

        assertTrue(refused.getMessage().contains(CERTIFICATE_FIELD), path.getKey());
        assertEquals(before, rows.get(AUTH), path.getKey());
      }
    }
  }

  @Test
  void everyWritePathAcceptsTheStoredExpiredCertificateUnchanged() {
    for (final Map.Entry<String, Function<AuthenticationConfiguration, String>> path :
        writePaths().entrySet()) {
      store(EXPIRED);

      assertEquals(EXPIRED, certificateIn(path.getValue().apply(saml(EXPIRED))), path.getKey());
    }
  }

  @Test
  void everyWritePathStoresAUsableNewCertificate() {
    for (final Map.Entry<String, Function<AuthenticationConfiguration, String>> path :
        writePaths().entrySet()) {
      store(VALID);

      assertEquals(
          OTHER_VALID, certificateIn(path.getValue().apply(saml(OTHER_VALID))), path.getKey());
    }
  }

  /** The first start seeds an empty database through createNewSetting: nothing is stored yet. */
  @Test
  void theFirstStartSeedChecksTheCertificate() {
    final BadRequestException refused =
        assertThrows(
            BadRequestException.class, () -> repository.createNewSetting(settings(saml(EXPIRED))));

    assertTrue(refused.getMessage().contains(CERTIFICATE_FIELD));
    assertTrue(rows.isEmpty());

    repository.createNewSetting(settings(saml(VALID)));
    assertEquals(VALID, certificateIn(rows.get(AUTH)));
  }

  private String written(final Runnable write) {
    write.run();
    return rows.get(AUTH);
  }

  private void store(final String idpCertificate) {
    rows.clear();
    rows.put(AUTH, JsonUtils.pojoToJson(saml(idpCertificate)));
  }

  private static String certificateIn(final String storedJson) {
    return JsonUtils.readTree(storedJson).at("/samlConfiguration/idp/idpX509Certificate").asText();
  }

  private static Settings settings(final AuthenticationConfiguration config) {
    return new Settings().withConfigType(AUTHENTICATION_CONFIGURATION).withConfigValue(config);
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

  private SystemDAO inMemoryDao() {
    final SystemDAO dao = mock(SystemDAO.class);
    when(dao.getConfigJsonWithKey(anyString())).thenAnswer(i -> rows.get(i.<String>getArgument(0)));
    when(dao.getConfigWithKey(anyString()))
        .thenAnswer(
            i -> {
              final String json = rows.get(i.<String>getArgument(0));
              return json == null
                  ? null
                  : CollectionDAO.SettingsRowMapper.getSettings(AUTHENTICATION_CONFIGURATION, json);
            });
    doAnswer(i -> rows.put(i.getArgument(0), i.getArgument(1)))
        .when(dao)
        .insertSettings(anyString(), anyString());
    when(dao.updateSettingsIfCurrent(anyString(), anyString(), anyString()))
        .thenAnswer(
            i -> rows.replace(i.getArgument(0), i.getArgument(1), i.getArgument(2)) ? 1 : 0);
    return dao;
  }

  private static String resource(final String path) {
    try (InputStream stream = SystemRepositoryIdpCertificateTest.class.getResourceAsStream(path)) {
      return new String(stream.readAllBytes(), StandardCharsets.US_ASCII);
    } catch (IOException e) {
      throw new UncheckedIOException(e);
    }
  }
}
