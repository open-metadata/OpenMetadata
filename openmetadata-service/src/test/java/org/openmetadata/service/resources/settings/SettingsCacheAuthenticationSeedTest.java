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
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;
import static org.openmetadata.schema.settings.SettingsType.AUTHENTICATION_CONFIGURATION;

import jakarta.ws.rs.BadRequestException;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.lang.reflect.Field;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.catalog.security.client.SamlSSOClientConfig;
import org.openmetadata.catalog.type.IdentityProviderConfig;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.OpsConfig;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.CollectionDAO.SystemDAO;
import org.openmetadata.service.jdbi3.SystemRepository;
import org.openmetadata.service.migration.MigrationValidationClient;

/**
 * The first start stores the authentication configuration of openmetadata.yaml through the settings
 * write step, and the stored copy wins from then on. The seed runs against the real {@link
 * SystemRepository} over an in-memory settings table, so each test checks the row it leaves stored.
 * ADR:2026-11-20-the-stored-saml-idp-certificate-is-standard-pem
 */
class SettingsCacheAuthenticationSeedTest {
  private static final String AUTH = AUTHENTICATION_CONFIGURATION.value();
  private static final String VALID = resource("/saml/mock-idp.crt");
  private static final String EXPIRED = resource("/saml/expired-idp.crt");
  private static final String CERTIFICATE_FIELD = "samlConfiguration.idp.idpX509Certificate";

  private final Map<String, String> rows = new ConcurrentHashMap<>();
  private MockedStatic<Entity> entityMock;
  private MockedStatic<MigrationValidationClient> migrationMock;
  private MockedStatic<WorkflowHandler> workflowMock;
  private boolean initializedBefore;

  @BeforeEach
  void startOnAnEmptyDatabase() throws ReflectiveOperationException {
    initializedBefore = initializedFlag().getBoolean(null);
    initializedFlag().setBoolean(null, false);
    entityMock = mockStatic(Entity.class);
    migrationMock = mockStatic(MigrationValidationClient.class);
    // Seeding the workflow settings restarts the workflow engine, which this test does not run.
    workflowMock = mockStatic(WorkflowHandler.class);
    workflowMock.when(WorkflowHandler::getInstance).thenReturn(mock(WorkflowHandler.class));
    final CollectionDAO collectionDAO = mock(CollectionDAO.class);
    final SystemDAO dao = inMemoryDao();
    when(collectionDAO.systemDAO()).thenReturn(dao);
    entityMock.when(Entity::getCollectionDAO).thenReturn(collectionDAO);
    migrationMock
        .when(MigrationValidationClient::getInstance)
        .thenReturn(mock(MigrationValidationClient.class));
    final SystemRepository repository = new SystemRepository();
    entityMock.when(Entity::getSystemRepository).thenReturn(repository);
  }

  @AfterEach
  void restoreTheCache() throws ReflectiveOperationException {
    workflowMock.close();
    migrationMock.close();
    entityMock.close();
    SettingsCache.cleanUp();
    initializedFlag().setBoolean(null, initializedBefore);
  }

  @Test
  void aRefusedIdpCertificateStopsTheFirstStartAndStoresNoConfiguration() {
    final BadRequestException refused =
        assertThrows(
            BadRequestException.class, () -> SettingsCache.initialize(deployment(EXPIRED)));

    assertTrue(refused.getMessage().contains(CERTIFICATE_FIELD), refused.getMessage());
    assertFalse(rows.containsKey(AUTH), "a refused seed stores no authentication configuration");
  }

  @Test
  void aFirstStartStoresAUsableIdpCertificate() {
    SettingsCache.initialize(deployment(VALID));

    assertEquals(VALID, certificateIn(rows.get(AUTH)));
  }

  @Test
  void aStoredConfigurationWinsOverTheDeploymentAndIsNotCheckedAgain() {
    final String stored = JsonUtils.pojoToJson(saml(VALID));
    rows.put(AUTH, stored);

    assertDoesNotThrow(() -> SettingsCache.initialize(deployment(EXPIRED)));

    assertEquals(stored, rows.get(AUTH));
  }

  private static OpenMetadataApplicationConfig deployment(final String idpCertificate) {
    final OpenMetadataApplicationConfig config = new OpenMetadataApplicationConfig();
    config.setAuthenticationConfiguration(saml(idpCertificate));
    config.setOpsConfig(new OpsConfig().withEnable(false));
    return config;
  }

  private static String certificateIn(final String storedJson) {
    return JsonUtils.readTree(storedJson).at("/samlConfiguration/idp/idpX509Certificate").asText();
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

  /** The settings table, as one row of JSON per setting type. */
  private SystemDAO inMemoryDao() {
    final SystemDAO dao = mock(SystemDAO.class);
    when(dao.getConfigJsonWithKey(anyString()))
        .thenAnswer(call -> rows.get(call.<String>getArgument(0)));
    when(dao.getConfigWithKey(anyString()))
        .thenAnswer(
            call -> {
              final String key = call.getArgument(0);
              final String json = rows.get(key);
              return json == null
                  ? null
                  : CollectionDAO.SettingsRowMapper.getSettings(SettingsType.fromValue(key), json);
            });
    doAnswer(call -> rows.put(call.getArgument(0), call.getArgument(1)))
        .when(dao)
        .insertSettings(anyString(), anyString());
    return dao;
  }

  private static Field initializedFlag() throws ReflectiveOperationException {
    final Field field = SettingsCache.class.getDeclaredField("initialized");
    field.setAccessible(true);
    return field;
  }

  private static String resource(final String path) {
    try (InputStream stream = SettingsCacheAuthenticationSeedTest.class.getResourceAsStream(path)) {
      return new String(stream.readAllBytes(), StandardCharsets.US_ASCII);
    } catch (IOException unreadable) {
      throw new UncheckedIOException(unreadable);
    }
  }
}
